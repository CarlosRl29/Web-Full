import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { StartSessionInput, UpdateProgressInput } from "@gym/shared";
import { PrismaService } from "../prisma/prisma.service";

const defaultPointer = {
  group_index: 0,
  exercise_index: 0,
  set_index: 0,
  round_index: 0
};

@Injectable()
export class WorkoutSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async hasActiveAssignment(userId: string, routineId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        SELECT id
        FROM "RoutineAssignment"
        WHERE user_id = $1
          AND routine_id = $2
          AND is_active = TRUE
        LIMIT 1
      `,
      userId,
      routineId
    );
    return rows.length > 0;
  }

  private async withExerciseDetails<
    T extends {
      workout_groups: Array<{
        source_group_id: string;
        workout_items: Array<{
          source_group_exercise_id: string;
          exercise_name?: string | null;
          exercise_description?: string | null;
          exercise_media_url?: string | null;
        }>;
      }>;
    }
  >(
    session: T
  ): Promise<T> {
    const sourceGroupIds = session.workout_groups.map((group) => group.source_group_id);
    const groups = await this.prisma.exerciseGroup.findMany({
      where: { id: { in: sourceGroupIds } },
      include: {
        exercises: {
          include: { exercise: true }
        }
      }
    });

    const exerciseMetaByGroupExerciseId = groups.reduce<
      Record<string, { name: string; description: string | null; media_url: string | null }>
    >(
      (acc, group) => {
        group.exercises.forEach((groupExercise) => {
          const exercise = groupExercise.exercise as unknown as {
            name: string;
            instructions?: string | null;
            media_url?: string | null;
            image_url?: string | null;
            video_url?: string | null;
          };
          acc[groupExercise.id] = {
            name: exercise.name,
            description: exercise.instructions ?? null,
            media_url: exercise.video_url ?? exercise.image_url ?? exercise.media_url ?? null
          };
        });
        return acc;
      },
      {} as Record<string, { name: string; description: string | null; media_url: string | null }>
    );

    return {
      ...session,
      workout_groups: session.workout_groups.map((group) => ({
        ...group,
        workout_items: group.workout_items.map((item) => ({
          ...item,
          exercise_name:
            exerciseMetaByGroupExerciseId[item.source_group_exercise_id]?.name ??
            item.exercise_name ??
            null,
          exercise_description:
            exerciseMetaByGroupExerciseId[item.source_group_exercise_id]?.description ??
            item.exercise_description ??
            null,
          exercise_media_url:
            exerciseMetaByGroupExerciseId[item.source_group_exercise_id]?.media_url ??
            item.exercise_media_url ??
            null
        }))
      }))
    } as T;
  }

  async start(input: StartSessionInput, userId: string) {
    const routine = await this.prisma.routine.findUnique({
      where: { id: input.routine_id }
    });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    const hasAssignment = await this.hasActiveAssignment(userId, input.routine_id);
    if (routine.owner_id !== userId && !hasAssignment) {
      throw new ForbiddenException("Routine does not belong to user");
    }

    const day = await this.prisma.routineDay.findUnique({
      where: { id: input.day_id },
      include: {
        groups: {
          include: {
            exercises: true
          },
          orderBy: { order_index: "asc" }
        }
      }
    });
    if (!day || day.routine_id !== input.routine_id) {
      throw new NotFoundException("Routine day not found");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.workoutSession.updateMany({
        where: { user_id: userId, status: "ACTIVE" },
        data: { status: "PAUSED" }
      });

      const session = await tx.workoutSession.create({
        data: {
          user_id: userId,
          routine_id: input.routine_id,
          routine_day_id: input.day_id,
          status: "ACTIVE",
          current_pointer: defaultPointer,
          override_rest_between_exercises_seconds:
            input.overrides?.rest_between_exercises_seconds,
          override_rest_after_round_seconds: input.overrides?.rest_after_round_seconds,
          override_rest_after_set_seconds: input.overrides?.rest_after_set_seconds
        }
      });

      for (const group of day.groups) {
        const restBetween =
          input.overrides?.rest_between_exercises_seconds ??
          group.rest_between_exercises_seconds;
        const restAfterRound =
          input.overrides?.rest_after_round_seconds ?? group.rest_after_round_seconds;
        const restAfterSet =
          input.overrides?.rest_after_set_seconds ?? group.rest_after_set_seconds;

        const workoutGroup = await tx.workoutGroup.create({
          data: {
            workout_session_id: session.id,
            source_group_id: group.id,
            type: group.type,
            order_index: group.order_index,
            rounds_total: group.rounds_total,
            round_current: 1,
            rest_between_exercises_seconds: restBetween,
            rest_after_round_seconds: restAfterRound,
            rest_after_set_seconds: restAfterSet
          }
        });

        for (const groupExercise of group.exercises) {
          const targetSetsTotal =
            groupExercise.target_sets_per_round * group.rounds_total;
          const workoutExercise = await tx.workoutExerciseItem.create({
            data: {
              workout_group_id: workoutGroup.id,
              source_group_exercise_id: groupExercise.id,
              order_in_group: groupExercise.order_in_group,
              target_sets_total: targetSetsTotal,
              rep_range: groupExercise.rep_range,
              notes: groupExercise.notes
            }
          });

          for (let setNumber = 1; setNumber <= targetSetsTotal; setNumber += 1) {
            await tx.workoutSet.create({
              data: {
                workout_exercise_item_id: workoutExercise.id,
                set_number: setNumber
              }
            });
          }
        }
      }

      const created = await tx.workoutSession.findUniqueOrThrow({
        where: { id: session.id },
        include: {
          workout_groups: {
            include: {
              workout_items: {
                include: {
                  sets: true
                },
                orderBy: { order_in_group: "asc" }
              }
            },
            orderBy: { order_index: "asc" }
          }
        }
      });
      return this.withExerciseDetails(created);
    });
  }

  async getActive(userId: string) {
    const active = await this.prisma.workoutSession.findFirst({
      where: { user_id: userId, status: "ACTIVE" },
      include: {
        workout_groups: {
          include: {
            workout_items: {
              include: { sets: true },
              orderBy: { order_in_group: "asc" }
            }
          },
          orderBy: { order_index: "asc" }
        }
      },
      orderBy: { started_at: "desc" }
    });
    if (!active) {
      return null;
    }
    return this.withExerciseDetails(active);
  }

  async patchProgress(input: UpdateProgressInput, userId: string) {
    const active = await this.prisma.workoutSession.findFirst({
      where: { user_id: userId, status: "ACTIVE" },
      orderBy: { started_at: "desc" }
    });
    if (!active) {
      throw new NotFoundException("No active session");
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.event_id) {
        try {
          await tx.$executeRawUnsafe(
            `
              INSERT INTO "WorkoutProcessedEvent" (session_id, event_id)
              VALUES ($1, $2)
            `,
            active.id,
            input.event_id
          );
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code !== "P2002"
          ) {
            throw error;
          }
          // duplicate event_id for this session -> idempotent return
          const duplicateSnapshot = await tx.workoutSession.findUniqueOrThrow({
            where: { id: active.id },
            include: {
              workout_groups: {
                include: {
                  workout_items: {
                    include: { sets: true },
                    orderBy: { order_in_group: "asc" }
                  }
                },
                orderBy: { order_index: "asc" }
              }
            }
          });
          return this.withExerciseDetails(duplicateSnapshot);
        }
      }

      if (input.current_pointer) {
        await tx.workoutSession.update({
          where: { id: active.id },
          data: { current_pointer: input.current_pointer as unknown as Prisma.JsonObject }
        });
      }

      if (input.set_update) {
        const setToUpdate = await tx.workoutSet.findFirst({
          where: {
            workout_exercise_item_id: input.set_update.workout_exercise_item_id,
            set_number: input.set_update.set_number
          },
          include: {
            workout_exercise_item: {
              include: { workout_group: true }
            }
          }
        });
        if (!setToUpdate) {
          throw new NotFoundException("Set not found");
        }
        if (setToUpdate.workout_exercise_item.workout_group.workout_session_id !== active.id) {
          throw new ForbiddenException("Set does not belong to active session");
        }

        await tx.workoutSet.update({
          where: { id: setToUpdate.id },
          data: {
            weight: input.set_update.weight,
            reps: input.set_update.reps,
            rpe: input.set_update.rpe,
            is_done: input.set_update.is_done,
            completed_at: input.set_update.is_done ? new Date() : null
          }
        });
      }

      const updated = await tx.workoutSession.findUniqueOrThrow({
        where: { id: active.id },
        include: {
          workout_groups: {
            include: {
              workout_items: {
                include: { sets: true },
                orderBy: { order_in_group: "asc" }
              }
            },
            orderBy: { order_index: "asc" }
          }
        }
      });
      return this.withExerciseDetails(updated);
    });
  }

  async finish(userId: string, sessionId?: string) {
    const active = await this.prisma.workoutSession.findFirst({
      where: {
        user_id: userId,
        status: "ACTIVE",
        ...(sessionId ? { id: sessionId } : {})
      },
      orderBy: { started_at: "desc" }
    });
    if (!active) {
      throw new NotFoundException("No active session");
    }

    const finished = await this.prisma.workoutSession.update({
      where: { id: active.id },
      data: {
        status: "FINISHED",
        ended_at: new Date()
      }
    });
    return finished;
  }
}
