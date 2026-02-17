import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CreateRoutineAssignmentInput } from "@gym/shared";
import { UserRole } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CoachService {
  constructor(private readonly prisma: PrismaService) {}

  async createAssignment(input: CreateRoutineAssignmentInput, actor: AuthUser) {
    const [user, routine] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: input.user_id } }),
      this.prisma.routine.findUnique({ where: { id: input.routine_id } })
    ]);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (!routine) {
      throw new NotFoundException("Routine not found");
    }

    if (actor.role === UserRole.COACH && routine.owner_id !== actor.sub) {
      throw new ForbiddenException("Coach can only assign own routines");
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.is_active) {
        await tx.routineAssignment.updateMany({
          where: { user_id: input.user_id, is_active: true },
          data: { is_active: false }
        });
      }

      return tx.routineAssignment.upsert({
        where: {
          coach_id_user_id_routine_id: {
            coach_id: actor.sub,
            user_id: input.user_id,
            routine_id: input.routine_id
          }
        },
        update: {
          is_active: input.is_active ?? true,
          start_date: input.start_date ? new Date(input.start_date) : new Date(),
          coach_notes: input.coach_notes ?? null
        },
        create: {
          coach_id: actor.sub,
          user_id: input.user_id,
          routine_id: input.routine_id,
          is_active: input.is_active ?? true,
          start_date: input.start_date ? new Date(input.start_date) : new Date(),
          coach_notes: input.coach_notes ?? null
        },
        include: {
          routine: {
            select: { name: true }
          },
          user: {
            select: { full_name: true, email: true }
          },
          coach: {
            select: { full_name: true }
          }
        }
      });
    });
  }

  async getAssignmentById(id: string) {
    return this.prisma.routineAssignment.findUnique({
      where: { id },
      include: {
        routine: {
          select: { name: true }
        },
        user: {
          select: { full_name: true, email: true }
        },
        coach: {
          select: { full_name: true }
        }
      }
    });
  }

  async listMyAssignments(userId: string) {
    return this.prisma.routineAssignment.findMany({
      where: { user_id: userId },
      include: {
        coach: {
          select: { id: true, full_name: true }
        },
        routine: {
          select: { id: true, name: true }
        }
      },
      orderBy: { created_at: "desc" }
    });
  }

  async listCoachClients(actor: AuthUser) {
    return this.prisma.routineAssignment.findMany({
      where: { coach_id: actor.sub },
      include: {
        user: {
          select: { id: true, full_name: true, email: true }
        },
        routine: {
          select: { id: true, name: true }
        }
      },
      orderBy: { created_at: "desc" }
    });
  }

  async listUsers(search?: string) {
    return this.prisma.user.findMany({
      where: {
        role: UserRole.USER,
        ...(search
          ? {
              OR: [
                { full_name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      select: {
        id: true,
        full_name: true,
        email: true
      },
      orderBy: { created_at: "desc" },
      take: 100
    });
  }
}
