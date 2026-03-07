/**
 * Exercise replacement engine: find substitutes based on taxonomy + user preferences.
 * Non-LLM explanations from metadata.
 */

import { Injectable } from "@nestjs/common";
import type {
  Exercise,
  ExerciseDifficulty,
  MovementPattern,
  MuscleGroup,
  Submuscle
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type SwapReason =
  | "EQUIPMENT_BUSY"
  | "NOT_AVAILABLE"
  | "PAIN"
  | "PREFERENCE"
  | "TOO_HARD";

export type ReplacementConstraints = {
  available_equipment?: string[];
  blocked_equipment?: string[];
  avoid_exercise_ids?: string[];
  reason?: SwapReason;
  user_level?: ExerciseDifficulty;
  user_goal?: string;
};

export type ReplacementCandidate = {
  exercise: Exercise & { translations?: Array<{ locale: string; name: string }> };
  score: number;
  explanation: string;
  display_name: string;
};

const EQUIPMENT_ALIASES: Record<string, string[]> = {
  barbell: ["barbell", "barra", "Barra"],
  dumbbell: ["dumbbell", "mancuernas", "Mancuernas"],
  kettlebell: ["kettlebell", "Kettlebell"],
  "body weight": ["body weight", "bodyweight", "peso corporal", "Bodyweight"],
  cable: ["cable", "polea", "Polea"],
  machine: ["machine", "máquina", "maquina", "Máquina"]
};

function normalizeEquipment(eq: string | null): string {
  if (!eq) return "body weight";
  const lower = eq.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(EQUIPMENT_ALIASES)) {
    if (aliases.some((a) => lower === a.toLowerCase() || lower.includes(a.toLowerCase())))
      return key;
  }
  return lower;
}

function equipmentMatches(
  exEquipment: string | null,
  available?: string[],
  blocked?: string[]
): boolean {
  const eq = normalizeEquipment(exEquipment);
  if (blocked?.length) {
    const blockedNorm = blocked.map((b) => normalizeEquipment(b));
    if (blockedNorm.some((b) => eq === b || eq.includes(b))) return false;
  }
  if (available?.length) {
    const availNorm = available.map((a) => normalizeEquipment(a));
    return availNorm.some((a) => eq === a || eq.includes(a));
  }
  return true;
}

function levelCompatible(
  exDifficulty: ExerciseDifficulty | null,
  userLevel: ExerciseDifficulty | undefined
): boolean {
  if (!userLevel || !exDifficulty) return true;
  const order: ExerciseDifficulty[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
  const exIdx = order.indexOf(exDifficulty);
  const userIdx = order.indexOf(userLevel);
  return exIdx <= userIdx + 1;
}

@Injectable()
export class ExerciseReplacementService {
  constructor(private readonly prisma: PrismaService) {}

  async getReplacements(
    userId: string,
    originalExerciseId: string,
    constraints: ReplacementConstraints = {},
    locale: "es" | "en" = "en",
    limit = 5
  ): Promise<ReplacementCandidate[]> {
    const original = await this.prisma.exercise.findUnique({
      where: { id: originalExerciseId },
      include: { translations: true }
    });
    if (!original) return [];

    const avoidIds = new Set(constraints.avoid_exercise_ids ?? []);
    const userPrefs = await this.prisma.userExercisePreference.findMany({
      where: { user_id: userId }
    });
    for (const p of userPrefs) {
      if (p.preference_type === "AVOID" && p.exercise_id) avoidIds.add(p.exercise_id);
    }
    avoidIds.add(originalExerciseId);

    const whereClause: object = { id: { notIn: Array.from(avoidIds) } };
    if (original.primary_muscle) {
      (whereClause as { primary_muscle?: MuscleGroup }).primary_muscle = original.primary_muscle;
    } else if (original.movement_pattern) {
      (whereClause as { movement_pattern?: MovementPattern }).movement_pattern = original.movement_pattern;
    }

    const candidates = await this.prisma.exercise.findMany({
      where: whereClause as never,
      include: { translations: true },
      take: 80
    });

    const scored: ReplacementCandidate[] = [];
    for (const ex of candidates) {
      if (!equipmentMatches(ex.equipment, constraints.available_equipment, constraints.blocked_equipment))
        continue;
      if (!levelCompatible(ex.difficulty, constraints.user_level)) continue;

      let score = 0;
      const reasons: string[] = [];

      if (ex.exercise_family && ex.exercise_family === original.exercise_family) {
        score += 50;
        reasons.push("Misma familia de ejercicio");
      }
      if (ex.movement_pattern === original.movement_pattern) {
        score += 30;
        reasons.push(`Mismo patrón: ${ex.movement_pattern}`);
      }
      if (ex.primary_submuscle === original.primary_submuscle && original.primary_submuscle) {
        score += 20;
        reasons.push("Mismo foco muscular");
      }
      if (ex.exercise_type === original.exercise_type) {
        score += 10;
      }
      if (ex.equipment === original.equipment) {
        score += 5;
      }

      const pref = userPrefs.find(
        (p) => p.preference_type === "PREFER" && (p.exercise_id === ex.id || p.exercise_family === ex.exercise_family)
      );
      if (pref) {
        score += 25;
        reasons.push("Preferencia guardada");
      }

      if (constraints.reason === "EQUIPMENT_BUSY" || constraints.reason === "NOT_AVAILABLE") {
        if (normalizeEquipment(ex.equipment) !== normalizeEquipment(original.equipment)) {
          reasons.push("Alternativa con equipo diferente");
        }
      }
      if (constraints.reason === "TOO_HARD" && ex.difficulty === "BEGINNER") {
        score += 15;
        reasons.push("Versión más accesible");
      }

      const displayName =
        ex.translations?.find((t) => t.locale === locale)?.name ??
        ex.translations?.find((t) => t.locale === "en")?.name ??
        ex.name;

      scored.push({
        exercise: ex,
        score,
        explanation: reasons.length > 0 ? reasons.join(". ") : "Alternativa similar",
        display_name: displayName
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }
}
