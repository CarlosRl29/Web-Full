/**
 * Routine Generation Workflow:
 * User Request → Fetch Profile → Fetch Exercise Library → Generate Draft →
 * Schema Validation → Rule Engine → Repair if needed → Save Draft → Return
 *
 * The generator uses ONLY exercises from the library. No hallucination.
 */

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable
} from "@nestjs/common";
import { createHash, randomInt, randomUUID } from "crypto";
import type {
  AiRoutineDraft,
  AiGenerateRoutineRequest,
  AiGenerateRoutineResponse,
  AiGenerateRoutineSuccess,
  AiGenerateRoutineFailure,
  CreateRoutineInput
} from "@gym/shared";
import { ExerciseGroupType } from "@gym/shared";
import { AiToolsService } from "./ai-tools.service";
import { ExerciseLibraryService } from "./exercise-library.service";
import {
  RoutineValidationService,
  type SafetyPrereqsContext
} from "./routine-validation.service";
import { RoutinesService } from "../../routines/routines.service";
import { PrismaService } from "../../prisma/prisma.service";

const MAX_REPAIR_ATTEMPTS = 2;
const MODEL_NAME = "deterministic-v1";

function computeExerciseLibraryHash(
  library: Array<{ id: string }>
): string {
  const ids = [...library.map((e) => e.id)].sort();
  return createHash("sha256").update(ids.join(",")).digest("hex");
}

/** PII-minimal context for logging. No full profile text or injury details. */
type MinimalLogContext = {
  goal: string;
  experience_level: string;
  days_per_week: number;
  equipment_count: number;
  injury_declared: boolean;
  use_saved_profile: boolean;
};

type DayType = "PUSH" | "PULL" | "LEGS" | "UPPER" | "LOWER" | "FULL";

function buildMinimalLogContext(
  input: AiGenerateRoutineRequest,
  context: { goal: string; experienceLevel: string; equipment: string[]; injuries?: string },
  daysPerWeek: number
): MinimalLogContext {
  return {
    goal: context.goal,
    experience_level: context.experienceLevel,
    days_per_week: daysPerWeek,
    equipment_count: context.equipment?.length ?? 0,
    injury_declared: (context.injuries?.trim().length ?? 0) > 0,
    use_saved_profile: input.use_saved_profile === true
  };
}

@Injectable()
export class RoutineGeneratorService {
  constructor(
    private readonly aiTools: AiToolsService,
    private readonly exerciseLibrary: ExerciseLibraryService,
    private readonly validation: RoutineValidationService,
    private readonly routinesService: RoutinesService,
    private readonly prisma: PrismaService
  ) {}

  /** Deterministic pick from array (seeded by day index for reproducibility) */
  private pick<T>(arr: T[], n: number, seed: number): T[] {
    if (arr.length <= n) return [...arr];
    const indices: number[] = [];
    let s = seed;
    while (indices.length < n) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const idx = s % arr.length;
      if (!indices.includes(idx)) {
        indices.push(idx);
      }
    }
    return indices.map((i) => arr[i]);
  }

  /** Generate routine draft using ONLY exercises from library. Deterministic. */
  private async generateDraft(
    userId: string,
    input: AiGenerateRoutineRequest,
    seedUsed: string,
    knowledgeSnippets?: string[]
  ): Promise<AiRoutineDraft> {
    const profile = await this.aiTools.getUserProfile(userId);
    const useSaved = input.use_saved_profile === true;
    const reqProfile = input.profile;
    const constraints = input.constraints ?? {};

    const goal = (useSaved
      ? profile?.goal
      : reqProfile?.goal ?? profile?.goal) ?? "MIXED";
    const level = (useSaved
      ? profile?.experience_level
      : reqProfile?.experience_level ?? profile?.experience_level) ?? "INTERMEDIATE";
    const daysPerWeek = Math.min(
      6,
      Math.max(
        2,
        Number(
          (useSaved
            ? profile?.days_per_week
            : reqProfile?.days_per_week ?? profile?.days_per_week) ?? 4
        )
      )
    );
    const equipment = (constraints.equipment?.length
      ? constraints.equipment
      : profile?.equipment ?? []) as string[];

    const context = this.aiTools.buildUserContext(profile, {
      goal: goal as string,
      experience_level: level as string,
      days_per_week: daysPerWeek,
      equipment,
      injuries: constraints.injuries ?? profile?.injuries ?? undefined,
      session_minutes: constraints.session_minutes ?? profile?.session_minutes ?? undefined,
      knowledgeSnippets
    });

    const loadTargets = this.aiTools.calculateLoadTargets(
      context.goal,
      context.experienceLevel
    );

    const equipmentFilter =
      equipment.length > 0
        ? [...equipment.map((e) => String(e).toLowerCase().trim()), "body weight"]
        : [
            "barbell",
            "dumbbell",
            "body weight",
            "kettlebell",
            "cable",
            "resistance band",
            "smith machine"
          ];

    const dayTemplates: DayType[][] =
      daysPerWeek === 2
        ? [["FULL"], ["FULL"]]
        : daysPerWeek === 3
          ? [["PUSH"], ["PULL"], ["LEGS"]]
          : daysPerWeek === 4
            ? [["UPPER"], ["LOWER"], ["UPPER"], ["LOWER"]]
            : daysPerWeek === 5
              ? [["PUSH"], ["PULL"], ["LEGS"], ["UPPER"], ["LOWER"]]
              : [
                  ["PUSH"],
                  ["PULL"],
                  ["LEGS"],
                  ["PUSH"],
                  ["PULL"],
                  ["LEGS"]
                ];

    const exercisesPerDay =
      context.experienceLevel === "BEGINNER"
        ? 4
        : context.experienceLevel === "INTERMEDIATE"
          ? 5
          : 6;

    const dayLabels = ["Día A", "Día B", "Día C", "Día D", "Día E", "Día F"];
    const days: AiRoutineDraft["days"] = [];

    for (let i = 0; i < dayTemplates.length; i++) {
      const types = dayTemplates[i];
      const groups: AiRoutineDraft["days"][0]["groups"] = [];
      const usedIds = new Set<string>();

      for (const dayType of types) {
        const pool = await this.exerciseLibrary.getExercisesByDayType(
          dayType,
          equipmentFilter,
          80,
          "es",
          userId
        );
        const available = pool.filter((x) => !usedIds.has(x.id));
        const count = Math.ceil(exercisesPerDay / types.length);
        const baseSeed = parseInt(seedUsed, 10) || 0;
        const pickSeed = baseSeed + i * 1000 + dayType.charCodeAt(0);
        const selected = this.pick(
          available,
          Math.min(count, available.length),
          pickSeed
        );

        selected.forEach((x) => usedIds.add(x.id));

        for (const ex of selected) {
          groups.push({
            type: "SINGLE",
            order_index: groups.length,
            rounds_total: 1,
            rest_between_exercises_seconds: loadTargets.restSeconds,
            rest_after_round_seconds: loadTargets.restSeconds,
            rest_after_set_seconds: loadTargets.restSeconds,
            exercises: [
              {
                exercise_id: ex.id,
                order_in_group: "A1",
                target_sets_per_round: loadTargets.sets,
                rep_range_min: loadTargets.reps.min,
                rep_range_max: loadTargets.reps.max,
                notes: undefined,
                exercise_name: ex.name
              }
            ]
          });
        }
      }

      if (groups.length > 0) {
        days.push({
          day_label: dayLabels[i] ?? `Día ${i + 1}`,
          order_index: i,
          groups
        });
      }
    }

    const goalLabel =
      goal === "STRENGTH" ? "Fuerza" : goal === "HYPERTROPHY" ? "Hipertrofia" : "Mixto";
    const levelLabel =
      level === "BEGINNER"
        ? "Principiante"
        : level === "INTERMEDIATE"
          ? "Intermedio"
          : "Avanzado";
    const routineName = `Rutina IA • ${goalLabel} • ${daysPerWeek} días`;

    const descParts = [
      `Generada según tu perfil: objetivo ${goalLabel}, nivel ${levelLabel}, ${daysPerWeek} días/semana.`
    ];

    return {
      name: routineName,
      goal: context.goal,
      description: descParts.join(" "),
      days
    };
  }

  /** Full workflow: generate, validate, repair, save, return */
  async generateAndSave(
    userId: string,
    input: AiGenerateRoutineRequest
  ): Promise<AiGenerateRoutineSuccess> {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const seedUsed = String(randomInt(0, 0x7fffffff));

    const logFailure = async (params: {
      failureStage: string;
      validationErrors: string[];
      draft?: AiRoutineDraft;
      minimalContext: MinimalLogContext;
      repairAttempts?: number;
      exerciseLibraryHash?: string | null;
      qualityScore?: number | null;
      qualityReasons?: string[];
    }) => {
      const durationMs = Date.now() - startedAt;
      const promptChars = JSON.stringify(params.minimalContext).length;
      const responseChars = params.draft ? JSON.stringify(params.draft).length : 0;
      await this.prisma.aiRoutineGenerationLog.create({
        data: {
          request_id: requestId,
          user_id: userId,
          generation_input: params.minimalContext as unknown as object,
          ai_output_raw: params.draft ? (params.draft as unknown as object) : undefined,
          validation_errors: params.validationErrors,
          failure_stage: params.failureStage,
          duration_ms: durationMs,
          model_name: MODEL_NAME,
          prompt_chars: promptChars,
          response_chars: responseChars,
          repair_attempts: params.repairAttempts ?? 0,
          seed_used: seedUsed,
          exercise_library_hash: params.exerciseLibraryHash ?? null,
          quality_score: params.qualityScore ?? null,
          quality_reasons: params.qualityReasons ?? [],
          success: false
        }
      });
    };

    let library: Awaited<ReturnType<ExerciseLibraryService["getExerciseLibrary"]>>;
    let profile: Awaited<ReturnType<AiToolsService["getUserProfile"]>>;
    let context: ReturnType<AiToolsService["buildUserContext"]>;
    let draft: AiRoutineDraft;

    try {
      library = await this.exerciseLibrary.getExerciseLibrary({
        equipment: (input.constraints?.equipment ?? []) as string[],
        limit: 500
      });
    } catch (err) {
      const minimalContext = buildMinimalLogContext(input, {
        goal: input.profile?.goal ?? "MIXED",
        experienceLevel: input.profile?.experience_level ?? "INTERMEDIATE",
        equipment: (input.constraints?.equipment ?? []) as string[],
        injuries: input.constraints?.injuries
      }, input.profile?.days_per_week ?? 4);
      await logFailure({
        failureStage: "library_fetch",
        validationErrors: [err instanceof Error ? err.message : "Unknown error"],
        minimalContext,
        exerciseLibraryHash: undefined
      });
      throw new HttpException(
        {
          errorCode: "VALIDATION_FAILED" as const,
          validationErrors: [err instanceof Error ? err.message : "Unknown error"],
          requestId
        } satisfies AiGenerateRoutineFailure,
        HttpStatus.BAD_REQUEST
      );
    }

    if (library.length === 0) {
      const minimalContext = buildMinimalLogContext(input, {
        goal: input.profile?.goal ?? "MIXED",
        experienceLevel: input.profile?.experience_level ?? "INTERMEDIATE",
        equipment: (input.constraints?.equipment ?? []) as string[],
        injuries: input.constraints?.injuries
      }, input.profile?.days_per_week ?? 4);
      await logFailure({
        failureStage: "library_empty",
        validationErrors: ["No exercises match equipment"],
        minimalContext,
        exerciseLibraryHash: computeExerciseLibraryHash(library)
      });
      throw new HttpException(
        {
          errorCode: "VALIDATION_FAILED" as const,
          validationErrors: ["No exercises match equipment"],
          requestId
        } satisfies AiGenerateRoutineFailure,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      profile = await this.aiTools.getUserProfile(userId);
      context = this.aiTools.buildUserContext(profile, {
        goal: input.profile?.goal as string | undefined,
        experience_level: input.profile?.experience_level as string | undefined,
        days_per_week: input.profile?.days_per_week,
        equipment: (input.constraints?.equipment ?? []) as string[],
        injuries: input.constraints?.injuries,
        session_minutes: input.constraints?.session_minutes
      });
      draft = await this.generateDraft(userId, input, seedUsed);
    } catch (err) {
      if (err instanceof HttpException && (err.getResponse() as { errorCode?: string })?.errorCode) {
        throw err;
      }
      const minimalContext = buildMinimalLogContext(input, {
        goal: input.profile?.goal ?? "MIXED",
        experienceLevel: input.profile?.experience_level ?? "INTERMEDIATE",
        equipment: (input.constraints?.equipment ?? []) as string[],
        injuries: input.constraints?.injuries
      }, input.profile?.days_per_week ?? 4);
      await logFailure({
        failureStage: "generate",
        validationErrors: [err instanceof Error ? err.message : "Unknown error"],
        minimalContext,
        exerciseLibraryHash: computeExerciseLibraryHash(library)
      });
      throw new HttpException(
        {
          errorCode: "VALIDATION_FAILED" as const,
          validationErrors: [err instanceof Error ? err.message : "Unknown error"],
          requestId
        } satisfies AiGenerateRoutineFailure,
        HttpStatus.BAD_REQUEST
      );
    }
    const allIds = draft.days.flatMap((d) =>
      d.groups.flatMap((g) => g.exercises.map((e) => e.exercise_id))
    );
    const { valid } = await this.exerciseLibrary.validateExerciseIds(allIds);
    const validSet = new Set(valid);

    let repairAttempts = 0;
    let ruleResult = this.validation.validateRules(
      draft,
      context,
      library,
      validSet
    );

    while (!ruleResult.passed && repairAttempts < MAX_REPAIR_ATTEMPTS) {
      const { repaired } = await this.validation.attemptRepair(
        draft,
        context,
        library
      );
      draft = repaired;
      const newIds = draft.days.flatMap((d) =>
        d.groups.flatMap((g) => g.exercises.map((e) => e.exercise_id))
      );
      const { valid: newValid } =
        await this.exerciseLibrary.validateExerciseIds(newIds);
      ruleResult = this.validation.validateRules(
        draft,
        context,
        library,
        new Set(newValid)
      );
      repairAttempts++;
    }

    if (!ruleResult.passed) {
      const minimalContext = buildMinimalLogContext(input, context, draft.days.length);
      await logFailure({
        failureStage: "rule_validation",
        validationErrors: ruleResult.errors,
        draft,
        minimalContext,
        repairAttempts,
        exerciseLibraryHash: computeExerciseLibraryHash(library)
      });
      throw new HttpException(
        {
          errorCode: "RULES_FAILED" as const,
          validationErrors: ruleResult.errors,
          requestId
        } satisfies AiGenerateRoutineFailure,
        HttpStatus.BAD_REQUEST
      );
    }

    const qualityResult = this.validation.scoreRoutine(draft, context, library);
    let warnings: string[] = [];
    if (qualityResult.score < 70) {
      warnings = qualityResult.reasons.map((r) => `⚠️ ${r}`);
    }

    const daysPerWeek = draft.days.length;
    const safetyContext: SafetyPrereqsContext = {
      ...context,
      daysPerWeek,
      injuries: context.injuries ?? ""
    };

    try {
      this.validation.assertSafetyPrereqs(safetyContext);
      draft = this.validation.enforceSafetyLanguage(draft);
    } catch (err) {
      const res = err instanceof BadRequestException ? err.getResponse() : null;
      const miss =
        res && typeof res === "object" && "missing_fields" in res
          ? (res as { missing_fields: string[] }).missing_fields
          : undefined;
      const safetyErrors = miss
        ? [`Safety gate: missing_fields: ${miss.join(", ")}`]
        : [err instanceof Error ? err.message : "Safety gate failed"];
      const minimalContext = buildMinimalLogContext(input, context, draft.days.length);
      await logFailure({
        failureStage: "safety_gate",
        validationErrors: safetyErrors,
        draft,
        minimalContext,
        repairAttempts,
        exerciseLibraryHash: computeExerciseLibraryHash(library)
      });
      throw new HttpException(
        (miss
          ? {
              errorCode: "MISSING_CONTEXT" as const,
              missingFields: miss,
              validationErrors: safetyErrors,
              requestId
            }
          : {
              errorCode: "SAFETY_GATE" as const,
              validationErrors: safetyErrors,
              requestId
            }) satisfies AiGenerateRoutineFailure,
        HttpStatus.BAD_REQUEST
      );
    }

    const response = this.validation.toRoutineResponse(draft);
    const createInput: CreateRoutineInput = {
      name: response.routine.name,
      description: response.routine.description,
      days: response.routine.days.map((day) => ({
        day_label: day.day_label,
        order_index: day.order_index,
        groups: day.groups.map((group) => ({
          type: group.type as ExerciseGroupType,
          order_index: group.order_index,
          rounds_total: group.rounds_total,
          rest_between_exercises_seconds: group.rest_between_exercises_seconds,
          rest_after_round_seconds: group.rest_after_round_seconds,
          rest_after_set_seconds: group.rest_after_set_seconds,
          exercises: group.exercises.map((ex) => ({
            exercise_id: ex.exercise_id,
            order_in_group: ex.order_in_group,
            target_sets_per_round: ex.target_sets_per_round,
            rep_range_min: ex.rep_range_min,
            rep_range_max: ex.rep_range_max,
            notes: ex.notes
          }))
        }))
      }))
    };
    let created;
    try {
      created = await this.routinesService.create(createInput, userId);
    } catch (err) {
      const minimalContext = buildMinimalLogContext(input, context, draft.days.length);
      await logFailure({
        failureStage: "save",
        validationErrors: [err instanceof Error ? err.message : "Unknown error"],
        draft,
        minimalContext,
        repairAttempts,
        exerciseLibraryHash: computeExerciseLibraryHash(library)
      });
      throw new HttpException(
        {
          errorCode: "VALIDATION_FAILED" as const,
          validationErrors: [err instanceof Error ? err.message : "Unknown error"],
          requestId
        } satisfies AiGenerateRoutineFailure,
        HttpStatus.BAD_REQUEST
      );
    }

    const durationMs = Date.now() - startedAt;
    const minimalContext = buildMinimalLogContext(input, context, draft.days.length);
    const promptChars = JSON.stringify(minimalContext).length;
    const responseChars = JSON.stringify(draft).length;
    const exerciseLibraryHash = computeExerciseLibraryHash(library);

    await this.prisma.aiRoutineGenerationLog.create({
      data: {
        request_id: requestId,
        user_id: userId,
        generation_input: minimalContext as unknown as object,
        ai_output_raw: draft as unknown as object,
        validation_errors: ruleResult.errors,
        final_routine: response as unknown as object,
        routine_id: created.id,
        repair_attempts: repairAttempts,
        success: true,
        duration_ms: durationMs,
        model_name: MODEL_NAME,
        prompt_chars: promptChars,
        response_chars: responseChars,
        seed_used: seedUsed,
        exercise_library_hash: exerciseLibraryHash,
        quality_score: qualityResult.score,
        quality_reasons: qualityResult.reasons
      }
    });

    if (qualityResult.score >= 70) {
      const filtered = qualityResult.reasons.filter(
        (r) => !r.startsWith("Calidad buena") && !r.startsWith("Calidad insuficiente")
      );
      if (qualityResult.score >= 80) {
        warnings = [`Calidad buena: ${qualityResult.score}/100`, ...filtered];
      } else {
        warnings = filtered;
      }
    }

    return {
      routineId: created.id,
      draft: {
        name: created.name,
        description: created.description ?? undefined,
        days: created.days
      },
      warnings,
      score: qualityResult.score,
      nextSteps: [],
      requestId
    } satisfies AiGenerateRoutineSuccess;
  }

  /** Generate without saving (for API response that returns draft for user to save) */
  async generateDraftOnly(
    userId: string,
    input: AiGenerateRoutineRequest
  ): Promise<AiGenerateRoutineResponse> {
    const library = await this.exerciseLibrary.getExerciseLibrary({
      equipment: (input.constraints?.equipment ?? []) as string[],
      limit: 500,
      userId
    });

    if (library.length === 0) {
      throw new HttpException(
        {
          message:
            "No hay ejercicios en la base de datos que coincidan con tu equipo."
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const seedUsed = String(randomInt(0, 0x7fffffff));
    const draft = await this.generateDraft(userId, input, seedUsed);
    const response = this.validation.toRoutineResponse(draft);
    return response;
  }
}
