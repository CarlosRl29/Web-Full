import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CreateRoutineInput } from "@gym/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RoutinesService {
  constructor(private readonly prisma: PrismaService) {}

  listByUser(userId: string) {
    return this.prisma.routine.findMany({
      where: { owner_id: userId },
      include: {
        days: {
          include: {
            groups: {
              include: {
                exercises: {
                  include: { exercise: true }
                }
              }
            }
          },
          orderBy: { order_index: "asc" }
        }
      },
      orderBy: { created_at: "desc" }
    });
  }

  async detail(id: string, userId: string) {
    const routine = await this.prisma.routine.findUnique({
      where: { id },
      include: {
        days: {
          include: {
            groups: {
              include: {
                exercises: {
                  include: { exercise: true }
                }
              },
              orderBy: { order_index: "asc" }
            }
          },
          orderBy: { order_index: "asc" }
        }
      }
    });

    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    if (routine.owner_id !== userId) {
      throw new ForbiddenException("Routine does not belong to user");
    }
    return routine;
  }

  async create(input: CreateRoutineInput, ownerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const routine = await tx.routine.create({
        data: {
          owner_id: ownerId,
          name: input.name,
          description: input.description
        }
      });

      for (const day of input.days) {
        const routineDay = await tx.routineDay.create({
          data: {
            routine_id: routine.id,
            day_label: day.day_label,
            order_index: day.order_index
          }
        });

        for (const group of day.groups) {
          const createdGroup = await tx.exerciseGroup.create({
            data: {
              routine_day_id: routineDay.id,
              type: group.type,
              order_index: group.order_index,
              rounds_total: group.rounds_total,
              rest_between_exercises_seconds: group.rest_between_exercises_seconds,
              rest_after_round_seconds: group.rest_after_round_seconds,
              rest_after_set_seconds: group.rest_after_set_seconds
            }
          });

          for (const exercise of group.exercises) {
            await tx.groupExercise.create({
              data: {
                exercise_group_id: createdGroup.id,
                exercise_id: exercise.exercise_id,
                order_in_group: exercise.order_in_group,
                target_sets_per_round: exercise.target_sets_per_round,
                rep_range: exercise.rep_range,
                notes: exercise.notes
              }
            });
          }
        }
      }

      return tx.routine.findUniqueOrThrow({
        where: { id: routine.id },
        include: {
          days: {
            include: {
              groups: {
                include: {
                  exercises: true
                }
              }
            }
          }
        }
      });
    });
  }

  async update(id: string, input: Partial<CreateRoutineInput>, ownerId: string) {
    const routine = await this.prisma.routine.findUnique({ where: { id } });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    if (routine.owner_id !== ownerId) {
      throw new ForbiddenException("Routine does not belong to user");
    }

    return this.prisma.routine.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description
      }
    });
  }

  async remove(id: string, ownerId: string) {
    const routine = await this.prisma.routine.findUnique({ where: { id } });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    if (routine.owner_id !== ownerId) {
      throw new ForbiddenException("Routine does not belong to user");
    }
    await this.prisma.routine.delete({ where: { id } });
    return { deleted: true };
  }
}
