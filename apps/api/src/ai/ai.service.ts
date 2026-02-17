import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import {
  AiRecommendationRequest,
  AiRecommendationResponse
} from "@gym/shared";
import { UserRole } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { AnalyticsService } from "../analytics/analytics.service";
import { PrismaService } from "../prisma/prisma.service";

const MODEL_VERSION = "sprint3.1-mvp";
const STRATEGY_VERSION = "3.2.0";
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

  async getRecommendations(
    input: AiRecommendationRequest,
    actor: AuthUser
  ): Promise<AiRecommendationResponse> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException("AI disabled");
    }

    const summary = await this.analyticsService.getTrainingSummary(
      actor.sub,
      input.context.window_days
    );

    const safety_flags: string[] = [];

    let response: AiRecommendationResponse;
    if (this.shouldUseSafeMode(input)) {
      safety_flags.push("acute_pain_guardrail");
      response = {
        model_version: MODEL_VERSION,
        strategy_version: STRATEGY_VERSION,
        safe_mode: true,
        safety_flags,
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
        model_version: MODEL_VERSION,
        strategy_version: STRATEGY_VERSION,
        safe_mode: false,
        safety_flags,
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

    await this.prisma.aiRecommendationLog.create({
      data: {
        user_id: actor.sub,
        coach_id:
          actor.role === UserRole.COACH || actor.role === UserRole.ADMIN
            ? actor.sub
            : null,
        request_payload: input as unknown as object,
        response_payload: response as unknown as object,
        safety_flags,
        model_version: MODEL_VERSION,
        strategy_version: STRATEGY_VERSION
      }
    });

    return response;
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
        created_at: item.created_at
      })),
      next_cursor
    };
  }

  async getLogById(actor: AuthUser, id: string) {
    const log = await this.prisma.aiRecommendationLog.findUnique({
      where: { id }
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
}
