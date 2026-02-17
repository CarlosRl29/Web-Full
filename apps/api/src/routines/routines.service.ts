import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CreateRoutineInput, SaveRoutineDayStructureInput } from "@gym/shared";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RoutinesService {
  constructor(private readonly prisma: PrismaService) {}

  private repRangeToString(min: number, max: number): string {
    return min === max ? `${min}` : `${min}-${max}`;
  }

  private parseRepRange(repRange: string): { rep_range_min: number; rep_range_max: number } {
    const clean = repRange.trim();
    if (clean.includes("-")) {
      const [rawMin, rawMax] = clean.split("-");
      const min = Number(rawMin);
      const max = Number(rawMax);
      if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min) {
        return { rep_range_min: min, rep_range_max: max };
      }
    }
    const single = Number(clean);
    if (Number.isFinite(single) && single > 0) {
      return { rep_range_min: single, rep_range_max: single };
    }
    return { rep_range_min: 1, rep_range_max: 1 };
  }

  private async getAssignedRoutineIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.routineAssignment.findMany({
      where: { user_id: userId, is_active: true },
      select: { routine_id: true }
    });
    return rows.map((row) => row.routine_id);
  }

  private canReadRoutine(role: UserRole, ownerId: string, userId: string): boolean {
    return role === UserRole.ADMIN || ownerId === userId;
  }

  private async normalizeRoutineForWrite(
    tx: PrismaService,
    routineId: string,
    input: CreateRoutineInput
  ) {
    for (const day of input.days) {
      const routineDay = await tx.routineDay.create({
        data: {
          routine_id: routineId,
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
              rep_range: this.repRangeToString(
                exercise.rep_range_min,
                exercise.rep_range_max
              ),
              rep_range_min: exercise.rep_range_min,
              rep_range_max: exercise.rep_range_max,
              notes: exercise.notes
            }
          });
        }
      }
    }
  }

  private serializeRoutine(routine: any) {
    return {
      ...routine,
      days: routine.days.map((day: any) => ({
        ...day,
        groups: day.groups.map((group: any) => ({
          ...group,
          exercises: group.exercises.map((exercise: any) => ({
            ...exercise,
            ...this.parseRepRange(exercise.rep_range ?? "1-1")
          }))
        }))
      }))
    };
  }

  async listByUser(userId: string, role: UserRole) {
    const assignedRoutineIds =
      role === UserRole.USER ? await this.getAssignedRoutineIdsForUser(userId) : [];

    const whereClause =
      role === UserRole.ADMIN
        ? undefined
        : {
            OR: [{ owner_id: userId }, ...(assignedRoutineIds.map((id) => ({ id })) as any[])]
          };

    const routines = await this.prisma.routine.findMany({
      where: whereClause as any,
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
    return routines.map((routine) => this.serializeRoutine(routine));
  }

  async detail(id: string, userId: string, role: UserRole) {
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
    if (!this.canReadRoutine(role, routine.owner_id, userId)) {
      const assignedIds = await this.getAssignedRoutineIdsForUser(userId);
      if (!assignedIds.includes(routine.id)) {
        throw new ForbiddenException("Routine does not belong to user");
      }
    }
    return this.serializeRoutine(routine);
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

      await this.normalizeRoutineForWrite(tx as unknown as PrismaService, routine.id, input);

      const created = await tx.routine.findUniqueOrThrow({
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
      return this.serializeRoutine(created);
    });
  }

  async update(id: string, input: Partial<CreateRoutineInput>, ownerId: string, role: UserRole) {
    const routine = await this.prisma.routine.findUnique({ where: { id } });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    if (routine.owner_id !== ownerId && role !== UserRole.ADMIN) {
      throw new ForbiddenException("Routine does not belong to user");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.routine.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description
        }
      });

      if (input.days) {
        await tx.routineDay.deleteMany({ where: { routine_id: id } });
        await this.normalizeRoutineForWrite(tx as unknown as PrismaService, id, {
          name: input.name ?? routine.name,
          description: input.description ?? routine.description ?? undefined,
          days: input.days
        });
      }

      const updated = await tx.routine.findUniqueOrThrow({
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
      return this.serializeRoutine(updated);
    });
  }

  async saveDayStructure(
    routineId: string,
    dayId: string,
    input: SaveRoutineDayStructureInput,
    userId: string,
    role: UserRole
  ) {
    const routine = await this.prisma.routine.findUnique({ where: { id: routineId } });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    if (routine.owner_id !== userId && role !== UserRole.ADMIN) {
      throw new ForbiddenException("Routine does not belong to user");
    }

    const day = await this.prisma.routineDay.findUnique({ where: { id: dayId } });
    if (!day || day.routine_id !== routineId) {
      throw new NotFoundException("Routine day not found");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.routineDay.update({
        where: { id: dayId },
        data: {
          day_label: input.day_label,
          order_index: input.order_index
        }
      });

      await tx.exerciseGroup.deleteMany({ where: { routine_day_id: dayId } });

      for (const group of input.groups) {
        const createdGroup = await tx.exerciseGroup.create({
          data: {
            routine_day_id: dayId,
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
              rep_range: this.repRangeToString(
                exercise.rep_range_min,
                exercise.rep_range_max
              ),
              rep_range_min: exercise.rep_range_min,
              rep_range_max: exercise.rep_range_max,
              notes: exercise.notes
            }
          });
        }
      }

      const updated = await tx.routine.findUniqueOrThrow({
        where: { id: routineId },
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
      return this.serializeRoutine(updated);
    });
  }

  async remove(id: string, ownerId: string, role: UserRole) {
    const routine = await this.prisma.routine.findUnique({ where: { id } });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    if (routine.owner_id !== ownerId && role !== UserRole.ADMIN) {
      throw new ForbiddenException("Routine does not belong to user");
    }
    await this.prisma.routine.delete({ where: { id } });
    return { deleted: true };
  }
}
