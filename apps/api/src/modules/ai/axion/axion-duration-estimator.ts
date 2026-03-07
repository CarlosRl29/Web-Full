/**
 * AXION v1.1 - Duration Estimator
 * Warmup 8-15 min by day type. Session = warmup + per-set time + rest + transitions.
 */

import type { AxionDayTypeInternal } from "./axion-types";
import type { LoadPreset } from "./axion-types";

/** Per set time: compound 35-50s, isolation 25-40s (seconds) */
const PER_SET_TIME = {
  COMPOUND: { min: 35, max: 50 },
  ISOLATION: { min: 25, max: 40 }
};

/** Transition time between exercises: 20-40 seconds */
const TRANSITION_SECONDS = { min: 20, max: 40 };

/** Estimate warmup minutes by day type. Full body/lower = more, upper = less. */
export function estimateWarmupMinutes(dayType: AxionDayTypeInternal): number {
  switch (dayType) {
    case "FULL":
    case "LEGS":
    case "LOWER":
    case "LEGS_FULL":
    case "LOWER_QUAD_FOCUS":
    case "LOWER_GLUTE_HAM_FOCUS":
      return 12;
    case "UPPER":
    case "PUSH":
    case "PULL":
    case "CHEST_TRICEPS":
    case "BACK_BICEPS":
    case "SHOULDERS_CORE":
      return 10;
    default:
      return 8;
  }
}

export type ExerciseForDuration = {
  exercise_type: "COMPOUND" | "ISOLATION";
  target_sets: number;
  rest_seconds: number;
};

export type RestPresets = {
  restSeconds: number;
};

/** Estimate session duration: warmup + sum(perSetTime * sets) + rest + transitions */
export function estimateSessionMinutes(
  warmupMinutes: number,
  exercises: ExerciseForDuration[],
  restPresets?: RestPresets
): number {
  let totalSeconds = warmupMinutes * 60;

  const avgTransition = (TRANSITION_SECONDS.min + TRANSITION_SECONDS.max) / 2;

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const perSet = ex.exercise_type === "COMPOUND"
      ? (PER_SET_TIME.COMPOUND.min + PER_SET_TIME.COMPOUND.max) / 2
      : (PER_SET_TIME.ISOLATION.min + PER_SET_TIME.ISOLATION.max) / 2;
    const rest = restPresets?.restSeconds ?? ex.rest_seconds;
    const setTime = perSet + rest;
    totalSeconds += ex.target_sets * setTime;
    if (i > 0) totalSeconds += avgTransition;
  }

  return Math.ceil(totalSeconds / 60);
}
