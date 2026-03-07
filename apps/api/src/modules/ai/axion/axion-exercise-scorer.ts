/**
 * AXION v1.1 - Exercise selection scoring
 * Score candidates: movement match, submuscle match, effectiveness, prefer boost, redundancy penalty, rotation penalty.
 * Pattern redundancy guard: penalize 3rd+ compound of same movement pattern.
 */

import type { ExerciseWithTaxonomy, SlotConstraint } from "./axion-types";
import type { ExerciseDifficulty, MuscleGroup, Submuscle, MovementPattern, ExerciseType } from "@prisma/client";

const EQUIPMENT_ALIASES: Record<string, string[]> = {
  barbell: ["barbell", "barra", "Barra"],
  dumbbell: ["dumbbell", "mancuernas", "Mancuernas"],
  kettlebell: ["kettlebell", "Kettlebell"],
  "body weight": ["body weight", "bodyweight", "peso corporal", "Bodyweight"],
  cable: ["cable", "polea", "Polea"],
  machine: ["machine", "máquina", "maquina", "Máquina"],
  "smith machine": ["smith machine", "máquina smith", "Smith"]
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
  available: string[]
): boolean {
  if (available.length === 0) return true;
  const eq = normalizeEquipment(exEquipment);
  const availNorm = available.map((a) => normalizeEquipment(a));
  return availNorm.some((a) => eq === a || eq.includes(a));
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

export type ScorerContext = {
  equipment: string[];
  userLevel: ExerciseDifficulty | undefined;
  avoidIds: Set<string>;
  preferIds: Set<string>;
  preferFamilies: Set<string>;
  recentlyUsedIds: Set<string>;
  /** Pattern redundancy guard: caller must pass and update when selecting compounds */
  patternCounts?: Map<MovementPattern, number>;
};

export function scoreExercise(
  ex: ExerciseWithTaxonomy,
  slot: SlotConstraint,
  context: ScorerContext
): number {
  if (context.avoidIds.has(ex.id)) return -999;
  if (!equipmentMatches(ex.equipment, context.equipment)) return -999;
  if (!levelCompatible(ex.difficulty, context.userLevel)) return -999;

  // Pattern redundancy guard: if compound and already 2+ of same movement pattern, penalize heavily
  if (ex.exercise_type === "COMPOUND" && ex.movement_pattern && context.patternCounts) {
    const count = context.patternCounts.get(ex.movement_pattern) ?? 0;
    if (count >= 2) return -999;
  }

  let score = 0;

  // Movement match
  if (slot.movement_pattern && ex.movement_pattern === slot.movement_pattern) {
    score += 40;
  }

  // Submuscle match
  if (slot.primary_submuscle && ex.primary_submuscle === slot.primary_submuscle) {
    score += 35;
  }

  // Exercise type match
  if (slot.exercise_type && ex.exercise_type === slot.exercise_type) {
    score += 15;
  }

  // Effectiveness: compound > compound machine > isolation
  if (ex.exercise_type === "COMPOUND") {
    score += 20;
  } else if (ex.equipment?.toLowerCase().includes("machine")) {
    score += 10;
  }

  // Prefer boost
  if (context.preferIds.has(ex.id)) score += 30;
  if (ex.exercise_family && context.preferFamilies.has(ex.exercise_family)) score += 25;

  // Redundancy penalty (same family repeated) - applied by caller when selecting multiple
  // Rotation penalty (used recently) - reduced for anchors
  if (context.recentlyUsedIds.has(ex.id)) {
    score -= slot.is_anchor ? 15 : 40;
  }

  return score;
}

export function selectBestExercise(
  candidates: ExerciseWithTaxonomy[],
  slot: SlotConstraint,
  context: ScorerContext,
  excludeIds: Set<string>
): ExerciseWithTaxonomy | null {
  const filtered = candidates.filter((ex) => !excludeIds.has(ex.id));
  if (filtered.length === 0) return null;

  let best: ExerciseWithTaxonomy | null = null;
  let bestScore = -Infinity;

  for (const ex of filtered) {
    const s = scoreExercise(ex, slot, context);
    if (s > bestScore && s >= 0) {
      bestScore = s;
      best = ex;
    }
  }

  return best;
}
