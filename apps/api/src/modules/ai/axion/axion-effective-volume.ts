/**
 * AXION v1.1 - Effective Volume Credits
 * Primary submuscle 1.0, secondary muscles 0.5 each.
 * Aggregate per workout and per week. MAV range with ±15% tolerance.
 */

import type { Submuscle, MuscleGroup } from "@prisma/client";
import { getWeeklyTargetSets } from "./axion-volume-presets";
import type { AxionGoal, AxionLevel, AxionPriorityArea } from "./axion-types";

/** Map MuscleGroup to representative Submuscle for secondary muscle credits */
export const MUSCLE_GROUP_TO_SUBMUSCLE: Record<MuscleGroup, Submuscle> = {
  CHEST: "MID_CHEST",
  BACK: "LATS",
  SHOULDERS: "LATERAL_DELTOID",
  BICEPS: "BICEPS",
  TRICEPS: "TRICEPS",
  QUADS: "QUADS",
  HAMSTRINGS: "HAMSTRINGS",
  GLUTES: "GLUTES",
  CALVES: "CALVES",
  CORE: "ABS"
};

export type ExerciseForVolume = {
  primary_submuscle: Submuscle | null;
  secondary_muscles?: MuscleGroup[];
  exercise_type?: "COMPOUND" | "ISOLATION" | null;
};

export type ExerciseSetEntry = {
  exercise: ExerciseForVolume;
  sets: number;
};

/** Compute effective volume credits for one exercise: primary 1.0, secondary 0.5 each */
export function computeEffectiveVolumeCredits(
  exercise: ExerciseForVolume,
  sets: number
): Map<Submuscle, number> {
  const credits = new Map<Submuscle, number>();

  if (exercise.primary_submuscle) {
    credits.set(exercise.primary_submuscle, (credits.get(exercise.primary_submuscle) ?? 0) + sets * 1.0);
  }

  const secondary = exercise.secondary_muscles ?? [];
  for (const mg of secondary) {
    const sub = MUSCLE_GROUP_TO_SUBMUSCLE[mg];
    if (sub) {
      credits.set(sub, (credits.get(sub) ?? 0) + sets * 0.5);
    }
  }

  return credits;
}

export type WorkoutVolume = Map<Submuscle, number>;

/** Aggregate effective volume credits per workout from exercises */
export function aggregatePerWorkout(exercises: ExerciseSetEntry[]): WorkoutVolume {
  const aggregated = new Map<Submuscle, number>();

  for (const { exercise, sets } of exercises) {
    const credits = computeEffectiveVolumeCredits(exercise, sets);
    for (const [sub, val] of credits) {
      aggregated.set(sub, (aggregated.get(sub) ?? 0) + val);
    }
  }

  return aggregated;
}

export type SessionWithVolume = {
  dayType?: string;
  exercises: ExerciseSetEntry[];
};

/** Aggregate effective volume credits per week from sessions */
export function aggregatePerWeek(sessions: SessionWithVolume[]): WorkoutVolume {
  const weekly = new Map<Submuscle, number>();

  for (const session of sessions) {
    const perWorkout = aggregatePerWorkout(session.exercises);
    for (const [sub, val] of perWorkout) {
      weekly.set(sub, (weekly.get(sub) ?? 0) + val);
    }
  }

  return weekly;
}

export type MAVRange = { min: number; max: number };

/** Get MAV range for submuscle with ±15% tolerance. Uses getWeeklyTargetSets for base. */
export function getMAVRange(
  submuscle: Submuscle,
  level: AxionLevel,
  goal: AxionGoal = "HYPERTROPHY",
  priorityArea: AxionPriorityArea = "BALANCED"
): MAVRange {
  const targets = getWeeklyTargetSets(goal, level, priorityArea);
  const base = targets[submuscle] ?? 8;
  const tolerance = 0.15;
  return {
    min: Math.max(0, Math.floor(base * (1 - tolerance))),
    max: Math.ceil(base * (1 + tolerance))
  };
}
