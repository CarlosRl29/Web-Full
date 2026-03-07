/**
 * AXION v1 - Warmup protocol
 * Every workout: general warmup 5-8 min, mobility 3-5 min, ramp-up sets for first compound.
 */

import type { AxionDayTypeInternal } from "./axion-types";
import type { WarmupBlock } from "./axion-types";

const MOBILITY_BY_DAY_TYPE: Record<string, string[]> = {
  PUSH: ["Pecho", "Hombros", "Tríceps", "Movilidad escapular"],
  PULL: ["Espalda", "Bíceps", "Hombros posteriores", "Movilidad de cadera"],
  LEGS: ["Cadera", "Cuádriceps", "Isquiotibiales", "Tobillos"],
  LOWER: ["Cadera", "Cuádriceps", "Isquiotibiales", "Tobillos"],
  LEGS_FULL: ["Cadera", "Cuádriceps", "Isquiotibiales", "Tobillos"],
  LOWER_QUAD_FOCUS: ["Cadera", "Cuádriceps", "Isquiotibiales", "Tobillos"],
  LOWER_GLUTE_HAM_FOCUS: ["Cadera", "Glúteos", "Isquiotibiales", "Tobillos"],
  UPPER: ["Pecho", "Espalda", "Hombros", "Movilidad escapular"],
  CHEST_TRICEPS: ["Pecho", "Hombros", "Tríceps", "Movilidad escapular"],
  BACK_BICEPS: ["Espalda", "Bíceps", "Hombros posteriores"],
  SHOULDERS_CORE: ["Hombros", "Core", "Movilidad escapular", "Cadera"]
};

export function buildWarmupBlock(
  dayType: AxionDayTypeInternal,
  firstCompoundName?: string
): WarmupBlock {
  const mobilityFocus = MOBILITY_BY_DAY_TYPE[dayType] ?? ["General"];
  return {
    generalWarmupMinutes: 6,
    mobilityMinutes: 4,
    mobilityFocus,
    firstCompoundExerciseName: firstCompoundName,
    rampUpSets: firstCompoundName
      ? [
          { reps: 10, rpe: 4 },
          { reps: 8, rpe: 5 },
          { reps: 5, rpe: 6 }
        ]
      : undefined
  };
}
