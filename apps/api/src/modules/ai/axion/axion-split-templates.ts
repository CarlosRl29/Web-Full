/**
 * AXION v1 - Split templates by days_per_week + priority_area
 */

import type { AxionDayTypeInternal, AxionPriorityArea } from "./axion-types";

export type SplitTemplate = {
  days: AxionDayTypeInternal[][];
  labels: string[];
};

/** 4 days */
const SPLIT_4_BALANCED: SplitTemplate = {
  days: [["UPPER"], ["LOWER"], ["UPPER"], ["LOWER"]],
  labels: ["Día A", "Día B", "Día C", "Día D"]
};
/** LOWER_BODY: alternate quad focus and glute/ham focus */
const SPLIT_4_LOWER: SplitTemplate = {
  days: [["LOWER_QUAD_FOCUS"], ["UPPER"], ["LOWER_GLUTE_HAM_FOCUS"], ["UPPER"]],
  labels: ["Día A", "Día B", "Día C", "Día D"]
};
const SPLIT_4_UPPER: SplitTemplate = {
  days: [["UPPER"], ["LOWER"], ["UPPER"], ["UPPER"]],
  labels: ["Día A", "Día B", "Día C", "Día D"]
};

/** 5 days */
const SPLIT_5_BALANCED: SplitTemplate = {
  days: [["PUSH"], ["PULL"], ["LEGS"], ["UPPER"], ["LOWER"]],
  labels: ["Día A", "Día B", "Día C", "Día D", "Día E"]
};
const SPLIT_5_LOWER: SplitTemplate = {
  days: [["LOWER_QUAD_FOCUS"], ["UPPER"], ["LOWER_GLUTE_HAM_FOCUS"], ["UPPER"], ["LOWER_QUAD_FOCUS"]],
  labels: ["Día A", "Día B", "Día C", "Día D", "Día E"]
};
const SPLIT_5_UPPER: SplitTemplate = {
  days: [["PUSH"], ["PULL"], ["UPPER"], ["UPPER"], ["LOWER"]],
  labels: ["Día A", "Día B", "Día C", "Día D", "Día E"]
};

/** 6 days */
const SPLIT_6_BALANCED: SplitTemplate = {
  days: [["PUSH"], ["PULL"], ["LEGS"], ["PUSH"], ["PULL"], ["LEGS"]],
  labels: ["Día A", "Día B", "Día C", "Día D", "Día E", "Día F"]
};
const SPLIT_6_LOWER: SplitTemplate = {
  days: [["LOWER_QUAD_FOCUS"], ["UPPER"], ["LOWER_GLUTE_HAM_FOCUS"], ["UPPER"], ["LOWER_QUAD_FOCUS"], ["UPPER"]],
  labels: ["Día A", "Día B", "Día C", "Día D", "Día E", "Día F"]
};
const SPLIT_6_UPPER: SplitTemplate = {
  days: [["PUSH"], ["PULL"], ["UPPER"], ["PUSH"], ["PULL"], ["UPPER"]],
  labels: ["Día A", "Día B", "Día C", "Día D", "Día E", "Día F"]
};

export function getSplitTemplate(
  daysPerWeek: 4 | 5 | 6,
  priorityArea: AxionPriorityArea
): SplitTemplate {
  const key = `${daysPerWeek}_${priorityArea}`;
  const map: Record<string, SplitTemplate> = {
    "4_BALANCED": SPLIT_4_BALANCED,
    "4_LOWER_BODY": SPLIT_4_LOWER,
    "4_UPPER_BODY": SPLIT_4_UPPER,
    "5_BALANCED": SPLIT_5_BALANCED,
    "5_LOWER_BODY": SPLIT_5_LOWER,
    "5_UPPER_BODY": SPLIT_5_UPPER,
    "6_BALANCED": SPLIT_6_BALANCED,
    "6_LOWER_BODY": SPLIT_6_LOWER,
    "6_UPPER_BODY": SPLIT_6_UPPER
  };
  return map[key] ?? SPLIT_4_BALANCED;
}
