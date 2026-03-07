import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ExerciseReplacementService, type ReplacementConstraints, type SwapReason } from "../exercises/exercise-replacement.service";

@Injectable()
export class WorkoutExerciseSwapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly replacementService: ExerciseReplacementService
  ) {}

  async getReplacements(
    userId: string,
    workoutId: string,
    workoutExerciseId: string,
    query: { reason?: SwapReason; locale?: "es" | "en"; available_equipment?: string; blocked_equipment?: string }
  ) {
    const session = await this.prisma.workoutSession.findUnique({
      where: { id: workoutId },
      include: {
        workout_groups: {
          include: {
            workout_items: {
              where: { id: workoutExerciseId }
            }
          }
        }
      }
    });
    if (!session || session.user_id !== userId) {
      throw new NotFoundException("Workout not found");
    }
    const item = session.workout_groups.flatMap((g) => g.workout_items)[0];
    if (!item) {
      throw new NotFoundException("Workout exercise not found");
    }

    const groupEx = await this.prisma.groupExercise.findUnique({
      where: { id: item.source_group_exercise_id },
      include: { exercise: true }
    });
    if (!groupEx) {
      throw new NotFoundException("Source exercise not found");
    }
    const originalExerciseId = item.exercise_id_override ?? groupEx.exercise_id;

    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    const constraints: ReplacementConstraints = {
      reason: query.reason,
      user_level: user?.experience_level ?? undefined,
      available_equipment: query.available_equipment
        ? query.available_equipment.split(",").map((s) => s.trim())
        : undefined,
      blocked_equipment: query.blocked_equipment
        ? query.blocked_equipment.split(",").map((s) => s.trim())
        : undefined
    };

    const candidates = await this.replacementService.getReplacements(
      userId,
      originalExerciseId,
      constraints,
      query.locale === "es" ? "es" : "en",
      5
    );

    return candidates.map((c) => ({
      id: c.exercise.id,
      display_name: c.display_name,
      equipment: c.exercise.equipment,
      explanation: c.explanation,
      score: c.score
    }));
  }

  async swap(
    userId: string,
    workoutId: string,
    workoutExerciseId: string,
    body: {
      replacement_exercise_id: string;
      reason: SwapReason;
      save_preference: boolean;
    }
  ) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: workoutId, user_id: userId, status: "ACTIVE" }
    });
    if (!session) {
      throw new NotFoundException("Active workout not found");
    }

    const item = await this.prisma.workoutExerciseItem.findFirst({
      where: {
        id: workoutExerciseId,
        workout_group: { workout_session_id: workoutId }
      },
      include: {
        workout_group: true
      }
    });
    if (!item) {
      throw new NotFoundException("Workout exercise not found");
    }

    const groupEx = await this.prisma.groupExercise.findUnique({
      where: { id: item.source_group_exercise_id },
      include: { exercise: true }
    });
    if (!groupEx) {
      throw new NotFoundException("Source exercise not found");
    }
    const originalExerciseId = item.exercise_id_override ?? groupEx.exercise_id;

    const replacement = await this.prisma.exercise.findUnique({
      where: { id: body.replacement_exercise_id }
    });
    if (!replacement) {
      throw new NotFoundException("Replacement exercise not found");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.workoutExerciseItem.update({
        where: { id: workoutExerciseId },
        data: { exercise_id_override: body.replacement_exercise_id }
      });

      await tx.workoutExerciseSwap.create({
        data: {
          workout_session_id: workoutId,
          user_id: userId,
          original_exercise_id: originalExerciseId,
          replacement_exercise_id: body.replacement_exercise_id,
          reason: body.reason,
          saved_preference: body.save_preference
        }
      });

      if (body.save_preference) {
        const reasonMap = {
          EQUIPMENT_BUSY: "EQUIPMENT" as const,
          NOT_AVAILABLE: "EQUIPMENT" as const,
          PAIN: "PAIN" as const,
          PREFERENCE: "PREFERENCE" as const,
          TOO_HARD: "TOO_HARD" as const
        };
        const prefReason = reasonMap[body.reason];

        await tx.userExercisePreference.upsert({
          where: {
            user_id_exercise_id_preference_type: {
              user_id: userId,
              exercise_id: originalExerciseId,
              preference_type: "AVOID"
            }
          },
          update: { reason: prefReason, updated_at: new Date() },
          create: {
            user_id: userId,
            exercise_id: originalExerciseId,
            preference_type: "AVOID",
            reason: prefReason
          }
        });

        await tx.userExercisePreference.upsert({
          where: {
            user_id_exercise_id_preference_type: {
              user_id: userId,
              exercise_id: body.replacement_exercise_id,
              preference_type: "PREFER"
            }
          },
          update: { reason: prefReason, updated_at: new Date() },
          create: {
            user_id: userId,
            exercise_id: body.replacement_exercise_id,
            preference_type: "PREFER",
            reason: prefReason
          }
        });
      }

      return { success: true, message: "Ejercicio cambiado" };
    });
  }
}
