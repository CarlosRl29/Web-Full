/**
 * AXION v1 - MEV/MAV/MRV weekly volume presets
 * Sets per week per submuscle, by goal + level.
 */

import type { Submuscle } from "@prisma/client";
import type { AxionGoal, AxionLevel, AxionPriorityArea } from "./axion-types";

/** MEV = Minimum Effective Volume, MAV = Maximum Adaptive Volume, MRV = Maximum Recoverable Volume */
type VolumeTier = "MEV" | "MAV" | "MRV";

/** Hypertrophy research: large muscles 10-20 sets/wk, small 8-12. Default balanced targets. */
const BALANCED_WEEKLY_TARGETS: Record<string, number> = {
  CHEST: 14,
  BACK: 16,
  QUADS: 14,
  GLUTES: 14,
  HAMSTRINGS: 12,
  SHOULDERS: 12,
  BICEPS: 10,
  TRICEPS: 10,
  CALVES: 10
};

/** Base weekly sets per submuscle (MEV low, MAV mid, MRV high) */
const SUBMUSCLE_VOLUME: Record<
  Submuscle,
  Record<VolumeTier, number>
> = {
  UPPER_CHEST: { MEV: 4, MAV: 8, MRV: 12 },
  MID_CHEST: { MEV: 4, MAV: 8, MRV: 12 },
  LOWER_CHEST: { MEV: 2, MAV: 4, MRV: 6 },
  LATS: { MEV: 6, MAV: 12, MRV: 18 },
  UPPER_BACK: { MEV: 4, MAV: 8, MRV: 12 },
  MID_BACK: { MEV: 4, MAV: 8, MRV: 12 },
  LOWER_BACK: { MEV: 2, MAV: 4, MRV: 6 },
  TRAPS: { MEV: 2, MAV: 4, MRV: 6 },
  ANTERIOR_DELTOID: { MEV: 4, MAV: 8, MRV: 12 },
  LATERAL_DELTOID: { MEV: 4, MAV: 8, MRV: 12 },
  REAR_DELTOID: { MEV: 4, MAV: 8, MRV: 12 },
  QUADS: { MEV: 6, MAV: 12, MRV: 18 },
  HAMSTRINGS: { MEV: 4, MAV: 8, MRV: 12 },
  GLUTES: { MEV: 4, MAV: 8, MRV: 12 },
  CALVES: { MEV: 4, MAV: 8, MRV: 12 },
  ABS: { MEV: 4, MAV: 8, MRV: 12 },
  OBLIQUES: { MEV: 2, MAV: 4, MRV: 6 },
  ERECTORS: { MEV: 2, MAV: 4, MRV: 6 },
  BICEPS: { MEV: 4, MAV: 8, MRV: 12 },
  TRICEPS: { MEV: 4, MAV: 8, MRV: 12 }
};

export function getBalancedWeeklyTargets(): Record<string, number> {
  return { ...BALANCED_WEEKLY_TARGETS };
}

/** LOWER_BODY specialization: Quads 14, Glutes 18, Hamstrings 14 */
export function getLowerBodyWeeklyTargets(): Record<string, number> {
  return {
    ...BALANCED_WEEKLY_TARGETS,
    QUADS: 14,
    GLUTES: 18,
    HAMSTRINGS: 14
  };
}

/** Level → volume tier: Beginner uses MEV→low MAV, Intermediate MAV, Advanced high MAV (avoid MRV unless special) */
function getVolumeTier(level: AxionLevel): VolumeTier {
  switch (level) {
    case "BEGINNER":
      return "MEV";
    case "INTERMEDIATE":
      return "MAV";
    case "ADVANCED":
      return "MAV";
    default:
      return "MAV";
  }
}

/** Priority area weighting: BALANCED 50/50, LOWER_BODY 60/40 lower, UPPER_BODY 60/40 upper */
const LOWER_SUBMUSCLES: Submuscle[] = [
  "QUADS",
  "HAMSTRINGS",
  "GLUTES",
  "CALVES",
  "ABS",
  "OBLIQUES",
  "ERECTORS"
];
const UPPER_SUBMUSCLES: Submuscle[] = [
  "UPPER_CHEST",
  "MID_CHEST",
  "LOWER_CHEST",
  "LATS",
  "UPPER_BACK",
  "MID_BACK",
  "LOWER_BACK",
  "TRAPS",
  "ANTERIOR_DELTOID",
  "LATERAL_DELTOID",
  "REAR_DELTOID",
  "BICEPS",
  "TRICEPS"
];

export function getWeeklyTargetSets(
  goal: AxionGoal,
  level: AxionLevel,
  priority_area: AxionPriorityArea
): Record<Submuscle, number> {
  const tier = getVolumeTier(level);
  const result: Partial<Record<Submuscle, number>> = {};

  for (const sub of Object.keys(SUBMUSCLE_VOLUME) as Submuscle[]) {
    let base = SUBMUSCLE_VOLUME[sub]?.[tier] ?? 6;
    if (priority_area === "LOWER_BODY" && LOWER_SUBMUSCLES.includes(sub)) {
      base = Math.ceil(base * 1.2);
    } else if (priority_area === "LOWER_BODY" && UPPER_SUBMUSCLES.includes(sub)) {
      base = Math.floor(base * 0.8);
    } else if (priority_area === "UPPER_BODY" && UPPER_SUBMUSCLES.includes(sub)) {
      base = Math.ceil(base * 1.2);
    } else if (priority_area === "UPPER_BODY" && LOWER_SUBMUSCLES.includes(sub)) {
      base = Math.floor(base * 0.8);
    }
    result[sub] = Math.max(0, base);
  }

  return result as Record<Submuscle, number>;
}
