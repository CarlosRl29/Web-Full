import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole, WorkoutSessionStatus } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

type SessionWithSets = {
  id: string;
  user_id: string;
  routine_day_id: string;
  started_at: Date;
  status: WorkoutSessionStatus;
  workout_groups: Array<{
    workout_items: Array<{
      sets: Array<{
        weight: number | null;
        reps: number | null;
        rpe: number | null;
        is_done: boolean;
      }>;
    }>;
  }>;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private getMetrics(session: SessionWithSets) {
    let volume_total = 0;
    let reps_total = 0;
    let sets_done = 0;
    let sets_planned = 0;
    let rpe_sum = 0;
    let rpe_count = 0;

    for (const group of session.workout_groups) {
      for (const item of group.workout_items) {
        for (const set of item.sets) {
          sets_planned += 1;
          if (!set.is_done) {
            continue;
          }
          sets_done += 1;
          reps_total += set.reps ?? 0;
          if (set.weight != null && set.reps != null) {
            volume_total += set.weight * set.reps;
          }
          if (set.rpe != null) {
            rpe_sum += set.rpe;
            rpe_count += 1;
          }
        }
      }
    }

    return {
      volume_total,
      reps_total,
      sets_done,
      sets_planned,
      adherence: sets_planned > 0 ? sets_done / sets_planned : 0,
      average_rpe: rpe_count > 0 ? rpe_sum / rpe_count : null
    };
  }

  private async assertSessionAccess(session: SessionWithSets, actor: AuthUser) {
    if (actor.role === UserRole.ADMIN || session.user_id === actor.sub) {
      return;
    }

    if (actor.role === UserRole.COACH) {
      const assignment = await this.prisma.routineAssignment.findFirst({
        where: {
          coach_id: actor.sub,
          user_id: session.user_id,
          is_active: true
        },
        select: { id: true }
      });
      if (assignment) {
        return;
      }
    }

    throw new ForbiddenException("Not allowed to access this session");
  }

  async getWorkoutSessionAnalytics(sessionId: string, actor: AuthUser) {
    const session = await this.prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: {
        workout_groups: {
          include: {
            workout_items: {
              include: {
                sets: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundException("Workout session not found");
    }

    const normalized = session as unknown as SessionWithSets;
    await this.assertSessionAccess(normalized, actor);

    const current = this.getMetrics(normalized);

    const previous = await this.prisma.workoutSession.findFirst({
      where: {
        user_id: session.user_id,
        routine_day_id: session.routine_day_id,
        started_at: { lt: session.started_at },
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
      },
      orderBy: { started_at: "desc" }
    });

    const previousMetrics = previous
      ? this.getMetrics(previous as unknown as SessionWithSets)
      : null;

    const delta_volume =
      previousMetrics != null ? current.volume_total - previousMetrics.volume_total : null;
    const delta_percent =
      previousMetrics != null && previousMetrics.volume_total > 0
        ? (delta_volume! / previousMetrics.volume_total) * 100
        : null;

    return {
      session_id: session.id,
      routine_day_id: session.routine_day_id,
      started_at: session.started_at,
      status: session.status,
      volume_total: current.volume_total,
      reps_total: current.reps_total,
      sets_done: current.sets_done,
      progress_vs_previous_same_day:
        previousMetrics == null
          ? null
          : {
              previous_session_id: previous!.id,
              previous_volume_total: previousMetrics.volume_total,
              current_volume_total: current.volume_total,
              delta_volume,
              delta_percent
            }
    };
  }

  async getTrainingSummary(userId: string, days = 28) {
    const safeDays = Number.isFinite(days) ? Math.min(Math.max(days, 1), 365) : 28;
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
            workout_items: {
              include: { sets: true }
            }
          }
        }
      },
      orderBy: { started_at: "asc" }
    });

    const perSession = sessions.map((session) => ({
      session_id: session.id,
      routine_day_id: session.routine_day_id,
      started_at: session.started_at,
      status: session.status,
      ...this.getMetrics(session as unknown as SessionWithSets)
    }));

    const totals = perSession.reduce(
      (acc, current) => {
        acc.volume_total += current.volume_total;
        acc.reps_total += current.reps_total;
        acc.sets_done += current.sets_done;
        acc.sets_planned += current.sets_planned;
        if (current.average_rpe != null) {
          acc.rpe_weighted_sum += current.average_rpe;
          acc.rpe_count += 1;
        }
        return acc;
      },
      {
        volume_total: 0,
        reps_total: 0,
        sets_done: 0,
        sets_planned: 0,
        rpe_weighted_sum: 0,
        rpe_count: 0
      }
    );

    return {
      window_days: safeDays,
      sessions_count: perSession.length,
      volume_total: totals.volume_total,
      reps_total: totals.reps_total,
      sets_done: totals.sets_done,
      adherence: totals.sets_planned > 0 ? totals.sets_done / totals.sets_planned : 0,
      average_rpe: totals.rpe_count > 0 ? totals.rpe_weighted_sum / totals.rpe_count : null,
      sessions: perSession
    };
  }
}
