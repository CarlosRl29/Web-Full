/**
 * AXION v1 - Slot templates per day type
 * Big muscles: max 4 exercises/day. Small muscles: max 2 exercises/day.
 * Prefer adding sets (3-4) instead of more exercises.
 */

import type { AxionDayType, AxionDayTypeInternal } from "./axion-types";
import type { Submuscle, MovementPattern, ExerciseType } from "@prisma/client";

export type SlotDef = {
  id: string;
  submuscle: Submuscle;
  movement_pattern?: MovementPattern;
  exercise_type?: ExerciseType;
  is_anchor?: boolean;
  max_exercises: number;
  target_sets: number;
};

/** PUSH: chest slots (2 compound + 1 variant + 1 isolation), triceps (2 isolation), delts (1 isolation if time) */
const PUSH_SLOTS: SlotDef[] = [
  { id: "chest_main", submuscle: "MID_CHEST", movement_pattern: "PUSH", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "chest_variant", submuscle: "UPPER_CHEST", movement_pattern: "PUSH", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 3 },
  { id: "chest_isolation", submuscle: "MID_CHEST", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "delts", submuscle: "LATERAL_DELTOID", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "triceps", submuscle: "TRICEPS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 2, target_sets: 3 }
];

/** PULL: back (2-3 compounds + 1 accessory like facepull), biceps (2 isolation), rear delts/traps 1 slot if time */
const PULL_SLOTS: SlotDef[] = [
  { id: "back_main", submuscle: "LATS", movement_pattern: "PULL", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "back_row", submuscle: "UPPER_BACK", movement_pattern: "PULL", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 4 },
  { id: "back_accessory", submuscle: "REAR_DELTOID", movement_pattern: "PULL", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "biceps", submuscle: "BICEPS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 2, target_sets: 3 }
];

/** LEGS: squat/press slot, hinge slot, unilateral slot, curl/extension slot, calves slot */
const LEGS_SLOTS: SlotDef[] = [
  { id: "quads_main", submuscle: "QUADS", movement_pattern: "SQUAT", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "hinge", submuscle: "HAMSTRINGS", movement_pattern: "HINGE", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 4 },
  { id: "unilateral", submuscle: "QUADS", movement_pattern: "LUNGE", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 3 },
  { id: "leg_curl_ext", submuscle: "HAMSTRINGS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "calves", submuscle: "CALVES", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 4 }
];

/** UPPER: balanced chest/back/delts/arms - condensed PUSH+PULL */
const UPPER_SLOTS: SlotDef[] = [
  { id: "chest", submuscle: "MID_CHEST", movement_pattern: "PUSH", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "back", submuscle: "LATS", movement_pattern: "PULL", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "delts", submuscle: "LATERAL_DELTOID", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "triceps", submuscle: "TRICEPS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "biceps", submuscle: "BICEPS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 }
];

/** LOWER: balanced quads/hinge/glutes/calves */
const LOWER_SLOTS: SlotDef[] = [
  { id: "quads", submuscle: "QUADS", movement_pattern: "SQUAT", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "hinge", submuscle: "HAMSTRINGS", movement_pattern: "HINGE", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 4 },
  { id: "glutes", submuscle: "GLUTES", movement_pattern: "HINGE", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 3 },
  { id: "calves", submuscle: "CALVES", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 4 }
];

/** FULL: minimal per muscle */
const FULL_SLOTS: SlotDef[] = [
  { id: "push_main", submuscle: "MID_CHEST", movement_pattern: "PUSH", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 3 },
  { id: "pull_main", submuscle: "LATS", movement_pattern: "PULL", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 3 },
  { id: "legs_main", submuscle: "QUADS", movement_pattern: "SQUAT", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 3 },
  { id: "core", submuscle: "ABS", movement_pattern: "CORE", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 }
];

/** CHEST_TRICEPS: Chest 4 (compound + secondary + machine/variant + isolation), Triceps 2 (compound accessory + isolation) */
const CHEST_TRICEPS_SLOTS: SlotDef[] = [
  { id: "chest_compound", submuscle: "MID_CHEST", movement_pattern: "PUSH", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "chest_secondary", submuscle: "UPPER_CHEST", movement_pattern: "PUSH", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 3 },
  { id: "chest_variant", submuscle: "MID_CHEST", movement_pattern: "PUSH", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 3 },
  { id: "chest_isolation", submuscle: "MID_CHEST", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "triceps_compound", submuscle: "TRICEPS", movement_pattern: "PUSH", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 3 },
  { id: "triceps_isolation", submuscle: "TRICEPS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 }
];

/** BACK_BICEPS: Back 4 (vertical + horizontal + secondary + accessory), Biceps 2 */
const BACK_BICEPS_SLOTS: SlotDef[] = [
  { id: "back_vertical", submuscle: "LATS", movement_pattern: "PULL", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "back_row", submuscle: "UPPER_BACK", movement_pattern: "PULL", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 4 },
  { id: "back_secondary", submuscle: "MID_BACK", movement_pattern: "PULL", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 3 },
  { id: "back_accessory", submuscle: "REAR_DELTOID", movement_pattern: "PULL", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "biceps_main", submuscle: "BICEPS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "biceps_secondary", submuscle: "BICEPS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 }
];

/** LEGS_FULL: squat, hinge, unilateral, quad iso, ham iso, calves */
const LEGS_FULL_SLOTS: SlotDef[] = [
  { id: "squat", submuscle: "QUADS", movement_pattern: "SQUAT", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "hinge", submuscle: "HAMSTRINGS", movement_pattern: "HINGE", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 4 },
  { id: "unilateral", submuscle: "QUADS", movement_pattern: "LUNGE", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 3 },
  { id: "quad_iso", submuscle: "QUADS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "ham_iso", submuscle: "HAMSTRINGS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "calves", submuscle: "CALVES", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 4 }
];

/** SHOULDERS_CORE: delts 3–4, core 1–2 */
const SHOULDERS_CORE_SLOTS: SlotDef[] = [
  { id: "delts_main", submuscle: "LATERAL_DELTOID", movement_pattern: "PUSH", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "delts_secondary", submuscle: "ANTERIOR_DELTOID", movement_pattern: "PUSH", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 3 },
  { id: "rear_delts", submuscle: "REAR_DELTOID", movement_pattern: "PULL", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "traps", submuscle: "TRAPS", movement_pattern: "PULL", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "core", submuscle: "ABS", movement_pattern: "CORE", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 }
];

/** LOWER_QUAD_FOCUS: Squat, Leg Press, BSS, Leg Extension, Calf Raise */
const LOWER_QUAD_FOCUS_SLOTS: SlotDef[] = [
  { id: "squat", submuscle: "QUADS", movement_pattern: "SQUAT", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "leg_press", submuscle: "QUADS", movement_pattern: "SQUAT", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 4 },
  { id: "unilateral", submuscle: "QUADS", movement_pattern: "LUNGE", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 3 },
  { id: "leg_ext", submuscle: "QUADS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "calves", submuscle: "CALVES", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 4 }
];

/** LOWER_GLUTE_HAM_FOCUS: Hip Thrust, RDL, Glute Bridge, Leg Curl, Abduction */
const LOWER_GLUTE_HAM_FOCUS_SLOTS: SlotDef[] = [
  { id: "hip_thrust", submuscle: "GLUTES", movement_pattern: "HINGE", exercise_type: "COMPOUND", is_anchor: true, max_exercises: 1, target_sets: 4 },
  { id: "rdl", submuscle: "HAMSTRINGS", movement_pattern: "HINGE", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 4 },
  { id: "glute_bridge", submuscle: "GLUTES", movement_pattern: "HINGE", exercise_type: "COMPOUND", max_exercises: 1, target_sets: 3 },
  { id: "leg_curl", submuscle: "HAMSTRINGS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 },
  { id: "abduction", submuscle: "GLUTES", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", max_exercises: 1, target_sets: 3 }
];

export function getSlotTemplatesForDayType(dayType: AxionDayType | AxionDayTypeInternal): SlotDef[] {
  switch (dayType) {
    case "PUSH":
      return PUSH_SLOTS;
    case "PULL":
      return PULL_SLOTS;
    case "LEGS":
      return LEGS_SLOTS;
    case "UPPER":
      return UPPER_SLOTS;
    case "LOWER":
      return LOWER_SLOTS;
    case "FULL":
      return FULL_SLOTS;
    case "CHEST_TRICEPS":
      return CHEST_TRICEPS_SLOTS;
    case "BACK_BICEPS":
      return BACK_BICEPS_SLOTS;
    case "LEGS_FULL":
      return LEGS_FULL_SLOTS;
    case "SHOULDERS_CORE":
      return SHOULDERS_CORE_SLOTS;
    case "LOWER_QUAD_FOCUS":
      return LOWER_QUAD_FOCUS_SLOTS;
    case "LOWER_GLUTE_HAM_FOCUS":
      return LOWER_GLUTE_HAM_FOCUS_SLOTS;
    default:
      return UPPER_SLOTS;
  }
}
