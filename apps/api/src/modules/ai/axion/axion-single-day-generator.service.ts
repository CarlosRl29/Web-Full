/**
 * AXION v1.1 - Single-day workout generator
 * Deterministic rules: warmup, exercise structure, load presets, RIR, cardio (FAT_LOSS).
 * Effective volume, pattern redundancy guard, duration estimator.
 */

import { Injectable } from "@nestjs/common";
import type { ExerciseDifficulty, MovementPattern } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { ExerciseLibraryService } from "../exercise-library.service";
import { ProgressionService } from "../../../progress/progression.service";
import type {
  AxionSingleDayInput,
  AxionSingleDayOutput,
  AxionDayTypeInternal,
  SlotConstraint
} from "./axion-types";
import { DAY_FOCUS_TO_INTERNAL } from "./axion-types";
import { getSlotTemplatesForDayType } from "./axion-slot-templates";
import { getLoadPreset, adjustSetsForSession, adjustSetsForCheckIn } from "./axion-load-presets";
import { getBalancedWeeklyTargets, getLowerBodyWeeklyTargets } from "./axion-volume-presets";
import { buildWarmupBlock } from "./axion-warmup";
import { selectBestExercise, type ScorerContext } from "./axion-exercise-scorer";
import { aggregatePerWorkout } from "./axion-effective-volume";
import { estimateWarmupMinutes, estimateSessionMinutes } from "./axion-duration-estimator";

@Injectable()
export class AxionSingleDayGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exerciseLibrary: ExerciseLibraryService,
    private readonly progressionService: ProgressionService
  ) {}

  async generate(input: AxionSingleDayInput): Promise<AxionSingleDayOutput> {
    const {
      goal,
      level,
      dayFocus,
      durationMinutes,
      equipment_available,
      userId,
      locale = "es",
      history,
      checkInContext
    } = input;

    const dayType = DAY_FOCUS_TO_INTERNAL[dayFocus] as AxionDayTypeInternal;
    const slots = getSlotTemplatesForDayType(dayType);
    const weeklyTargets = this.getWeeklyTargets(dayType);

    const avoidIds = new Set<string>();
    const preferIds = new Set<string>();
    const preferFamilies = new Set<string>();
    const recentlyUsedIds = new Set<string>(history?.recent_exercise_ids ?? []);

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

    const warnings: string[] = [];
    const anchors: string[] = [];
    const exercises: AxionSingleDayOutput["exercises"] = [];
    const usedThisRun = new Set<string>();
    const selectedBySlot: Array<{ selected: NonNullable<Awaited<ReturnType<typeof selectBestExercise>>>; sets: number }> = [];

    const candidates = await this.exerciseLibrary.getExercisesWithTaxonomyForDayType(
      dayType,
      equipment_available,
      80,
      userId
    );

    if (candidates.length === 0) {
      warnings.push(`No exercises for ${dayType} with equipment ${equipment_available.join(", ")}`);
    }

    let firstCompoundName: string | undefined;

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

      if (!firstCompoundName && slot.exercise_type === "COMPOUND") {
        firstCompoundName = selected.name;
      }

      const loadPreset = getLoadPreset(goal, slot.exercise_type === "COMPOUND");
      let sets = adjustSetsForSession(loadPreset.sets, durationMinutes);
      if (checkInContext) {
        sets = adjustSetsForCheckIn(sets, {
          readinessModifier: checkInContext.readinessModifier,
          blockVolumeIncreases: checkInContext.blockVolumeIncreases,
          avoidOverheadPressing: checkInContext.avoidOverheadPressing,
          reduceSquatVolume: checkInContext.reduceSquatVolume,
          reduceHingeCompounds: checkInContext.reduceHingeCompounds,
          movementPattern: selected.movement_pattern ?? undefined,
          exerciseFamily: selected.exercise_family ?? undefined,
          primarySubmuscle: selected.primary_submuscle ?? undefined
        });
      }
      selectedBySlot.push({ selected: selected!, sets });

      const isLastIsolationForSmallMuscle =
        slot.exercise_type === "ISOLATION" &&
        ["BICEPS", "TRICEPS", "CALVES", "LATERAL_DELTOID", "REAR_DELTOID"].includes(slot.submuscle) &&
        loadPreset.allowRir0OnLastIsolation;

      exercises.push({
        exercise_id: selected.id,
        exercise_name: selected.name,
        exercise_type: slot.exercise_type ?? "COMPOUND",
        is_anchor: slot.is_anchor,
        target_sets: sets,
        rep_range_min: loadPreset.reps.min,
        rep_range_max: loadPreset.reps.max,
        rest_seconds: loadPreset.restSeconds,
        rir_min: loadPreset.rirMin,
        rir_max: loadPreset.rirMax,
        allow_rir_0_on_last_set: isLastIsolationForSmallMuscle,
        progressionRule: "DOUBLE_PROGRESSION"
      });
    }

    if (userId) {
      for (const ex of exercises) {
        const perf = await this.progressionService.getLastSessionPerformance(userId, ex.exercise_id);
        const suggestion = this.progressionService.computeSuggestion(
          perf,
          { min: ex.rep_range_min, max: ex.rep_range_max },
          ex.rir_min
        );
        ex.nextSuggestion = { type: suggestion.type, value: suggestion.value };
      }
    }

    const warmup = buildWarmupBlock(dayType, firstCompoundName);

    let cardio: AxionSingleDayOutput["cardio"];
    if (goal === "FAT_LOSS") {
      cardio = {
        type: "INCLINE_WALK",
        duration_min: 20,
        description: "15–25 min caminata en inclinación o 10–15 min intervalos moderados"
      };
      warnings.push("Cardio recomendado después de la sesión o en días de descanso.");
    }

    const warmupMinutes = estimateWarmupMinutes(dayType);
    const estimatedDurationMinutes = Math.min(
      estimateSessionMinutes(
        warmupMinutes,
        exercises.map((ex) => ({
          exercise_type: ex.exercise_type,
          target_sets: ex.target_sets,
          rest_seconds: ex.rest_seconds
        }))
      ) + (cardio?.duration_min ?? 0),
      durationMinutes ?? 120
    );

    const volumeEntries = selectedBySlot.map(({ selected, sets }) => ({
      exercise: {
        primary_submuscle: selected.primary_submuscle,
        secondary_muscles: selected.secondary_muscles,
        exercise_type: selected.exercise_type
      },
      sets
    }));
    const effectiveVolume = aggregatePerWorkout(volumeEntries);
    const effectiveVolumePerSubmuscle: Record<string, number> = {};
    for (const [sub, val] of effectiveVolume) {
      effectiveVolumePerSubmuscle[sub] = val;
    }

    const bicepsVol = effectiveVolume.get("BICEPS") ?? 0;
    const tricepsVol = effectiveVolume.get("TRICEPS") ?? 0;
    if (bicepsVol > 6 || tricepsVol > 6) {
      warnings.push("Alto volumen efectivo en bíceps/tríceps en esta sesión; considera reducir si hay fatiga acumulada.");
    }

    const validationWarnings = this.validateWorkout(exercises, durationMinutes);
    warnings.push(...validationWarnings);

    return {
      dayType,
      warmup,
      exercises,
      cardio,
      metadata: {
        estimatedDurationMinutes,
        weeklyTargets,
        effectiveVolumePerSubmuscle,
        warnings,
        anchors
      }
    };
  }

  private getWeeklyTargets(dayType: AxionDayTypeInternal): Record<string, number> {
    if (
      dayType === "LOWER_QUAD_FOCUS" ||
      dayType === "LOWER_GLUTE_HAM_FOCUS"
    ) {
      return getLowerBodyWeeklyTargets();
    }
    return getBalancedWeeklyTargets();
  }

  private validateWorkout(
    exercises: AxionSingleDayOutput["exercises"],
    maxMinutes: number
  ): string[] {
    const w: string[] = [];
    const hasCompound = exercises.some((e) => e.exercise_type === "COMPOUND");
    if (!hasCompound && exercises.length > 0) {
      w.push("Se recomienda al menos un ejercicio compuesto principal.");
    }
    if (exercises.length > 10) {
      w.push("Muchos ejercicios; considera reducir para respetar la duración.");
    }
    return w;
  }
}
