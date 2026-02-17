import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AiAppliedSuggestionInput,
  AiPlanSuggestion,
  AiRecommendationRequest,
  AiRecommendationResponse
} from "@gym/shared";
import { UserRole } from "@prisma/client";
import { createHash } from "crypto";
import { AuthUser } from "../auth/auth.types";
import { AnalyticsService } from "../analytics/analytics.service";
import { PrismaService } from "../prisma/prisma.service";

const MODEL_VERSION = "sprint3.1-mvp";
const STRATEGY_VERSION = "3.3.0";
const DISCLAIMER =
  "Recomendaciones generales de entrenamiento. No constituyen consejo medico ni diagnostico.";

const MEDICAL_LANGUAGE_REGEX =
  /(diagn[oó]stic|tratamiento|prescrip|medic|dosis|terapia|disease|diagnosis|treat)/i;
const ACUTE_PAIN_REGEX =
  /(dolor agudo|acute pain|lesion aguda|injury|inflamaci[oó]n severa|severe pain)/i;

type ListLogsParams = {
  user_id?: string;
  limit?: number;
  cursor?: string;
  safety_flag?: string;
  from?: string;
  to?: string;
};

type ListAppliedParams = {
  routine_id?: string;
  day_id?: string;
};

type ExportLogsParams = {
  from?: string;
  to?: string;
  user_id?: string;
  coach_id?: string;
  safety_flag?: string;
};

@Injectable()
export class AiService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService
  ) {}

  private sanitizeMedicalLanguage(text: string, safetyFlags: string[]): string {
    if (MEDICAL_LANGUAGE_REGEX.test(text)) {
      if (!safetyFlags.includes("medical_language_blocked")) {
        safetyFlags.push("medical_language_blocked");
      }
      return "Se prioriza una pauta conservadora de entrenamiento general.";
    }
    return text;
  }

  private shouldUseSafeMode(input: AiRecommendationRequest): boolean {
    const injuries = input.constraints?.injuries ?? "";
    return Boolean(input.constraints?.acute_pain) || ACUTE_PAIN_REGEX.test(injuries);
  }

  private isEnabled(): boolean {
    const flag = process.env.AI_ENABLED;
    if (flag == null) {
      return process.env.NODE_ENV !== "production";
    }
    return flag.toLowerCase() === "true" || flag === "1";
  }

  private getRateLimitPerDay(): number {
    const raw = process.env.AI_RATE_LIMIT_PER_DAY;
    const parsed = Number(raw);
    if (!raw || Number.isNaN(parsed) || parsed < 1) {
      return 10;
    }
    return Math.floor(parsed);
  }

  private getDedupWindowHours(): number {
    const raw = process.env.AI_DEDUP_WINDOW_HOURS;
    const parsed = Number(raw);
    if (!raw || Number.isNaN(parsed) || parsed < 1) {
      return 6;
    }
    return Math.floor(parsed);
  }

  private parseCursor(cursor?: string): { created_at: Date; id: string } | null {
    if (!cursor) {
      return null;
    }
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8")) as {
        created_at: string;
        id: string;
      };
      return { created_at: new Date(decoded.created_at), id: decoded.id };
    } catch {
      return null;
    }
  }

  private createCursor(item: { created_at: Date; id: string }): string {
    return Buffer.from(
      JSON.stringify({ created_at: item.created_at.toISOString(), id: item.id })
    ).toString("base64");
  }

  private stableNormalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.stableNormalize(item));
    }
    if (value && typeof value === "object") {
      const sortedEntries = Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => [key, this.stableNormalize(val)]);
      return Object.fromEntries(sortedEntries);
    }
    return value;
  }

  private buildRequestHash(input: AiRecommendationRequest, summary: unknown): string {
    const normalized = this.stableNormalize({
      input,
      summary,
      strategy_version: STRATEGY_VERSION
    });
    return createHash("sha256")
      .update(JSON.stringify(normalized))
      .digest("hex");
  }

  private buildPlanSuggestions(targetIncreasePercent: number): AiPlanSuggestion[] {
    const suggestions: AiPlanSuggestion[] = [
      {
        id: "volume-main",
        title: "Ajuste principal de volumen",
        description:
          targetIncreasePercent > 0
            ? "Aumenta un set por ejercicio en grupos single y conserva buena tecnica."
            : "Mantener sets actuales para estabilizar recuperacion y consistencia.",
        apply_scope: "SINGLE_GROUPS",
        set_delta: targetIncreasePercent > 0 ? 1 : 0,
        rep_min_delta: 0,
        rep_max_delta: targetIncreasePercent > 0 ? 1 : 0,
        rest_after_set_seconds: targetIncreasePercent > 0 ? 75 : null,
        swap_strategy: "NONE"
      }
    ];

    if (targetIncreasePercent > 0) {
      suggestions.push({
        id: "variation-accessory",
        title: "Variacion controlada de ejercicio",
        description: "Rota A1 al siguiente ejercicio disponible para reducir monotonia.",
        apply_scope: "ALL_GROUPS",
        set_delta: 0,
        rep_min_delta: 0,
        rep_max_delta: 0,
        rest_between_exercises_seconds: null,
        swap_order_in_group: "A1",
        swap_strategy: "NEXT_AVAILABLE"
      });
    }

    return suggestions;
  }

  private buildSafeModeSuggestions(): AiPlanSuggestion[] {
    return [
      {
        id: "safe-mode",
        title: "Modo seguro",
        description: "Sin progresion de volumen; mantenga cargas submaximas y tecnica estricta.",
        apply_scope: "ALL_GROUPS",
        set_delta: 0,
        rep_min_delta: -1,
        rep_max_delta: 0,
        rest_after_set_seconds: 90,
        rest_between_exercises_seconds: 30,
        swap_strategy: "NONE"
      }
    ];
  }

  private sanitizePayload(value: unknown): unknown {
    const SENSITIVE_KEYS = new Set([
      "token",
      "access_token",
      "refresh_token",
      "authorization",
      "password",
      "secret",
      "api_key"
    ]);

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizePayload(item));
    }

    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = this.sanitizePayload(entry);
        }
      }
      return result;
    }

    return value;
  }

  private async assertCoachCanReadUserLogs(coachId: string, userId: string) {
    const assignment = await this.prisma.routineAssignment.findFirst({
      where: {
        coach_id: coachId,
        user_id: userId,
        is_active: true
      },
      select: { id: true }
    });
    if (!assignment) {
      throw new ForbiddenException("Coach cannot access logs for this user");
    }
  }

  private isCoachOrAdmin(role: UserRole): boolean {
    return role === UserRole.COACH || role === UserRole.ADMIN;
  }

  private parseDateRange(input: { from?: string; to?: string }, defaultDays: number): {
    from: Date;
    to: Date;
  } {
    const now = new Date();
    const to = input.to ? new Date(input.to) : now;
    const from = input.from
      ? new Date(input.from)
      : new Date(now.getTime() - defaultDays * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new HttpException({ message: "Invalid date range" }, HttpStatus.BAD_REQUEST);
    }
    if (to.getTime() < from.getTime()) {
      throw new HttpException({ message: "Invalid range: to < from" }, HttpStatus.BAD_REQUEST);
    }
    const rangeDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (rangeDays > 90) {
      throw new HttpException({ message: "Range too large (max 90 days)" }, HttpStatus.BAD_REQUEST);
    }
    return { from, to };
  }

  private summarizePayload(payload: unknown): string {
    if (!payload || typeof payload !== "object") {
      return "";
    }
    const value = payload as Record<string, unknown>;
    const summaryParts: string[] = [];
    if (typeof value.recommendation_summary === "string") {
      summaryParts.push(value.recommendation_summary.slice(0, 160));
    }
    if (Array.isArray(value.safety_flags) && value.safety_flags.length > 0) {
      summaryParts.push(`flags:${value.safety_flags.join("|")}`);
    }
    if (typeof value.message === "string") {
      summaryParts.push(value.message.slice(0, 120));
    }
    return summaryParts.join(" • ");
  }

  private escapeCsv(value: unknown): string {
    if (value == null) {
      return "";
    }
    const text = String(value);
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  }

  private async getCoachScope(actor: AuthUser): Promise<{
    userIds: string[];
    routineIds: string[];
  }> {
    const [assignments, ownedRoutines] = await Promise.all([
      this.prisma.routineAssignment.findMany({
        where: { coach_id: actor.sub, is_active: true },
        select: { user_id: true },
        distinct: ["user_id"]
      }),
      this.prisma.routine.findMany({
        where: { owner_id: actor.sub },
        select: { id: true }
      })
    ]);
    return {
      userIds: assignments.map((row) => row.user_id),
      routineIds: ownedRoutines.map((row) => row.id)
    };
  }

  private async assertCanAccessRoutineForTrace(
    actor: AuthUser,
    routineId: string
  ): Promise<void> {
    const routine = await this.prisma.routine.findUnique({
      where: { id: routineId },
      select: { id: true, owner_id: true }
    });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (routine.owner_id === actor.sub) {
      return;
    }
    const assignment = await this.prisma.routineAssignment.findFirst({
      where: {
        coach_id: actor.sub,
        routine_id: routine.id,
        is_active: true
      },
      select: { id: true }
    });
    if (!assignment) {
      throw new ForbiddenException("Coach cannot access this routine trace");
    }
  }

  async getRecommendations(
    input: AiRecommendationRequest,
    actor: AuthUser
  ): Promise<AiRecommendationResponse> {
    const startedAt = Date.now();
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException("AI disabled");
    }

    const summary = await this.analyticsService.getTrainingSummary(
      actor.sub,
      input.context.window_days
    );
    const requestHash = this.buildRequestHash(input, summary);
    const dedupSince = new Date(Date.now() - this.getDedupWindowHours() * 60 * 60 * 1000);

    const cached = await this.prisma.aiRecommendationLog.findFirst({
      where: {
        user_id: actor.sub,
        request_hash: requestHash,
        rate_limited: false,
        created_at: { gte: dedupSince }
      },
      orderBy: { created_at: "desc" }
    });
    if (cached?.response_payload) {
      const cachedPayload = cached.response_payload as unknown as AiRecommendationResponse;
      const dedupResponse: AiRecommendationResponse = {
        ...cachedPayload,
        ai_log_id: cached.id,
        dedup_hit: true
      };
      const dedupCreated = await this.prisma.aiRecommendationLog.create({
        data: {
          user_id: actor.sub,
          coach_id:
            actor.role === UserRole.COACH || actor.role === UserRole.ADMIN
              ? actor.sub
              : null,
          request_payload: input as unknown as object,
          response_payload: dedupResponse as unknown as object,
          safety_flags: cached.safety_flags,
          request_hash: requestHash,
          dedup_hit: true,
          rate_limited: false,
          latency_ms: Date.now() - startedAt,
          model_version: cached.model_version,
          strategy_version: cached.strategy_version
        }
      });
      return {
        ...dedupResponse,
        ai_log_id: dedupCreated.id,
        dedup_hit: true
      };
    }

    const dailySince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const usedInWindow = await this.prisma.aiRecommendationLog.count({
      where: {
        user_id: actor.sub,
        created_at: { gte: dailySince }
      }
    });
    if (usedInWindow >= this.getRateLimitPerDay()) {
      const oldestLog = await this.prisma.aiRecommendationLog.findFirst({
        where: {
          user_id: actor.sub,
          created_at: { gte: dailySince }
        },
        orderBy: { created_at: "asc" },
        select: { created_at: true }
      });
      const retryAfterSeconds = oldestLog
        ? Math.max(
            1,
            Math.ceil(
              (oldestLog.created_at.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / 1000
            )
          )
        : 60;

      await this.prisma.aiRecommendationLog.create({
        data: {
          user_id: actor.sub,
          coach_id:
            actor.role === UserRole.COACH || actor.role === UserRole.ADMIN
              ? actor.sub
              : null,
          request_payload: input as unknown as object,
          response_payload: {
            message: "AI rate limit exceeded",
            retry_after_seconds: retryAfterSeconds
          } as object,
          safety_flags: [],
          request_hash: requestHash,
          dedup_hit: false,
          rate_limited: true,
          latency_ms: Date.now() - startedAt,
          model_version: MODEL_VERSION,
          strategy_version: STRATEGY_VERSION
        }
      });

      throw new HttpException({
        message: "AI rate limit exceeded",
        retry_after_seconds: retryAfterSeconds
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const safety_flags: string[] = [];

    let response: AiRecommendationResponse;
    if (this.shouldUseSafeMode(input)) {
      safety_flags.push("acute_pain_guardrail");
      response = {
        ai_log_id: "",
        model_version: MODEL_VERSION,
        strategy_version: STRATEGY_VERSION,
        dedup_hit: false,
        safe_mode: true,
        safety_flags,
        rationale: [
          "Dolor agudo reportado por el usuario.",
          "Se evita progresion por seguridad y control de riesgo."
        ],
        plan_suggestions: this.buildSafeModeSuggestions(),
        disclaimer: DISCLAIMER,
        recommendation_summary:
          "Se detecto dolor agudo o lesion reportada. Se recomienda reducir intensidad y consultar a un profesional de salud antes de progresar.",
        adjustments: [
          {
            title: "Modo seguro",
            description:
              "Mantener carga submaxima, evitar progresiones y priorizar tecnica sin dolor.",
            delta_volume_percent: 0
          }
        ],
        based_on: {
          window_days: input.context.window_days,
          sessions_analyzed: summary.sessions_count,
          volume_total: summary.volume_total,
          adherence: summary.adherence,
          average_rpe: summary.average_rpe
        }
      };
    } else {
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const weekStart = now - weekMs;
      const prevWeekStart = now - weekMs * 2;

      const currentWeekVolume = summary.sessions
        .filter((session) => new Date(session.started_at).getTime() >= weekStart)
        .reduce((acc, session) => acc + session.volume_total, 0);
      const previousWeekVolume = summary.sessions
        .filter((session) => {
          const ts = new Date(session.started_at).getTime();
          return ts >= prevWeekStart && ts < weekStart;
        })
        .reduce((acc, session) => acc + session.volume_total, 0);

      let targetIncreasePercent = 8;
      if (summary.adherence < 0.7 || (summary.average_rpe ?? 0) >= 8) {
        targetIncreasePercent = 0;
        safety_flags.push("progression_limited_by_recovery");
      } else if (previousWeekVolume > 0) {
        const observedGrowth =
          ((currentWeekVolume - previousWeekVolume) / previousWeekVolume) * 100;
        targetIncreasePercent = Math.max(0, Math.min(15, 8 - Math.max(0, observedGrowth)));
      }

      targetIncreasePercent = Math.min(15, targetIncreasePercent);

      const summaryText = this.sanitizeMedicalLanguage(
        targetIncreasePercent > 0
          ? `Se sugiere progresar de forma moderada con incremento semanal de ~${targetIncreasePercent.toFixed(1)}% en volumen, manteniendo tecnica y RPE controlado.`
          : "Se recomienda mantener volumen actual hasta mejorar adherencia y percepcion de esfuerzo.",
        safety_flags
      );

      response = {
        ai_log_id: "",
        model_version: MODEL_VERSION,
        strategy_version: STRATEGY_VERSION,
        dedup_hit: false,
        safe_mode: false,
        safety_flags,
        rationale: [
          `Adherencia observada: ${(summary.adherence * 100).toFixed(0)}%.`,
          `RPE promedio: ${summary.average_rpe ?? 0}.`,
          targetIncreasePercent > 0
            ? "Existe margen para progresion gradual."
            : "Se prioriza estabilizar recuperacion antes de progresar."
        ],
        plan_suggestions: this.buildPlanSuggestions(targetIncreasePercent),
        disclaimer: DISCLAIMER,
        recommendation_summary: summaryText,
        adjustments: [
          {
            title: "Ajuste de volumen semanal",
            description:
              targetIncreasePercent > 0
                ? "Incrementar 1 set en movimientos principales o +2 reps por set en ejercicios accesorios."
                : "Mantener volumen y enfocarse en consistencia, tecnica y recuperacion.",
            delta_volume_percent: targetIncreasePercent
          }
        ],
        based_on: {
          window_days: input.context.window_days,
          sessions_analyzed: summary.sessions_count,
          volume_total: summary.volume_total,
          adherence: summary.adherence,
          average_rpe: summary.average_rpe
        }
      };
    }

    const createdLog = await this.prisma.aiRecommendationLog.create({
      data: {
        user_id: actor.sub,
        coach_id:
          actor.role === UserRole.COACH || actor.role === UserRole.ADMIN
            ? actor.sub
            : null,
        request_payload: input as unknown as object,
        response_payload: response as unknown as object,
        safety_flags,
        request_hash: requestHash,
        dedup_hit: false,
        rate_limited: false,
        latency_ms: Date.now() - startedAt,
        model_version: MODEL_VERSION,
        strategy_version: STRATEGY_VERSION
      }
    });

    return {
      ...response,
      ai_log_id: createdLog.id
    };
  }

  async getLogs(actor: AuthUser, params: ListLogsParams) {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const cursor = this.parseCursor(params.cursor);

    let userIdsFilter: string[] | undefined;
    if (actor.role === UserRole.ADMIN) {
      userIdsFilter = params.user_id ? [params.user_id] : undefined;
    } else if (actor.role === UserRole.COACH) {
      if (params.user_id) {
        await this.assertCoachCanReadUserLogs(actor.sub, params.user_id);
        userIdsFilter = [params.user_id];
      } else {
        const assignments = await this.prisma.routineAssignment.findMany({
          where: { coach_id: actor.sub, is_active: true },
          select: { user_id: true },
          distinct: ["user_id"]
        });
        userIdsFilter = assignments.map((item) => item.user_id);
      }
    } else {
      userIdsFilter = [actor.sub];
    }

    const whereClause = {
      ...(userIdsFilter ? { user_id: { in: userIdsFilter } } : {}),
      ...(params.safety_flag ? { safety_flags: { has: params.safety_flag } } : {}),
      ...(params.from || params.to
        ? {
            created_at: {
              ...(params.from ? { gte: new Date(params.from) } : {}),
              ...(params.to ? { lte: new Date(params.to) } : {})
            }
          }
        : {}),
      ...(cursor
        ? {
            OR: [
              { created_at: { lt: cursor.created_at } },
              { created_at: cursor.created_at, id: { lt: cursor.id } }
            ]
          }
        : {})
    };

    const rows = await this.prisma.aiRecommendationLog.findMany({
      where: whereClause,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const next_cursor = hasMore
      ? this.createCursor({ created_at: page[page.length - 1].created_at, id: page[page.length - 1].id })
      : null;

    return {
      items: page.map((item) => ({
        id: item.id,
        user_id: item.user_id,
        coach_id: item.coach_id,
        safety_flags: item.safety_flags,
        model_version: item.model_version,
        strategy_version: item.strategy_version,
        dedup_hit: item.dedup_hit,
        rate_limited: item.rate_limited,
        latency_ms: item.latency_ms,
        created_at: item.created_at
      })),
      next_cursor
    };
  }

  async getLogById(actor: AuthUser, id: string) {
    const log = await this.prisma.aiRecommendationLog.findUnique({
      where: { id },
      include: {
        applied_suggestions: {
          orderBy: { created_at: "desc" },
          select: {
            id: true,
            routine_id: true,
            routine_day_id: true,
            applied_by_user_id: true,
            created_at: true
          }
        }
      }
    });
    if (!log) {
      throw new NotFoundException("AI log not found");
    }

    if (actor.role === UserRole.ADMIN) {
      return {
        ...log,
        request_payload: this.sanitizePayload(log.request_payload),
        response_payload: this.sanitizePayload(log.response_payload)
      };
    }

    if (actor.role === UserRole.COACH) {
      await this.assertCoachCanReadUserLogs(actor.sub, log.user_id);
      return {
        ...log,
        request_payload: this.sanitizePayload(log.request_payload),
        response_payload: this.sanitizePayload(log.response_payload)
      };
    }

    if (actor.sub !== log.user_id) {
      throw new ForbiddenException("Not allowed to access this AI log");
    }

    return {
      ...log,
      request_payload: this.sanitizePayload(log.request_payload),
      response_payload: this.sanitizePayload(log.response_payload)
    };
  }

  async createAppliedSuggestion(actor: AuthUser, input: AiAppliedSuggestionInput) {
    if (!this.isCoachOrAdmin(actor.role)) {
      throw new ForbiddenException("Only coach/admin can apply AI suggestions");
    }

    await this.assertCanAccessRoutineForTrace(actor, input.routine_id);

    const [log, day] = await Promise.all([
      this.prisma.aiRecommendationLog.findUnique({
        where: { id: input.ai_log_id },
        select: { id: true }
      }),
      this.prisma.routineDay.findUnique({
        where: { id: input.routine_day_id },
        select: { id: true, routine_id: true }
      })
    ]);
    if (!log) {
      throw new NotFoundException("AI log not found");
    }
    if (!day || day.routine_id !== input.routine_id) {
      throw new NotFoundException("Routine day not found for routine");
    }

    return this.prisma.aiAppliedSuggestion.create({
      data: {
        ai_log_id: input.ai_log_id,
        routine_id: input.routine_id,
        routine_day_id: input.routine_day_id,
        applied_by_user_id: actor.sub,
        applied_changes: input.applied_changes as unknown as object
      }
    });
  }

  async listAppliedSuggestions(actor: AuthUser, params: ListAppliedParams) {
    if (!this.isCoachOrAdmin(actor.role)) {
      throw new ForbiddenException("Only coach/admin can read AI applied trace");
    }
    if (params.routine_id) {
      await this.assertCanAccessRoutineForTrace(actor, params.routine_id);
    }

    const where = {
      ...(params.routine_id ? { routine_id: params.routine_id } : {}),
      ...(params.day_id ? { routine_day_id: params.day_id } : {})
    };

    const rows = await this.prisma.aiAppliedSuggestion.findMany({
      where,
      include: {
        ai_log: {
          select: {
            id: true,
            created_at: true,
            model_version: true,
            strategy_version: true
          }
        }
      },
      orderBy: { created_at: "desc" }
    });

    if (actor.role === UserRole.ADMIN) {
      return rows;
    }

    if (!params.routine_id && !params.day_id) {
      const [allowedAssignments, ownedRoutines] = await Promise.all([
        this.prisma.routineAssignment.findMany({
          where: { coach_id: actor.sub, is_active: true },
          select: { routine_id: true },
          distinct: ["routine_id"]
        }),
        this.prisma.routine.findMany({
          where: { owner_id: actor.sub },
          select: { id: true }
        })
      ]);
      const allowed = new Set([
        ...allowedAssignments.map((item) => item.routine_id),
        ...ownedRoutines.map((item) => item.id)
      ]);
      return rows.filter((row) => allowed.has(row.routine_id));
    }

    return rows;
  }

  async getMetrics(actor: AuthUser, days: number) {
    if (!this.isCoachOrAdmin(actor.role)) {
      throw new ForbiddenException("Only coach/admin can read AI metrics");
    }
    const boundedDays = Math.min(Math.max(days, 1), 90);
    const since = new Date(Date.now() - boundedDays * 24 * 60 * 60 * 1000);
    const where =
      actor.role === UserRole.ADMIN
        ? { created_at: { gte: since } }
        : { created_at: { gte: since }, coach_id: actor.sub };

    const [total, dedupHits, rateLimited] = await Promise.all([
      this.prisma.aiRecommendationLog.count({ where }),
      this.prisma.aiRecommendationLog.count({ where: { ...where, dedup_hit: true } }),
      this.prisma.aiRecommendationLog.count({ where: { ...where, rate_limited: true } })
    ]);

    const dedup_savings_pct = total === 0 ? 0 : Number(((dedupHits / total) * 100).toFixed(2));

    return {
      days: boundedDays,
      total,
      dedup_hits: dedupHits,
      rate_limited: rateLimited,
      dedup_savings_pct
    };
  }

  async exportLogsCsv(actor: AuthUser, params: ExportLogsParams): Promise<string> {
    if (!this.isCoachOrAdmin(actor.role)) {
      throw new ForbiddenException("Only coach/admin can export AI logs");
    }

    const { from, to } = this.parseDateRange({ from: params.from, to: params.to }, 7);
    let whereClause: Record<string, unknown> = {
      created_at: { gte: from, lte: to }
    };

    if (params.user_id) {
      whereClause = { ...whereClause, user_id: params.user_id };
    }
    if (params.safety_flag) {
      whereClause = { ...whereClause, safety_flags: { has: params.safety_flag } };
    }
    if (params.coach_id) {
      whereClause = { ...whereClause, coach_id: params.coach_id };
    }

    if (actor.role === UserRole.COACH) {
      const scope = await this.getCoachScope(actor);
      if (scope.userIds.length === 0 && scope.routineIds.length === 0) {
        return "created_at,user_id,coach_id,strategy_version,model_version,dedup_hit,rate_limited,latency_ms,safety_flags,routine_id,routine_day_id,applied_by_user_id,request_summary,response_summary\n";
      }
      whereClause = {
        ...whereClause,
        OR: [
          ...(scope.userIds.length > 0 ? [{ user_id: { in: scope.userIds } }] : []),
          ...(scope.routineIds.length > 0
            ? [{ applied_suggestions: { some: { routine_id: { in: scope.routineIds } } } }]
            : [])
        ]
      };
    }

    const rows = await this.prisma.aiRecommendationLog.findMany({
      where: whereClause as never,
      include: {
        applied_suggestions: {
          select: {
            routine_id: true,
            routine_day_id: true,
            applied_by_user_id: true
          }
        }
      },
      orderBy: { created_at: "desc" }
    });

    const header = [
      "created_at",
      "user_id",
      "coach_id",
      "strategy_version",
      "model_version",
      "dedup_hit",
      "rate_limited",
      "latency_ms",
      "safety_flags",
      "routine_id",
      "routine_day_id",
      "applied_by_user_id",
      "request_summary",
      "response_summary"
    ].join(",");

    const lines: string[] = [header];
    for (const row of rows) {
      const sanitizedRequest = this.sanitizePayload(row.request_payload);
      const sanitizedResponse = this.sanitizePayload(row.response_payload);
      const base = [
        this.escapeCsv(row.created_at.toISOString()),
        this.escapeCsv(row.user_id),
        this.escapeCsv(row.coach_id ?? ""),
        this.escapeCsv(row.strategy_version),
        this.escapeCsv(row.model_version),
        this.escapeCsv(row.dedup_hit),
        this.escapeCsv(row.rate_limited),
        this.escapeCsv(row.latency_ms ?? ""),
        this.escapeCsv((row.safety_flags ?? []).join("|"))
      ];

      if (row.applied_suggestions.length === 0) {
        lines.push(
          [
            ...base,
            "",
            "",
            "",
            this.escapeCsv(this.summarizePayload(sanitizedRequest)),
            this.escapeCsv(this.summarizePayload(sanitizedResponse))
          ].join(",")
        );
        continue;
      }

      for (const applied of row.applied_suggestions) {
        lines.push(
          [
            ...base,
            this.escapeCsv(applied.routine_id),
            this.escapeCsv(applied.routine_day_id),
            this.escapeCsv(applied.applied_by_user_id),
            this.escapeCsv(this.summarizePayload(sanitizedRequest)),
            this.escapeCsv(this.summarizePayload(sanitizedResponse))
          ].join(",")
        );
      }
    }
    return `${lines.join("\n")}\n`;
  }

  async getAlerts(actor: AuthUser, windowHours: number) {
    if (!this.isCoachOrAdmin(actor.role)) {
      throw new ForbiddenException("Only coach/admin can read AI alerts");
    }
    const boundedHours = Math.min(Math.max(windowHours, 1), 168);
    const windowStart = new Date(Date.now() - boundedHours * 60 * 60 * 1000);
    const prevWindowStart = new Date(Date.now() - boundedHours * 2 * 60 * 60 * 1000);

    let whereCurrent: Record<string, unknown> = { created_at: { gte: windowStart } };
    let wherePrev: Record<string, unknown> = {
      created_at: { gte: prevWindowStart, lt: windowStart }
    };

    if (actor.role === UserRole.COACH) {
      const scope = await this.getCoachScope(actor);
      if (scope.userIds.length === 0 && scope.routineIds.length === 0) {
        return [];
      }
      const scopeOr = [
        ...(scope.userIds.length > 0 ? [{ user_id: { in: scope.userIds } }] : []),
        ...(scope.routineIds.length > 0
          ? [{ applied_suggestions: { some: { routine_id: { in: scope.routineIds } } } }]
          : [])
      ];
      whereCurrent = { ...whereCurrent, OR: scopeOr };
      wherePrev = { ...wherePrev, OR: scopeOr };
    }

    const currentWhere = whereCurrent as Record<string, unknown>;
    const prevWhere = wherePrev as Record<string, unknown>;

    const [total, rateLimited, safetyCritical, dedupHits, prevTotal, prevDedup] = await Promise.all([
      this.prisma.aiRecommendationLog.count({ where: currentWhere as never }),
      this.prisma.aiRecommendationLog.count({
        where: { ...currentWhere, rate_limited: true } as never
      }),
      this.prisma.aiRecommendationLog.count({
        where: {
          ...currentWhere,
          OR: [
            { safety_flags: { has: "acute_pain_guardrail" } },
            { safety_flags: { has: "medical_language_blocked" } }
          ]
        } as never
      }),
      this.prisma.aiRecommendationLog.count({
        where: { ...currentWhere, dedup_hit: true } as never
      }),
      this.prisma.aiRecommendationLog.count({ where: prevWhere as never }),
      this.prisma.aiRecommendationLog.count({
        where: { ...prevWhere, dedup_hit: true } as never
      })
    ]);

    const alerts: Array<{
      id: string;
      severity: "low" | "medium" | "high";
      title: string;
      description: string;
      metrics: Record<string, number>;
      window_hours: number;
    }> = [];

    const ratePct = total === 0 ? 0 : rateLimited / total;
    if (rateLimited >= 5 || ratePct >= 0.2) {
      alerts.push({
        id: "rate-limited-spike",
        severity: ratePct >= 0.35 ? "high" : "medium",
        title: "Rate limited spike",
        description: "High share of AI requests are being rate limited.",
        metrics: { total, rate_limited: rateLimited, rate_limited_pct: Number((ratePct * 100).toFixed(2)) },
        window_hours: boundedHours
      });
    }

    const safetyPct = total === 0 ? 0 : safetyCritical / total;
    if (safetyCritical >= 3 || safetyPct >= 0.25) {
      alerts.push({
        id: "safety-flag-spike",
        severity: safetyPct >= 0.4 ? "high" : "medium",
        title: "Safety flags critical spike",
        description: "Critical safety guardrails are triggering above normal thresholds.",
        metrics: { total, safety_critical: safetyCritical, safety_critical_pct: Number((safetyPct * 100).toFixed(2)) },
        window_hours: boundedHours
      });
    }

    const errorSpike = rateLimited;
    if (errorSpike >= 5) {
      alerts.push({
        id: "error-spike",
        severity: errorSpike >= 10 ? "high" : "medium",
        title: "AI error spike",
        description: "Operational errors increased (approximated by rate-limited events).",
        metrics: { error_events: errorSpike },
        window_hours: boundedHours
      });
    }

    const currentDedupPct = total === 0 ? 0 : dedupHits / total;
    const prevDedupPct = prevTotal === 0 ? currentDedupPct : prevDedup / prevTotal;
    const drop = prevDedupPct - currentDedupPct;
    if (drop >= 0.15) {
      alerts.push({
        id: "dedup-savings-drop",
        severity: drop >= 0.3 ? "high" : "medium",
        title: "Dedup savings drop",
        description: "Dedup cache effectiveness dropped versus baseline window.",
        metrics: {
          current_dedup_savings_pct: Number((currentDedupPct * 100).toFixed(2)),
          baseline_dedup_savings_pct: Number((prevDedupPct * 100).toFixed(2)),
          drop_pct_points: Number((drop * 100).toFixed(2))
        },
        window_hours: boundedHours
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: "no-alerts",
        severity: "low",
        title: "No critical alerts",
        description: "AI operations are within expected thresholds.",
        metrics: { total, rate_limited: rateLimited, dedup_hits: dedupHits },
        window_hours: boundedHours
      });
    }

    return alerts;
  }
}
