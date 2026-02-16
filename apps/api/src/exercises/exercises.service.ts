import { Injectable } from "@nestjs/common";
import { CreateExerciseInput } from "@gym/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  list(search?: string, limit = 25) {
    return this.prisma.exercise.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { muscle_group: { contains: search, mode: "insensitive" } }
            ]
          }
        : undefined,
      orderBy: { name: "asc" },
      take: limit
    });
  }

  detail(id: string) {
    return this.prisma.exercise.findUnique({ where: { id } });
  }

  create(input: CreateExerciseInput, userId: string) {
    return this.prisma.exercise.create({
      data: {
        ...input,
        created_by_id: userId
      }
    });
  }
}
