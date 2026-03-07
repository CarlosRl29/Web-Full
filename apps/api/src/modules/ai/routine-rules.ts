/**
 * Rule engine for training safety.
 * All routines must pass these rules before being accepted.
 */

import type { AiRoutineDraft, AiRoutineDraftDay, AiRoutineDraftExercise } from "@gym/shared";
import type { ExerciseLibraryItem } from "./exercise-library.service";

export type UserContext = {
  experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  goal: "STRENGTH" | "HYPERTROPHY" | "MIXED";
  equipment: string[];
  injuries?: string;
  disabledMovements?: string[];
  sessionMinutes?: number;
  /** Curated knowledge snippets from RAG (under ~2500 chars total) */
  knowledgeSnippets?: string[];
};

export type RuleResult = {
  passed: boolean;
  errors: string[];
  warnings: string[];
};

/** Weekly volume limits per muscle group (sets per week) */
const VOLUME_LIMITS: Record<string, { min: number; max: number }> = {
  BEGINNER: { min: 6, max: 12 },
  INTERMEDIATE: { min: 10, max: 20 },
  ADVANCED: { min: 14, max: 25 }
};

/** Max exercises per session by level */
const MAX_EXERCISES_PER_SESSION: Record<string, number> = {
  BEGINNER: 6,
  INTERMEDIATE: 7,
  ADVANCED: 8
};

/** Min exercises per session */
const MIN_EXERCISES_PER_SESSION = 2;

/** Max sessions per week */
const MAX_SESSIONS_PER_WEEK = 7;

/** Rep ranges by goal */
const REP_RANGES: Record<string, { min: number; max: number }> = {
  STRENGTH: { min: 4, max: 8 },
  HYPERTROPHY: { min: 8, max: 12 },
  MIXED: { min: 10, max: 15 }
};

/** Rest intervals by goal (seconds) */
const REST_RANGES: Record<string, { min: number; max: number }> = {
  STRENGTH: { min: 90, max: 300 },
  HYPERTROPHY: { min: 60, max: 120 },
  MIXED: { min: 60, max: 150 }
};

/** Injury keywords that should exclude certain movements */
const INJURY_EXCLUSIONS: Record<string, string[]> = {
  shoulder: ["overhead", "press", "military", "ohp", "hombro", "hombros"],
  knee: ["squat", "lunge", "leg extension", "sentadilla", "prensa"],
  back: ["deadlift", "row", "peso muerto", "remo"],
  elbow: ["curl", "extension", "flexión", "extensión"],
  wrist: ["press", "push-up", "flexión"]
};

function extractAllExerciseIds(draft: AiRoutineDraft): string[] {
  const ids: string[] = [];
  for (const day of draft.days) {
    for (const group of day.groups) {
      for (const ex of group.exercises) {
        ids.push(ex.exercise_id);
      }
    }
  }
  return ids;
}

function countSetsPerDay(day: AiRoutineDraftDay): number {
  let total = 0;
  for (const group of day.groups) {
    for (const ex of group.exercises) {
      total += ex.target_sets_per_round * (group.rounds_total ?? 1);
    }
  }
  return total;
}

function getMuscleGroupFromExercise(
  exerciseId: string,
  library: ExerciseLibraryItem[]
): string | null {
  const ex = library.find((e) => e.id === exerciseId);
  return ex?.muscle_group ?? null;
}

/** Validate: no duplicate exercises in the same session */
function ruleNoDuplicateExercisesPerSession(day: AiRoutineDraftDay): RuleResult {
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const group of day.groups) {
    for (const ex of group.exercises) {
      if (seen.has(ex.exercise_id)) {
        errors.push(`Duplicate exercise ${ex.exercise_id} in session ${day.day_label}`);
      }
      seen.add(ex.exercise_id);
    }
  }
  return { passed: errors.length === 0, errors, warnings: [] };
}

/** Validate: max exercises per session */
function ruleMaxExercisesPerSession(
  day: AiRoutineDraftDay,
  context: UserContext
): RuleResult {
  const totalExercises = day.groups.reduce(
    (acc, g) => acc + g.exercises.length,
    0
  );
  const max = MAX_EXERCISES_PER_SESSION[context.experienceLevel] ?? 7;
  const passed = totalExercises <= max && totalExercises >= MIN_EXERCISES_PER_SESSION;
  const errors: string[] = [];
  if (totalExercises > max) {
    errors.push(
      `Too many exercises (${totalExercises}) in ${day.day_label}. Max ${max} for ${context.experienceLevel}.`
    );
  }
  if (totalExercises < MIN_EXERCISES_PER_SESSION) {
    errors.push(
      `Too few exercises (${totalExercises}) in ${day.day_label}. Min ${MIN_EXERCISES_PER_SESSION}.`
    );
  }
  return { passed, errors, warnings: [] };
}

/** Validate: rep ranges match goal */
function ruleRepRangesMatchGoal(
  draft: AiRoutineDraft,
  context: UserContext
): RuleResult {
  const range = REP_RANGES[context.goal] ?? REP_RANGES.MIXED;
  const errors: string[] = [];
  for (const day of draft.days) {
    for (const group of day.groups) {
      for (const ex of group.exercises) {
        if (ex.rep_range_min < range.min || ex.rep_range_max > range.max) {
          errors.push(
            `Rep range ${ex.rep_range_min}-${ex.rep_range_max} for exercise ${ex.exercise_id} outside goal range ${range.min}-${range.max}`
          );
        }
      }
    }
  }
  return { passed: errors.length === 0, errors, warnings: [] };
}

/** Validate: rest intervals match goal */
function ruleRestIntervals(draft: AiRoutineDraft, context: UserContext): RuleResult {
  const range = REST_RANGES[context.goal] ?? REST_RANGES.MIXED;
  const errors: string[] = [];
  for (const day of draft.days) {
    for (const group of day.groups) {
      const rest = group.rest_after_set_seconds ?? group.rest_between_exercises_seconds;
      if (rest != null && (rest < range.min || rest > range.max)) {
        errors.push(
          `Rest ${rest}s in ${day.day_label} outside goal range ${range.min}-${range.max}s`
        );
      }
    }
  }
  return { passed: errors.length === 0, errors, warnings: [] };
}

/** Validate: days count within limit */
function ruleDaysCount(draft: AiRoutineDraft): RuleResult {
  const count = draft.days.length;
  const passed = count >= 1 && count <= MAX_SESSIONS_PER_WEEK;
  const errors: string[] = [];
  if (!passed) {
    errors.push(`Invalid number of days: ${count}. Must be 1-${MAX_SESSIONS_PER_WEEK}.`);
  }
  return { passed, errors, warnings: [] };
}

/** Validate: all exercises exist in library */
function ruleExercisesInLibrary(
  draft: AiRoutineDraft,
  validIds: Set<string>
): RuleResult {
  const ids = extractAllExerciseIds(draft);
  const invalid = ids.filter((id) => !validIds.has(id));
  const passed = invalid.length === 0;
  const errors = invalid.length > 0
    ? [`Invalid/hallucinated exercise IDs: ${invalid.join(", ")}`]
    : [];
  return { passed, errors, warnings: [] };
}

/** Validate: respect injuries - exclude movements that stress injured areas */
function ruleRespectInjuries(
  draft: AiRoutineDraft,
  context: UserContext,
  library: ExerciseLibraryItem[]
): RuleResult {
  const injuries = (context.injuries ?? "").toLowerCase();
  const disabled = context.disabledMovements ?? [];
  if (!injuries && disabled.length === 0) {
    return { passed: true, errors: [], warnings: [] };
  }

  const errors: string[] = [];
  for (const [area, keywords] of Object.entries(INJURY_EXCLUSIONS)) {
    if (!injuries.includes(area) && !disabled.some((d) => d.toLowerCase().includes(area))) {
      continue;
    }
    for (const day of draft.days) {
      for (const group of day.groups) {
        for (const ex of group.exercises) {
          const item = library.find((l) => l.id === ex.exercise_id);
          const name = (item?.name ?? "").toLowerCase();
          if (keywords.some((kw) => name.includes(kw))) {
            errors.push(
              `Exercise "${item?.name ?? ex.exercise_id}" may stress ${area}. User reported injuries.`
            );
          }
        }
      }
    }
  }
  return { passed: errors.length === 0, errors, warnings: [] };
}

/** Run all rules and return combined result */
export function validateRoutineRules(
  draft: AiRoutineDraft,
  context: UserContext,
  library: ExerciseLibraryItem[],
  validExerciseIds: Set<string>
): RuleResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  const rules = [
    () => ruleDaysCount(draft),
    () => ruleExercisesInLibrary(draft, validExerciseIds),
    () => ruleRespectInjuries(draft, context, library),
    ...draft.days.map((day) => () => ruleNoDuplicateExercisesPerSession(day)),
    ...draft.days.map((day) => () => ruleMaxExercisesPerSession(day, context)),
    () => ruleRepRangesMatchGoal(draft, context),
    () => ruleRestIntervals(draft, context)
  ];

  for (const rule of rules) {
    const result = rule();
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    passed: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}
