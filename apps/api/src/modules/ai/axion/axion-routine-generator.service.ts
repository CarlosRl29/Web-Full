/**
 * AXION Routine Generator v1.1 - Deterministic rules engine
 * 4/5/6 days only. Uses MEV/MAV/MRV, exercise families, scoring, rotation blocks, RIR-based intensity.
 * Effective volume, pattern redundancy guard, quality gate.
 */

import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { ExerciseDifficulty, MovementPattern } from "@prisma/client";
import type { AiGenerateRoutineSuccess, AiRoutineDraft, AiRoutineDraftDay, AiRoutineDraftExercise } from "@gym/shared";
import { ExerciseGroupType } from "@gym/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { ExerciseLibraryService } from "../exercise-library.service";
import { RoutineValidationService } from "../routine-validation.service";
import { RoutinesService } from "../../../routines/routines.service";
import type { AxionInput, AxionDayTypeInternal, SlotConstraint } from "./axion-types";
import { getSplitTemplate } from "./axion-split-templates";
import { getSlotTemplatesForDayType } from "./axion-slot-templates";
import { getWeeklyTargetSets } from "./axion-volume-presets";
import { getLoadPreset, adjustSetsForSession } from "./axion-load-presets";
import { selectBestExercise, type ScorerContext } from "./axion-exercise-scorer";
import { aggregatePerWeek, getMAVRange, type ExerciseSetEntry } from "./axion-effective-volume";

type AxionOutput = {
  draft: AiRoutineDraft;
  metadata: {
    split: AxionDayTypeInternal[][];
    blockLengthWeeks: number;
    anchors: string[];
    warnings: string[];
    effectiveVolumePerSubmuscle?: Record<string, number>;
  };
};

@Injectable()
export class AxionRoutineGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exerciseLibrary: ExerciseLibraryService,
    private readonly validation: RoutineValidationService,
    private readonly routinesService: RoutinesService
  ) {}

  async generate(input: AxionInput): Promise<AxionOutput> {
    const { goal, level, days_per_week, priority_area, equipment_available, userId, session_minutes = 60 } = input;

    const split = getSplitTemplate(days_per_week, priority_area);
    const weeklyTargets = getWeeklyTargetSets(goal, level, priority_area);
    const blockLengthWeeks = level === "BEGINNER" ? 4 : 6;

    const avoidIds = new Set<string>();
    const preferIds = new Set<string>();
    const preferFamilies = new Set<string>();
    const recentlyUsedIds = new Set<string>(input.history?.recent_exercise_ids ?? []);

    if (userId) {
      const prefs = await this.prisma.userExercisePreference.findMany({
        where: { user_id: userId }
      });
      for (const p of prefs) {
        if (p.preference_type === "AVOID" && p.exercise_id) avoidIds.add(p.exercise_id);
        if (p.preference_type === "PREFER" && p.exercise_id) preferIds.add(p.exercise_id);
        if (p.preference_type === "PREFER" && p.exercise_family) preferFamilies.add(p.exercise_family);
      }
    }

    const warnings: string[] = [];
    const anchors: string[] = [];
    const days: AiRoutineDraftDay[] = [];
    const usedThisRun = new Set<string>();
    const sessionVolumeEntries: Array<{ exercises: ExerciseSetEntry[] }> = [];

    for (let dayIdx = 0; dayIdx < split.days.length; dayIdx++) {
      const patternCounts = new Map<MovementPattern, number>();
      const scorerContext: ScorerContext = {
        equipment: equipment_available,
        userLevel: level as ExerciseDifficulty,
        avoidIds,
        preferIds,
        preferFamilies,
        recentlyUsedIds,
        patternCounts
      };

      const dayTypes = split.days[dayIdx];
      const dayLabel = split.labels[dayIdx] ?? `Día ${dayIdx + 1}`;
      const groups: AiRoutineDraftDay["groups"] = [];
      let orderIndex = 0;
      const dayVolumeEntries: ExerciseSetEntry[] = [];

      for (const dayType of dayTypes) {
        const slots = getSlotTemplatesForDayType(dayType);
        const candidates = await this.exerciseLibrary.getExercisesWithTaxonomyForDayType(
          dayType,
          equipment_available,
          80,
          userId
        );

        if (candidates.length === 0) {
          warnings.push(`No exercises for ${dayType} with equipment ${equipment_available.join(", ")}`);
          continue;
        }

        for (const slot of slots) {
          const slotConstraint: SlotConstraint = {
            primary_submuscle: slot.submuscle,
            movement_pattern: slot.movement_pattern,
            exercise_type: slot.exercise_type,
            is_anchor: slot.is_anchor
          };

          const selected = selectBestExercise(
            candidates,
            slotConstraint,
            scorerContext,
            usedThisRun
          );

          if (!selected) continue;

          usedThisRun.add(selected.id);
          if (slot.is_anchor) anchors.push(selected.id);

          if (selected.exercise_type === "COMPOUND" && selected.movement_pattern) {
            patternCounts.set(
              selected.movement_pattern,
              (patternCounts.get(selected.movement_pattern) ?? 0) + 1
            );
          }

          const loadPreset = getLoadPreset(goal, slot.exercise_type === "COMPOUND");
          const sets = adjustSetsForSession(loadPreset.sets, session_minutes);
          dayVolumeEntries.push({
            exercise: {
              primary_submuscle: selected.primary_submuscle,
              secondary_muscles: selected.secondary_muscles
            },
            sets
          });
          const reps = loadPreset.reps;

          const exercise: AiRoutineDraftExercise = {
            exercise_id: selected.id,
            order_in_group: "A1",
            target_sets_per_round: sets,
            rep_range_min: reps.min,
            rep_range_max: reps.max,
            notes: undefined,
            exercise_name: selected.name
          };

          groups.push({
            type: "SINGLE",
            order_index: orderIndex++,
            rounds_total: 1,
            rest_between_exercises_seconds: loadPreset.restSeconds,
            rest_after_round_seconds: loadPreset.restSeconds,
            rest_after_set_seconds: loadPreset.restSeconds,
            exercises: [exercise]
          });
        }
      }

      if (groups.length > 0) {
        days.push({
          day_label: dayLabel,
          order_index: dayIdx,
          groups
        });
        if (dayVolumeEntries.length > 0) {
          sessionVolumeEntries.push({ exercises: dayVolumeEntries });
        }
      }
    }

    const goalLabel =
      goal === "STRENGTH"
        ? "Fuerza"
        : goal === "HYPERTROPHY"
          ? "Hipertrofia"
          : goal === "FAT_LOSS"
            ? "Pérdida de grasa"
            : goal === "ENDURANCE"
              ? "Resistencia"
              : "Mixto";
    const levelLabel =
      level === "BEGINNER"
        ? "Principiante"
        : level === "INTERMEDIATE"
          ? "Intermedio"
          : "Avanzado";

    const draft: AiRoutineDraft = {
      name: `AXION • ${goalLabel} • ${days_per_week} días`,
      goal: goal === "FAT_LOSS" || goal === "ENDURANCE" ? "MIXED" : goal,
      description: `Rutina AXION v1: ${goalLabel}, nivel ${levelLabel}, ${days_per_week} días/semana. Bloque de ${blockLengthWeeks} semanas.`,
      days
    };

    if (goal === "FAT_LOSS") {
      warnings.push("Cardio recomendado después de la sesión o en días de descanso.");
    }

    const weeklyVolume = aggregatePerWeek(sessionVolumeEntries);
    const effectiveVolumePerSubmuscle: Record<string, number> = {};
    for (const [sub, val] of weeklyVolume) {
      effectiveVolumePerSubmuscle[sub] = val;
    }

    for (const [sub, vol] of weeklyVolume) {
      const range = getMAVRange(sub, level, goal, priority_area);
      if (vol < range.min) {
        warnings.push(`Volumen efectivo bajo para ${sub}: ${vol.toFixed(1)} sets/semana (objetivo ${range.min}-${range.max}).`);
      } else if (vol > range.max) {
        warnings.push(`Volumen efectivo alto para ${sub}: ${vol.toFixed(1)} sets/semana (objetivo ${range.min}-${range.max}).`);
      }
    }
    const bicepsVol = weeklyVolume.get("BICEPS") ?? 0;
    const tricepsVol = weeklyVolume.get("TRICEPS") ?? 0;
    if (bicepsVol > 12 || tricepsVol > 12) {
      warnings.push("Alto volumen semanal en bíceps/tríceps; considera reducir si hay fatiga.");
    }

    return {
      draft,
      metadata: {
        split: split.days,
        blockLengthWeeks,
        anchors,
        warnings,
        effectiveVolumePerSubmuscle
      }
    };
  }

  /** Generate and save routine, returns AiGenerateRoutineSuccess format */
  async generateAndSave(
    userId: string,
    input: AxionInput
  ): Promise<AiGenerateRoutineSuccess> {
    const requestId = randomUUID();
    const result = await this.generate(input);

    const response = this.validation.toRoutineResponse(result.draft);
    const createInput = {
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

    try {
      const created = await this.routinesService.create(createInput, userId);
      return {
        routineId: created.id,
        draft: {
          name: created.name,
          description: created.description ?? undefined,
          days: created.days
        },
        warnings: result.metadata.warnings,
        score: 85,
        nextSteps: [
          `Bloque de ${result.metadata.blockLengthWeeks} semanas.`,
          ...(result.metadata.warnings.length > 0 ? result.metadata.warnings : [])
        ],
        requestId
      };
    } catch (err) {
      throw new HttpException(
        {
          errorCode: "VALIDATION_FAILED" as const,
          validationErrors: [err instanceof Error ? err.message : "Error al guardar rutina"],
          requestId
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
