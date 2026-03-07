/**
 * AXION Routine Generator v1 - Types
 * Deterministic rules engine for 4/5/6 day routines.
 */

import type { MuscleGroup, Submuscle, MovementPattern, ExerciseType, ExerciseDifficulty } from "@prisma/client";

export type AxionGoal = "STRENGTH" | "HYPERTROPHY" | "FAT_LOSS" | "ENDURANCE";
export type AxionLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type AxionPriorityArea = "BALANCED" | "UPPER_BODY" | "LOWER_BODY";

/** Day types for full-week routines */
export type AxionDayType = "PUSH" | "PULL" | "LEGS" | "UPPER" | "LOWER" | "FULL";

/** Day focus for single-day workouts (user-facing) */
export type AxionDayFocus =
  | "CHEST"
  | "BACK"
  | "LEGS"
  | "SHOULDERS"
  | "PUSH"
  | "PULL"
  | "UPPER"
  | "LOWER";

/** Internal day types including single-day variants */
export type AxionDayTypeInternal =
  | AxionDayType
  | "CHEST_TRICEPS"
  | "BACK_BICEPS"
  | "LEGS_FULL"
  | "SHOULDERS_CORE"
  | "LOWER_QUAD_FOCUS"
  | "LOWER_GLUTE_HAM_FOCUS";

/** Map dayFocus → internal day type */
export const DAY_FOCUS_TO_INTERNAL: Record<AxionDayFocus, AxionDayTypeInternal> = {
  CHEST: "CHEST_TRICEPS",
  BACK: "BACK_BICEPS",
  LEGS: "LEGS_FULL",
  SHOULDERS: "SHOULDERS_CORE",
  PUSH: "PUSH",
  PULL: "PULL",
  UPPER: "UPPER",
  LOWER: "LOWER"
};

export type AxionInput = {
  goal: AxionGoal;
  level: AxionLevel;
  sex?: "MALE" | "FEMALE" | "PREFER_NOT";
  priority_area: AxionPriorityArea;
  days_per_week: 4 | 5 | 6;
  session_duration_mode: "AUTO" | "MANUAL";
  session_minutes?: 45 | 60 | 75 | 90;
  equipment_available: string[];
  userId?: string;
  /** Optional: last 4-8 weeks for rotation + fatigue signals */
  history?: {
    recent_exercise_ids?: string[];
    fatigue_signals?: boolean;
  };
};

/** Submuscles targeted per day type (includes single-day internal types) */
export const DAY_TYPE_SUBMUSCLES: Record<string, Submuscle[]> = {
  PUSH: [
    "UPPER_CHEST",
    "MID_CHEST",
    "LOWER_CHEST",
    "ANTERIOR_DELTOID",
    "LATERAL_DELTOID",
    "TRICEPS"
  ],
  PULL: ["LATS", "UPPER_BACK", "MID_BACK", "LOWER_BACK", "TRAPS", "REAR_DELTOID", "BICEPS"],
  LEGS: ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "ABS", "OBLIQUES", "ERECTORS"],
  UPPER: [
    "UPPER_CHEST",
    "MID_CHEST",
    "LOWER_CHEST",
    "LATS",
    "UPPER_BACK",
    "MID_BACK",
    "TRAPS",
    "ANTERIOR_DELTOID",
    "LATERAL_DELTOID",
    "REAR_DELTOID",
    "BICEPS",
    "TRICEPS"
  ],
  LOWER: ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "ABS", "OBLIQUES", "ERECTORS"],
  FULL: [
    "UPPER_CHEST",
    "MID_CHEST",
    "LOWER_CHEST",
    "LATS",
    "UPPER_BACK",
    "TRAPS",
    "ANTERIOR_DELTOID",
    "LATERAL_DELTOID",
    "REAR_DELTOID",
    "BICEPS",
    "TRICEPS",
    "QUADS",
    "HAMSTRINGS",
    "GLUTES",
    "CALVES",
    "ABS",
    "OBLIQUES",
    "ERECTORS"
  ],
  CHEST_TRICEPS: ["UPPER_CHEST", "MID_CHEST", "LOWER_CHEST", "ANTERIOR_DELTOID", "LATERAL_DELTOID", "TRICEPS"],
  BACK_BICEPS: ["LATS", "UPPER_BACK", "MID_BACK", "LOWER_BACK", "TRAPS", "REAR_DELTOID", "BICEPS"],
  LEGS_FULL: ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "ABS", "OBLIQUES", "ERECTORS"],
  SHOULDERS_CORE: ["ANTERIOR_DELTOID", "LATERAL_DELTOID", "REAR_DELTOID", "TRAPS", "ABS", "OBLIQUES"],
  LOWER_QUAD_FOCUS: ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES"],
  LOWER_GLUTE_HAM_FOCUS: ["GLUTES", "HAMSTRINGS", "QUADS", "CALVES"]
};

/** Muscle groups per day type */
export const DAY_TYPE_MUSCLES: Record<string, MuscleGroup[]> = {
  PUSH: ["CHEST", "SHOULDERS", "TRICEPS"],
  PULL: ["BACK", "BICEPS"],
  LEGS: ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE"],
  UPPER: ["CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS"],
  LOWER: ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE"],
  FULL: ["CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS", "QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE"],
  CHEST_TRICEPS: ["CHEST", "SHOULDERS", "TRICEPS"],
  BACK_BICEPS: ["BACK", "BICEPS"],
  LEGS_FULL: ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE"],
  SHOULDERS_CORE: ["SHOULDERS", "CORE"],
  LOWER_QUAD_FOCUS: ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES"],
  LOWER_GLUTE_HAM_FOCUS: ["GLUTES", "HAMSTRINGS", "QUADS", "CALVES"]
};

/** Movement patterns per day type */
export const DAY_TYPE_PATTERNS: Record<string, MovementPattern[]> = {
  PUSH: ["PUSH", "ISOLATION"],
  PULL: ["PULL", "ISOLATION"],
  LEGS: ["SQUAT", "HINGE", "LUNGE", "ISOLATION"],
  UPPER: ["PUSH", "PULL", "ISOLATION"],
  LOWER: ["SQUAT", "HINGE", "LUNGE", "ISOLATION"],
  FULL: ["PUSH", "PULL", "SQUAT", "HINGE", "LUNGE", "CORE", "ISOLATION"],
  CHEST_TRICEPS: ["PUSH", "ISOLATION"],
  BACK_BICEPS: ["PULL", "ISOLATION"],
  LEGS_FULL: ["SQUAT", "HINGE", "LUNGE", "ISOLATION"],
  SHOULDERS_CORE: ["PUSH", "PULL", "ISOLATION", "CORE"],
  LOWER_QUAD_FOCUS: ["SQUAT", "HINGE", "LUNGE", "ISOLATION"],
  LOWER_GLUTE_HAM_FOCUS: ["HINGE", "CORE", "ISOLATION"]
};

export type ExerciseWithTaxonomy = {
  id: string;
  name: string;
  muscle_group: string;
  sub_muscle: string | null;
  equipment: string | null;
  primary_muscle: MuscleGroup | null;
  primary_submuscle: Submuscle | null;
  secondary_muscles?: MuscleGroup[];
  movement_pattern: MovementPattern | null;
  exercise_type: ExerciseType | null;
  difficulty: ExerciseDifficulty | null;
  exercise_family: string | null;
};

export type SlotConstraint = {
  exercise_family?: string;
  movement_pattern?: MovementPattern;
  primary_submuscle?: Submuscle;
  exercise_type?: ExerciseType;
  is_anchor?: boolean;
};

export type LoadPreset = {
  reps: { min: number; max: number };
  sets: number;
  restSeconds: number;
  /** RIR: 0 = failure, 1-3 = close to failure */
  rirMin: number;
  rirMax: number;
  /** Compounds: never RIR 0. Isolations: RIR 0 only on last set of small muscle if fatigue ok */
  allowRir0OnLastIsolation?: boolean;
};

/** Warmup block for every workout */
export type WarmupBlock = {
  generalWarmupMinutes: number;
  mobilityMinutes: number;
  mobilityFocus: string[];
  rampUpSets?: Array<{ weightKg?: number; reps: number; rpe?: number }>;
  firstCompoundExerciseName?: string;
};

/** Check-in context from weekly recovery feedback */
export type CheckInContext = {
  readinessModifier: number;
  blockVolumeIncreases: boolean;
  avoidOverheadPressing: boolean;
  reduceSquatVolume: boolean;
  reduceHingeCompounds: boolean;
};

/** Single-day workout input */
export type AxionSingleDayInput = {
  goal: AxionGoal;
  level: AxionLevel;
  sex?: "MALE" | "FEMALE" | "PREFER_NOT";
  dayFocus: AxionDayFocus;
  durationMinutes: 45 | 60 | 75 | 90;
  equipment_available: string[];
  userId?: string;
  locale?: "es" | "en";
  history?: { recent_exercise_ids?: string[] };
  checkInContext?: CheckInContext;
};

/** Single-day workout output */
export type AxionSingleDayOutput = {
  dayType: AxionDayTypeInternal;
  warmup: WarmupBlock;
  exercises: Array<{
    exercise_id: string;
    exercise_name: string;
    exercise_type: "COMPOUND" | "ISOLATION";
    is_anchor?: boolean;
    target_sets: number;
    rep_range_min: number;
    rep_range_max: number;
    rest_seconds: number;
    rir_min: number;
    rir_max: number;
    allow_rir_0_on_last_set?: boolean;
    progressionRule?: "DOUBLE_PROGRESSION";
    nextSuggestion?: {
      type: "ADD_REP" | "INCREASE_LOAD" | "MAINTAIN" | "DELOAD";
      value?: number;
    };
  }>;
  cardio?: {
    type: "INCLINE_WALK" | "MODERATE_INTERVALS";
    duration_min: number;
    description: string;
  };
  metadata: {
    estimatedDurationMinutes: number;
    weeklyTargets: Record<string, number>;
    effectiveVolumePerSubmuscle?: Record<string, number>;
    warnings: string[];
    anchors: string[];
  };
};
