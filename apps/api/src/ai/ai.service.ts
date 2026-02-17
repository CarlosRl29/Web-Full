import { Injectable } from "@nestjs/common";
import {
  AiRecommendationRequest,
  AiRecommendationResponse
} from "@gym/shared";
import { UserRole } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { AnalyticsService } from "../analytics/analytics.service";
import { PrismaService } from "../prisma/prisma.service";

const MODEL_VERSION = "sprint3.1-mvp";
const DISCLAIMER =
  "Recomendaciones generales de entrenamiento. No constituyen consejo medico ni diagnostico.";

const MEDICAL_LANGUAGE_REGEX =
  /(diagn[oó]stic|tratamiento|prescrip|medic|dosis|terapia|disease|diagnosis|treat)/i;
const ACUTE_PAIN_REGEX =
  /(dolor agudo|acute pain|lesion aguda|injury|inflamaci[oó]n severa|severe pain)/i;

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

  async getRecommendations(
    input: AiRecommendationRequest,
    actor: AuthUser
  ): Promise<AiRecommendationResponse> {
    const summary = await this.analyticsService.getTrainingSummary(
      actor.sub,
      input.context.window_days
    );

    const safety_flags: string[] = [];

    let response: AiRecommendationResponse;
    if (this.shouldUseSafeMode(input)) {
      safety_flags.push("acute_pain_guardrail");
      response = {
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
        model_version: MODEL_VERSION
      }
    });

    return response;
  }
}
