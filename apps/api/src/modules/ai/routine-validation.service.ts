/**
 * Validation layer: AI → JSON → Schema Validation → Rule Engine → Safety Gate → Accept or Repair
 */

import { BadRequestException, Injectable } from "@nestjs/common";
import {
  aiRoutineDraftSchema,
  type AiRoutineDraft,
  type AiGenerateRoutineResponse
} from "@gym/shared";
import {
  ExerciseLibraryService,
  type ExerciseLibraryItem
} from "./exercise-library.service";
import {
  validateRoutineRules,
  type UserContext,
  type RuleResult
} from "./routine-rules";
import { AiToolsService } from "./ai-tools.service";
import {
  RoutineQualityService,
  type QualityScoreResult
} from "./routine-quality.service";

export type ValidationResult = {
  valid: boolean;
  draft: AiRoutineDraft | null;
  errors: string[];
  repaired: boolean;
};

/** Context required for safety gate - includes daysPerWeek */
export type SafetyPrereqsContext = UserContext & {
  daysPerWeek: number;
};

export type SafetyGateError = {
  code: "missing_fields";
  missing_fields: string[];
  message: string;
};

const MEDICAL_LANGUAGE_REGEX =
  /(diagn[oó]stic|tratamiento|prescrip|medic|dosis|terapia|disease|diagnosis|treat|prescription|therapy|cure|heal)/i;

const DISCLAIMER =
  "Recomendaciones generales de entrenamiento. No constituyen consejo médico. Consulta a un profesional si tienes dolor o lesiones.";

@Injectable()
export class RoutineValidationService {
  constructor(
    private readonly exerciseLibrary: ExerciseLibraryService,
    private readonly aiTools: AiToolsService,
    private readonly qualityService: RoutineQualityService
  ) {}

  /** Step 2.5: Quality scoring - run after rules pass. If score < 70, treat as repair-needed. */
  scoreRoutine(
    draft: AiRoutineDraft,
    context: UserContext,
    library: ExerciseLibraryItem[]
  ): QualityScoreResult {
    return this.qualityService.scoreRoutine(draft, context, library);
  }

  /** Step 1: Schema validation - reject if AI output doesn't match */
  validateSchema(raw: unknown): { success: true; draft: AiRoutineDraft } | { success: false; errors: string[] } {
    const result = aiRoutineDraftSchema.safeParse(raw);
    if (result.success) {
      return { success: true, draft: result.data };
    }
    const errors = result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`
    );
    return { success: false, errors };
  }

  /**
   * AI Safety Gate: assertSafetyPrereqs
   * Requires trainingLevel, goal, daysPerWeek, equipment, injury flags.
   * Throws BadRequestException with structured errors (missing_fields) if any required field is missing.
   */
  assertSafetyPrereqs(ctx: SafetyPrereqsContext): void {
    const missing: string[] = [];

    if (!ctx.experienceLevel || !["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(ctx.experienceLevel)) {
      missing.push("trainingLevel");
    }
    if (!ctx.goal || !["STRENGTH", "HYPERTROPHY", "MIXED"].includes(ctx.goal)) {
      missing.push("goal");
    }
    const days = ctx.daysPerWeek;
    if (days == null || typeof days !== "number" || days < 1 || days > 7) {
      missing.push("daysPerWeek");
    }
    if (!Array.isArray(ctx.equipment)) {
      missing.push("equipment");
    }
    if (ctx.injuries === undefined) {
      missing.push("injury_flags");
    }

    if (missing.length > 0) {
      const error: SafetyGateError = {
        code: "missing_fields",
        missing_fields: missing,
        message: `Safety gate: missing required fields: ${missing.join(", ")}`
      };
      throw new BadRequestException(error);
    }
  }

  /**
   * AI Safety Gate: enforceSafetyLanguage
   * Removes/replaces medical claims and appends disclaimer.
   */
  enforceSafetyLanguage(draft: AiRoutineDraft): AiRoutineDraft {
    const sanitize = (text: string): string => {
      if (MEDICAL_LANGUAGE_REGEX.test(text)) {
        return "Se prioriza una pauta conservadora de entrenamiento general.";
      }
      return text;
    };

    let description = draft.description ?? "";
    description = sanitize(description);

    const disclaimer = ` ${DISCLAIMER}`;
    if (!description.trim().endsWith(DISCLAIMER)) {
      const maxLen = 500 - disclaimer.length;
      const trimmed = description.trim().slice(0, maxLen);
      description = (trimmed + disclaimer).trim();
    }

    const days = draft.days.map((day) => ({
      ...day,
      groups: day.groups.map((group) => ({
        ...group,
        exercises: group.exercises.map((ex) => ({
          ...ex,
          notes: ex.notes ? sanitize(ex.notes) : ex.notes
        }))
      }))
    }));

    return { ...draft, description, days };
  }

  /** Step 2: Rule engine validation */
  validateRules(
    draft: AiRoutineDraft,
    context: UserContext,
    library: ExerciseLibraryItem[],
    validIds: Set<string>
  ): RuleResult {
    return validateRoutineRules(draft, context, library, validIds);
  }

  /** Step 3: Attempt repair - replace invalid exercise IDs, fix rep ranges, etc. */
  async attemptRepair(
    draft: AiRoutineDraft,
    context: UserContext,
    library: ExerciseLibraryItem[]
  ): Promise<{ repaired: AiRoutineDraft; changes: string[] }> {
    const changes: string[] = [];
    const allIds = draft.days.flatMap((d) =>
      d.groups.flatMap((g) => g.exercises.map((e) => e.exercise_id))
    );
    const { valid } = await this.exerciseLibrary.validateExerciseIds(allIds);
    const validSet = new Set(valid);

    const loadTargets = this.aiTools.calculateLoadTargets(
      context.goal,
      context.experienceLevel
    );

    const repairedDays = draft.days.map((day) => {
      const usedInDay = new Set<string>();

      const repairedGroups = day.groups.map((group) => {
        let repairedExercises = group.exercises
          .filter((ex) => validSet.has(ex.exercise_id))
          .map((ex) => {
            usedInDay.add(ex.exercise_id);
            let repaired = { ...ex };
            if (
              ex.rep_range_min < loadTargets.reps.min ||
              ex.rep_range_max > loadTargets.reps.max
            ) {
              repaired = {
                ...repaired,
                rep_range_min: loadTargets.reps.min,
                rep_range_max: loadTargets.reps.max
              };
              changes.push(
                `Fixed rep range for ${ex.exercise_id} to ${loadTargets.reps.min}-${loadTargets.reps.max}`
              );
            }
            return repaired;
          });

        const invalidCount = group.exercises.length - repairedExercises.length;
        if (invalidCount > 0 && library.length > 0) {
          const available = library.filter(
            (e) => !usedInDay.has(e.id) && !repairedExercises.some((ex) => ex.exercise_id === e.id)
          );
          const toAdd = Math.min(invalidCount, available.length);
          for (let i = 0; i < toAdd; i++) {
            const replacement = available[i];
            if (replacement) {
              usedInDay.add(replacement.id);
              repairedExercises.push({
                exercise_id: replacement.id,
                order_in_group: "A1",
                target_sets_per_round: loadTargets.sets,
                rep_range_min: loadTargets.reps.min,
                rep_range_max: loadTargets.reps.max,
                notes: undefined,
                exercise_name: replacement.name
              });
              changes.push(
                `Replaced invalid exercise with ${replacement.name} (${replacement.id})`
              );
            }
          }
        }

        if (repairedExercises.length === 0 && library.length > 0) {
          const fallback = library.find((e) => !usedInDay.has(e.id)) ?? library[0];
          if (fallback) {
            usedInDay.add(fallback.id);
            repairedExercises = [
              {
                exercise_id: fallback.id,
                order_in_group: "A1" as const,
                target_sets_per_round: loadTargets.sets,
                rep_range_min: loadTargets.reps.min,
                rep_range_max: loadTargets.reps.max,
                notes: undefined,
                exercise_name: fallback.name
              }
            ];
            changes.push(`Added fallback exercise ${fallback.name}`);
          }
        }

        return {
          ...group,
          exercises: repairedExercises,
          rest_after_set_seconds:
            group.rest_after_set_seconds ?? loadTargets.restSeconds,
          rest_between_exercises_seconds:
            group.rest_between_exercises_seconds || loadTargets.restSeconds,
          rest_after_round_seconds:
            group.rest_after_round_seconds || loadTargets.restSeconds
        };
      });

      return { ...day, groups: repairedGroups };
    });

    const repaired: AiRoutineDraft = {
      ...draft,
      days: repairedDays
    };

    return { repaired, changes };
  }

  /** Convert AiRoutineDraft to AiGenerateRoutineResponse (CreateRoutineInput compatible) */
  toRoutineResponse(draft: AiRoutineDraft): AiGenerateRoutineResponse {
    return {
      routine: {
        name: draft.name,
        description: draft.description,
        days: draft.days.map((day) => ({
          day_label: day.day_label,
          order_index: day.order_index,
          groups: day.groups.map((group, gi) => ({
            type: group.type,
            order_index: gi,
            rounds_total: group.rounds_total,
            rest_between_exercises_seconds: group.rest_between_exercises_seconds,
            rest_after_round_seconds: group.rest_after_round_seconds,
            rest_after_set_seconds: group.rest_after_set_seconds,
            exercises: group.exercises.map((ex, ei) => ({
              exercise_id: ex.exercise_id,
              order_in_group: (["A1", "A2", "A3"] as const)[ei] ?? "A1",
              target_sets_per_round: ex.target_sets_per_round,
              rep_range_min: ex.rep_range_min,
              rep_range_max: ex.rep_range_max,
              notes: ex.notes,
              exercise_name: ex.exercise_name
            }))
          }))
        }))
      }
    };
  }
}
