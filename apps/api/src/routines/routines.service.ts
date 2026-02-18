import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CreateRoutineInput,
  CreateRoutineReviewInput,
  PublishRoutineInput,
  SaveRoutineDayStructureInput,
  SetActiveRoutineInput
} from "@gym/shared";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RoutinesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly routineInclude = {
    owner: { select: { id: true, full_name: true, role: true } },
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
      orderBy: { order_index: "asc" as const }
    },
    reviews: {
      include: { user: { select: { id: true, full_name: true } } },
      orderBy: { created_at: "desc" as const },
      take: 20
    },
    _count: { select: { reviews: true } }
  };

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
      owner_name: routine.owner?.full_name ?? null,
      reviews_count: routine._count?.reviews ?? routine.rating_count ?? 0,
      days: routine.days.map((day: any) => ({
        ...day,
        groups: day.groups.map((group: any) => ({
          ...group,
          exercises: group.exercises.map((exercise: any) => ({
            ...exercise,
            ...this.parseRepRange(exercise.rep_range ?? "1-1")
          }))
        }))
      })),
      reviews: (routine.reviews ?? []).map((review: any) => ({
        ...review,
        user_name: review.user?.full_name ?? null
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
      include: this.routineInclude,
      orderBy: { created_at: "desc" }
    });
    return routines.map((routine) => this.serializeRoutine(routine));
  }

  async listOwnedByUser(userId: string, role: UserRole) {
    const routines = await this.prisma.routine.findMany({
      where: role === UserRole.ADMIN ? undefined : { owner_id: userId },
      include: this.routineInclude,
      orderBy: { created_at: "desc" }
    });
    return routines.map((routine) => this.serializeRoutine(routine));
  }

  async listAssignedToUser(userId: string) {
    const assignmentRows = await this.prisma.routineAssignment.findMany({
      where: { user_id: userId, is_active: true },
      select: { routine_id: true }
    });
    if (assignmentRows.length === 0) {
      return [];
    }
    const routines = await this.prisma.routine.findMany({
      where: { id: { in: assignmentRows.map((row) => row.routine_id) } },
      include: this.routineInclude,
      orderBy: { created_at: "desc" }
    });
    return routines.map((routine) => this.serializeRoutine(routine));
  }

  async getActiveRoutine(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { active_routine_id: true }
    });
    if (!user?.active_routine_id) {
      return null;
    }
    const routine = await this.prisma.routine.findUnique({
      where: { id: user.active_routine_id },
      include: this.routineInclude
    });
    if (!routine) {
      return null;
    }
    return this.serializeRoutine(routine);
  }

  async setActiveRoutine(userId: string, input: SetActiveRoutineInput) {
    const routine = await this.prisma.routine.findUnique({ where: { id: input.routine_id } });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    const assigned = await this.prisma.routineAssignment.findFirst({
      where: {
        user_id: userId,
        routine_id: input.routine_id,
        is_active: true
      }
    });
    if (routine.owner_id !== userId && !assigned) {
      throw new ForbiddenException("Routine does not belong to user");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { active_routine_id: input.routine_id }
    });
    return this.getActiveRoutine(userId);
  }

  async listMarketplace(userId: string, role: UserRole) {
    const routines = await this.prisma.routine.findMany({
      where: {
        OR: [
          { is_public: true },
          ...(role === UserRole.ADMIN ? [{ owner_id: userId }] : [])
        ]
      },
      include: this.routineInclude,
      orderBy: [{ rating_average: "desc" }, { created_at: "desc" }]
    });
    return routines.map((routine) => this.serializeRoutine(routine));
  }

  async marketplaceDetail(id: string, userId: string, role: UserRole) {
    const routine = await this.prisma.routine.findUnique({
      where: { id },
      include: this.routineInclude
    });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    if (!routine.is_public && routine.owner_id !== userId && role !== UserRole.ADMIN) {
      throw new ForbiddenException("Routine is not public");
    }
    return this.serializeRoutine(routine);
  }

  async detail(id: string, userId: string, role: UserRole) {
    const routine = await this.prisma.routine.findUnique({
      where: { id },
      include: this.routineInclude
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
        include: this.routineInclude
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
        include: this.routineInclude
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
        include: this.routineInclude
      });
      return this.serializeRoutine(updated);
    });
  }

  async publishRoutine(
    id: string,
    actorId: string,
    role: UserRole,
    input: PublishRoutineInput
  ) {
    const routine = await this.prisma.routine.findUnique({ where: { id } });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    if (role !== UserRole.ADMIN && routine.owner_id !== actorId) {
      throw new ForbiddenException("Routine does not belong to user");
    }
    const updated = await this.prisma.routine.update({
      where: { id },
      data: {
        is_public: input.is_public,
        published_at: input.is_public ? new Date() : null,
        marketplace_title: input.marketplace_title,
        marketplace_goal: input.marketplace_goal,
        marketplace_level: input.marketplace_level,
        marketplace_days_per_week: input.marketplace_days_per_week,
        marketplace_duration_weeks: input.marketplace_duration_weeks,
        marketplace_description: input.marketplace_description,
        marketplace_tags: input.marketplace_tags
      },
      include: this.routineInclude
    });
    return this.serializeRoutine(updated);
  }

  async clonePublicRoutine(routineId: string, userId: string) {
    const source = await this.prisma.routine.findUnique({
      where: { id: routineId },
      include: this.routineInclude
    });
    if (!source) {
      throw new NotFoundException("Routine not found");
    }
    if (!source.is_public && source.owner_id !== userId) {
      throw new ForbiddenException("Routine is not public");
    }

    const input: CreateRoutineInput = {
      name: `${source.name} (copia)`,
      description: source.description ?? undefined,
      days: source.days.map((day: any, dayIndex: number) => ({
        day_label: day.day_label,
        order_index: day.order_index ?? dayIndex,
        groups: day.groups.map((group: any, groupIndex: number) => ({
          type: group.type,
          order_index: group.order_index ?? groupIndex,
          rounds_total: group.rounds_total,
          rest_between_exercises_seconds: group.rest_between_exercises_seconds,
          rest_after_round_seconds: group.rest_after_round_seconds,
          rest_after_set_seconds: group.rest_after_set_seconds ?? undefined,
          exercises: group.exercises.map((exercise: any) => ({
            exercise_id: exercise.exercise_id,
            order_in_group: exercise.order_in_group,
            target_sets_per_round: exercise.target_sets_per_round,
            rep_range_min: exercise.rep_range_min ?? this.parseRepRange(exercise.rep_range ?? "1").rep_range_min,
            rep_range_max: exercise.rep_range_max ?? this.parseRepRange(exercise.rep_range ?? "1").rep_range_max,
            notes: exercise.notes ?? undefined
          }))
        }))
      }))
    };
    const created = await this.create(input, userId);
    return created;
  }

  async upsertRoutineReview(routineId: string, userId: string, input: CreateRoutineReviewInput) {
    const routine = await this.prisma.routine.findUnique({ where: { id: routineId } });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    if (!routine.is_public && routine.owner_id !== userId) {
      throw new ForbiddenException("Routine is not public");
    }
    await this.prisma.routineReview.upsert({
      where: {
        routine_id_user_id: {
          routine_id: routineId,
          user_id: userId
        }
      },
      update: {
        rating: input.rating,
        review: input.review
      },
      create: {
        routine_id: routineId,
        user_id: userId,
        rating: input.rating,
        review: input.review
      }
    });
    const aggregate = await this.prisma.routineReview.aggregate({
      where: { routine_id: routineId },
      _avg: { rating: true },
      _count: { rating: true }
    });
    await this.prisma.routine.update({
      where: { id: routineId },
      data: {
        rating_average: aggregate._avg.rating ?? 0,
        rating_count: aggregate._count.rating
      }
    });
    const updated = await this.prisma.routine.findUniqueOrThrow({
      where: { id: routineId },
      include: this.routineInclude
    });
    return this.serializeRoutine(updated);
  }

  async followRoutineCoach(routineId: string, userId: string) {
    const routine = await this.prisma.routine.findUnique({
      where: { id: routineId },
      select: { owner_id: true, is_public: true }
    });
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }
    if (!routine.is_public && routine.owner_id !== userId) {
      throw new ForbiddenException("Routine is not public");
    }
    if (routine.owner_id === userId) {
      throw new ForbiddenException("Cannot follow yourself");
    }
    const follow = await this.prisma.coachFollow.upsert({
      where: {
        user_id_coach_id: {
          user_id: userId,
          coach_id: routine.owner_id
        }
      },
      update: {},
      create: {
        user_id: userId,
        coach_id: routine.owner_id
      }
    });
    return follow;
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
