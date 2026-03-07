/**
 * AXION v1 - Load presets (sets/reps/rest/RIR) by goal
 * HYPERTROPHY: compounds RIR 1-3, isolations RIR 0-2, RIR 0 only on last set of small muscle if fatigue ok
 */

import type { AxionGoal, AxionLevel } from "./axion-types";
import type { LoadPreset } from "./axion-types";

/** Goal presets - STRENGTH 3-6 reps/3-6 sets, HYPERTROPHY 6-12/3-4, FAT_LOSS 8-15/2-4, ENDURANCE 15-25/2-4 */
const GOAL_PRESETS: Record<
  AxionGoal,
  { compound: LoadPreset; isolation: LoadPreset }
> = {
  STRENGTH: {
    compound: {
      reps: { min: 3, max: 6 },
      sets: 4,
      restSeconds: 150,
      rirMin: 2,
      rirMax: 3
    },
    isolation: {
      reps: { min: 4, max: 8 },
      sets: 3,
      restSeconds: 90,
      rirMin: 2,
      rirMax: 3
    }
  },
  HYPERTROPHY: {
    compound: {
      reps: { min: 6, max: 12 },
      sets: 4,
      restSeconds: 90,
      rirMin: 1,
      rirMax: 3,
      allowRir0OnLastIsolation: false
    },
    isolation: {
      reps: { min: 8, max: 15 },
      sets: 3,
      restSeconds: 60,
      rirMin: 0,
      rirMax: 2,
      allowRir0OnLastIsolation: true
    }
  },
  FAT_LOSS: {
    compound: {
      reps: { min: 8, max: 15 },
      sets: 3,
      restSeconds: 75,
      rirMin: 1,
      rirMax: 3
    },
    isolation: {
      reps: { min: 10, max: 15 },
      sets: 2,
      restSeconds: 45,
      rirMin: 1,
      rirMax: 3
    }
  },
  ENDURANCE: {
    compound: {
      reps: { min: 15, max: 25 },
      sets: 3,
      restSeconds: 45,
      rirMin: 2,
      rirMax: 2
    },
    isolation: {
      reps: { min: 15, max: 25 },
      sets: 2,
      restSeconds: 30,
      rirMin: 2,
      rirMax: 2
    }
  }
};

export function getLoadPreset(
  goal: AxionGoal,
  isCompound: boolean
): LoadPreset {
  const preset = GOAL_PRESETS[goal] ?? GOAL_PRESETS.HYPERTROPHY;
  return isCompound ? preset.compound : preset.isolation;
}

/** Adjust sets by session minutes (45 reduces, 90 allows +1) */
export function adjustSetsForSession(
  baseSets: number,
  sessionMinutes: number
): number {
  if (sessionMinutes <= 45) return Math.max(2, baseSets - 1);
  if (sessionMinutes >= 90) return Math.min(5, baseSets + 1);
  return baseSets;
}

/** Apply check-in readiness modifier and pain constraints to sets */
export function adjustSetsForCheckIn(
  baseSets: number,
  options: {
    readinessModifier?: number;
    blockVolumeIncreases?: boolean;
    avoidOverheadPressing?: boolean;
    reduceSquatVolume?: boolean;
    reduceHingeCompounds?: boolean;
    movementPattern?: string;
    exerciseFamily?: string | null;
    primarySubmuscle?: string | null;
  }
): number {
  let sets = baseSets;
  const { readinessModifier = 0, blockVolumeIncreases } = options;

  if (readinessModifier < 0) {
    sets = Math.max(2, Math.round(sets * (1 + readinessModifier)));
  } else if (readinessModifier > 0 && !blockVolumeIncreases) {
    sets = Math.min(5, Math.round(sets * (1 + readinessModifier)));
  }

  const isOverhead =
    options.exerciseFamily === "ohp" ||
    (options.movementPattern === "PUSH" &&
      (options.exerciseFamily === "press" ||
        options.primarySubmuscle === "ANTERIOR_DELTOID"));
  if (options.avoidOverheadPressing && isOverhead) {
    sets = Math.max(2, sets - 1);
  }
  if (options.reduceSquatVolume && options.movementPattern === "SQUAT") {
    sets = Math.max(2, sets - 1);
  }
  if (options.reduceHingeCompounds && options.movementPattern === "HINGE") {
    sets = Math.max(2, sets - 1);
  }

  return sets;
}
