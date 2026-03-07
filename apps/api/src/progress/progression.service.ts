/**
 * AXION v1.1 - Progression Service
 * Double progression: add reps first, then load. Uses last WorkoutSet data.
 */

import { Injectable } from "@nestjs/common";
import { WorkoutSessionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type ProgressionSuggestionType = "ADD_REP" | "INCREASE_LOAD" | "MAINTAIN" | "DELOAD";

export type ProgressionSuggestion = {
  type: ProgressionSuggestionType;
  value?: number;
};

export type LastSessionPerformance = {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  setsCompleted: number;
  completedAt: Date | null;
} | null;

/** Epley e1RM: weight * (1 + reps/30) */
export function computeE1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

/** Get last session performance for an exercise (completed WorkoutSets) */
@Injectable()
export class ProgressionService {
  constructor(private readonly prisma: PrismaService) {}

  async getLastSessionPerformance(
    userId: string,
    exerciseId: string
  ): Promise<LastSessionPerformance> {
    const groupExerciseIds = (
      await this.prisma.groupExercise.findMany({
        where: { exercise_id: exerciseId },
        select: { id: true }
      })
    ).map((g) => g.id);

    const groupIdsSet = new Set(groupExerciseIds);
    const sessions = await this.prisma.workoutSession.findMany({
      where: { user_id: userId, status: WorkoutSessionStatus.FINISHED },
      orderBy: { started_at: "desc" },
      take: 20,
      include: {
        workout_groups: {
          include: {
            workout_items: { include: { sets: true } }
          }
        }
      }
    });

    for (const session of sessions) {
      for (const group of session.workout_groups) {
        for (const item of group.workout_items) {
          const matches =
            item.exercise_id_override === exerciseId ||
            groupIdsSet.has(item.source_group_exercise_id);
          if (!matches) continue;

          const doneSets = item.sets.filter((s) => s.is_done && s.reps != null);
          if (doneSets.length === 0) continue;

          const lastSet = doneSets[doneSets.length - 1];
          const maxWeightSet = doneSets.reduce(
            (best, s) =>
              (s.weight ?? 0) > (best?.weight ?? 0) ? s : best,
            doneSets[0]
          );

          return {
            weight: maxWeightSet.weight,
            reps: lastSet.reps,
            rpe: lastSet.rpe ?? null,
            setsCompleted: doneSets.length,
            completedAt: lastSet.completed_at
          };
        }
      }
    }
    return null;
  }

  /**
   * Double progression: add reps within range first, then add load.
   * targetReps: { min, max }, targetRIR: min RIR (e.g. 1 = close to failure)
   */
  computeSuggestion(
    performance: LastSessionPerformance,
    targetReps: { min: number; max: number },
    targetRIR: number
  ): ProgressionSuggestion {
    if (!performance || performance.reps == null) {
      return { type: "MAINTAIN" };
    }

    const { reps, weight, rpe } = performance;

    if (rpe != null && rpe >= 9.5) {
      return { type: "DELOAD", value: 0.9 };
    }

    if (reps >= targetReps.max && weight != null && weight > 0) {
      return { type: "INCREASE_LOAD", value: 2.5 };
    }

    if (reps < targetReps.min) {
      return { type: "MAINTAIN" };
    }

    if (reps < targetReps.max) {
      return { type: "ADD_REP" };
    }

    return { type: "MAINTAIN" };
  }
}
