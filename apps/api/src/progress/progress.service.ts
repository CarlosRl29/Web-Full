/**
 * AXION v1.1 - Progress Module
 * Overview, exercise trends, muscles effective volume, body (optional).
 * e1RM with Epley: weight * (1 + reps/30)
 */

import { Injectable } from "@nestjs/common";
import { WorkoutSessionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProgressionService, computeE1RM } from "./progression.service";
import {
  aggregatePerWeek,
  type ExerciseSetEntry
} from "../modules/ai/axion/axion-effective-volume";
import type { Submuscle } from "@prisma/client";

export type ProgressOverview = {
  sessionsCount: number;
  volumeTotal: number;
  adherence: number;
  windowDays: number;
};

export type ExerciseTrend = {
  exerciseId: string;
  exerciseName: string;
  e1rmBest: number | null;
  e1rmTrend: number[];
  volumeTrend: number[];
  lastSessions: Array<{ weight: number; reps: number }>;
  lastPerformedAt: Date | null;
  nextSuggestion?: { type: string; value?: number };
};

export type MusclesEffectiveVolume = Record<string, number>;

/** MAV targets for color coding: min/max sets per week (approximate) */
const SUBMUSCLE_MAV_TARGETS: Record<string, { min: number; max: number }> = {
  BICEPS: { min: 7, max: 14 },
  TRICEPS: { min: 7, max: 14 },
  CALVES: { min: 7, max: 14 },
  LATERAL_DELTOID: { min: 7, max: 14 },
  REAR_DELTOID: { min: 7, max: 14 },
  ANTERIOR_DELTOID: { min: 7, max: 14 },
  TRAPS: { min: 3, max: 7 },
  UPPER_CHEST: { min: 7, max: 14 },
  MID_CHEST: { min: 7, max: 14 },
  LOWER_CHEST: { min: 2, max: 6 },
  LATS: { min: 10, max: 20 },
  UPPER_BACK: { min: 7, max: 14 },
  MID_BACK: { min: 7, max: 14 },
  LOWER_BACK: { min: 2, max: 6 },
  QUADS: { min: 10, max: 20 },
  HAMSTRINGS: { min: 8, max: 16 },
  GLUTES: { min: 8, max: 16 },
  ABS: { min: 7, max: 14 },
  OBLIQUES: { min: 2, max: 6 },
  ERECTORS: { min: 2, max: 6 }
};

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressionService: ProgressionService
  ) {}

  async getOverview(userId: string, days = 28): Promise<ProgressOverview> {
    const safeDays = Math.min(Math.max(Number(days) || 28, 1), 365);
    const from = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        user_id: userId,
        started_at: { gte: from },
        status: { in: [WorkoutSessionStatus.ACTIVE, WorkoutSessionStatus.FINISHED] }
      },
      include: {
        workout_groups: {
          include: {
            workout_items: { include: { sets: true } }
          }
        }
      },
      orderBy: { started_at: "asc" }
    });

    let volumeTotal = 0;
    let setsDone = 0;
    let setsPlanned = 0;

    for (const session of sessions) {
      for (const group of session.workout_groups) {
        for (const item of group.workout_items) {
          for (const set of item.sets) {
            setsPlanned += 1;
            if (set.is_done && set.weight != null && set.reps != null) {
              volumeTotal += set.weight * set.reps;
              setsDone += 1;
            }
          }
        }
      }
    }

    return {
      sessionsCount: sessions.length,
      volumeTotal,
      adherence: setsPlanned > 0 ? setsDone / setsPlanned : 0,
      windowDays: safeDays
    };
  }

  async getExerciseTrends(
    userId: string,
    exerciseId: string,
    limit = 10
  ): Promise<ExerciseTrend | null> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, name: true }
    });
    if (!exercise) return null;

    const groupIds = (
      await this.prisma.groupExercise.findMany({
        where: { exercise_id: exerciseId },
        select: { id: true }
      })
    ).map((g) => g.id);
    const groupIdsSet = new Set(groupIds);

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        user_id: userId,
        status: WorkoutSessionStatus.FINISHED
      },
      orderBy: { started_at: "desc" },
      take: 50,
      include: {
        workout_groups: {
          include: {
            workout_items: {
              where: {
                OR: [
                  { exercise_id_override: exerciseId },
                  ...(groupIds.length > 0
                    ? [{ source_group_exercise_id: { in: groupIds } }]
                    : [])
                ]
              },
              include: { sets: true }
            }
          }
        }
      }
    });

    const volumeTrend: number[] = [];
    const e1rmTrend: number[] = [];
    const lastSessions: Array<{ weight: number; reps: number }> = [];
    let e1rmBest = 0;
    let lastPerformedAt: Date | null = null;
    let lastSessionProcessed = false;

    for (const session of sessions) {
      let sessionVolume = 0;
      let sessionBestE1rm = 0;
      const sessionSets: Array<{ weight: number; reps: number }> = [];

      for (const group of session.workout_groups) {
        for (const item of group.workout_items) {
          const matches =
            item.exercise_id_override === exerciseId ||
            groupIdsSet.has(item.source_group_exercise_id);
          if (!matches) continue;

          for (const set of item.sets) {
            if (set.is_done && set.weight != null && set.reps != null) {
              sessionVolume += set.weight * set.reps;
              const e1rm = computeE1RM(set.weight, set.reps);
              if (e1rm > e1rmBest) e1rmBest = e1rm;
              if (e1rm > sessionBestE1rm) sessionBestE1rm = e1rm;
              if (!lastPerformedAt || (set.completed_at && set.completed_at > lastPerformedAt)) {
                lastPerformedAt = set.completed_at;
              }
              if (!lastSessionProcessed) {
                sessionSets.push({ weight: set.weight, reps: set.reps });
              }
            }
          }
        }
      }

      if (sessionVolume > 0) {
        volumeTrend.unshift(sessionVolume);
        if (sessionBestE1rm > 0) e1rmTrend.unshift(sessionBestE1rm);
      }
      if (!lastSessionProcessed && sessionSets.length > 0) {
        lastSessions.push(...sessionSets);
        lastSessionProcessed = true;
      }
    }

    const targetReps = { min: 8, max: 12 };
    const targetRIR = 1;
    const perf = await this.progressionService.getLastSessionPerformance(userId, exerciseId);
    const suggestion = this.progressionService.computeSuggestion(perf, targetReps, targetRIR);

    return {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      e1rmBest: e1rmBest > 0 ? e1rmBest : null,
      e1rmTrend: e1rmTrend.slice(-limit),
      volumeTrend: volumeTrend.slice(-limit),
      lastSessions,
      lastPerformedAt,
      nextSuggestion: { type: suggestion.type, value: suggestion.value }
    };
  }

  async getMusclesEffectiveVolume(
    userId: string,
    days = 28,
    includeTargets = false
  ): Promise<MusclesEffectiveVolume | { effective: MusclesEffectiveVolume; targets: Record<string, { min: number; max: number }> }> {
    const safeDays = Math.min(Math.max(Number(days) || 28, 1), 365);
    const from = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        user_id: userId,
        started_at: { gte: from },
        status: WorkoutSessionStatus.FINISHED
      },
      include: {
        workout_groups: {
          include: {
            workout_items: {
              include: { sets: true }
            }
          }
        }
      }
    });

    const groupExerciseIds = [
      ...new Set(
        sessions.flatMap((s) =>
          s.workout_groups.flatMap((g) =>
            g.workout_items.map((i) => i.source_group_exercise_id)
          )
        )
      )
    ];
    const overrideIds = [
      ...new Set(
        sessions.flatMap((s) =>
          s.workout_groups.flatMap((g) =>
            g.workout_items
              .map((i) => i.exercise_id_override)
              .filter((id): id is string => !!id)
          )
        )
      )
    ];

    const groupExercises = await this.prisma.groupExercise.findMany({
      where: { id: { in: groupExerciseIds } },
      include: { exercise: { select: { primary_submuscle: true, secondary_muscles: true, exercise_type: true } } }
    });
    const overrideExercises =
      overrideIds.length > 0
        ? await this.prisma.exercise.findMany({
            where: { id: { in: overrideIds } },
            select: { id: true, primary_submuscle: true, secondary_muscles: true, exercise_type: true }
          })
        : [];
    const groupExById = new Map(groupExercises.map((ge) => [ge.id, ge.exercise]));
    const overrideExById = new Map(overrideExercises.map((e) => [e.id, e]));

    const sessionEntries: Array<{ exercises: ExerciseSetEntry[] }> = [];

    for (const session of sessions) {
      const exercises: ExerciseSetEntry[] = [];
      for (const group of session.workout_groups) {
        for (const item of group.workout_items) {
          const ex = item.exercise_id_override
            ? overrideExById.get(item.exercise_id_override)
            : groupExById.get(item.source_group_exercise_id);
          if (!ex) continue;
          const setsDone = item.sets.filter((s) => s.is_done).length;
          if (setsDone === 0) continue;
          exercises.push({
            exercise: {
              primary_submuscle: ex.primary_submuscle,
              secondary_muscles: ex.secondary_muscles,
              exercise_type: ex.exercise_type as "COMPOUND" | "ISOLATION" | null | undefined
            },
            sets: setsDone
          });
        }
      }
      if (exercises.length > 0) sessionEntries.push({ exercises });
    }

    const weekly = aggregatePerWeek(sessionEntries);
    const result: MusclesEffectiveVolume = {};
    for (const [sub, val] of weekly) {
      result[sub] = val;
    }
    if (includeTargets) {
      return { effective: result, targets: SUBMUSCLE_MAV_TARGETS };
    }
    return result;
  }

  async getBody(userId: string): Promise<Record<string, unknown> | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { weight_kg: true, height_cm: true, body_fat_pct: true, age: true }
    });
    if (!user) return null;
    return {
      weight_kg: user.weight_kg,
      height_cm: user.height_cm,
      body_fat_pct: user.body_fat_pct,
      age: user.age
    };
  }

  /** Weekly check-in: store feedback and compute readiness modifier */
  async submitCheckIn(
    userId: string,
    input: { fatigue: number; pain_location: string; sleep_quality: string; difficulty: string }
  ): Promise<{
    id: string;
    readinessModifier: number;
    blockVolumeIncreases: boolean;
    adjustments: string[];
  }> {
    let readinessModifier = 0;
    const blockVolumeIncreases = input.sleep_quality === "poor";
    let avoidOverheadPressing = false;
    let reduceSquatVolume = false;
    let reduceHingeCompounds = false;

    if (input.fatigue >= 4) readinessModifier -= 0.15;
    const difficultyNum = ["very_easy", "good", "hard", "very_hard"].indexOf(input.difficulty) + 1;
    if (difficultyNum <= 2) readinessModifier += 0.1;

    if (input.pain_location === "shoulder") avoidOverheadPressing = true;
    if (input.pain_location === "knee") reduceSquatVolume = true;
    if (input.pain_location === "back") reduceHingeCompounds = true;

    const adjustments: string[] = [];
    if (readinessModifier !== 0) {
      const pct = Math.abs(Math.round(readinessModifier * 100));
      adjustments.push(
        readinessModifier < 0
          ? `Volumen reducido un ${pct}%`
          : `Volumen aumentado un ${pct}%`
      );
    }
    if (blockVolumeIncreases) adjustments.push("Sin aumentos de volumen esta semana");
    if (avoidOverheadPressing) adjustments.push("Presses por encima de la cabeza limitados");
    if (reduceSquatVolume) adjustments.push("Volumen de sentadillas reducido");
    if (reduceHingeCompounds) adjustments.push("Compuestos de bisagra reducidos");

    const checkIn = await this.prisma.progressCheckIn.create({
      data: {
        user_id: userId,
        fatigue: input.fatigue,
        pain_location: input.pain_location,
        sleep_quality: input.sleep_quality,
        difficulty: input.difficulty,
        readiness_modifier: readinessModifier,
        block_volume_increases: blockVolumeIncreases,
        avoid_overhead_pressing: avoidOverheadPressing,
        reduce_squat_volume: reduceSquatVolume,
        reduce_hinge_compounds: reduceHingeCompounds
      }
    });

    return {
      id: checkIn.id,
      readinessModifier,
      blockVolumeIncreases,
      adjustments: adjustments.length > 0 ? adjustments : ["Sin ajustes esta semana"]
    };
  }

  /** Get latest check-in for UI (show card only if never or >7 days) */
  async getLatestCheckIn(userId: string): Promise<{ created_at: Date } | null> {
    return this.prisma.progressCheckIn.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      select: { created_at: true }
    });
  }

  /** Get latest check-in context for generator */
  async getCheckInContext(userId: string): Promise<{
    readinessModifier: number;
    blockVolumeIncreases: boolean;
    avoidOverheadPressing: boolean;
    reduceSquatVolume: boolean;
    reduceHingeCompounds: boolean;
  } | null> {
    const checkIn = await this.prisma.progressCheckIn.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" }
    });
    if (!checkIn) return null;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (checkIn.created_at < sevenDaysAgo) return null;

    return {
      readinessModifier: checkIn.readiness_modifier,
      blockVolumeIncreases: checkIn.block_volume_increases,
      avoidOverheadPressing: checkIn.avoid_overhead_pressing,
      reduceSquatVolume: checkIn.reduce_squat_volume,
      reduceHingeCompounds: checkIn.reduce_hinge_compounds
    };
  }
}
