import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../common/current-user.decorator";
import { AuthUser } from "../auth/auth.types";
import { WorkoutExerciseSwapService } from "./workout-exercise-swap.service";

@Controller("workout-sessions")
export class WorkoutExerciseSwapController {
  constructor(private readonly swapService: WorkoutExerciseSwapService) {}

  @Get(":workoutId/exercises/:workoutExerciseId/replacements")
  getReplacements(
    @CurrentUser() user: AuthUser,
    @Param("workoutId") workoutId: string,
    @Param("workoutExerciseId") workoutExerciseId: string,
    @Query("reason") reason?: string,
    @Query("locale") locale?: string,
    @Query("available_equipment") availableEquipment?: string,
    @Query("blocked_equipment") blockedEquipment?: string
  ) {
    return this.swapService.getReplacements(user.sub, workoutId, workoutExerciseId, {
      reason: reason as "EQUIPMENT_BUSY" | "NOT_AVAILABLE" | "PAIN" | "PREFERENCE" | "TOO_HARD" | undefined,
      locale: locale === "es" ? "es" : "en",
      available_equipment: availableEquipment,
      blocked_equipment: blockedEquipment
    });
  }

  @Post(":workoutId/exercises/:workoutExerciseId/swap")
  swap(
    @CurrentUser() user: AuthUser,
    @Param("workoutId") workoutId: string,
    @Param("workoutExerciseId") workoutExerciseId: string,
    @Body()
    body: {
      replacement_exercise_id: string;
      reason: "EQUIPMENT_BUSY" | "NOT_AVAILABLE" | "PAIN" | "PREFERENCE" | "TOO_HARD";
      save_preference: boolean;
    }
  ) {
    return this.swapService.swap(user.sub, workoutId, workoutExerciseId, body);
  }
}
