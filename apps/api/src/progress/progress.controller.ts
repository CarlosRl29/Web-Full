import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { checkInSchema } from "@gym/shared";
import { CurrentUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthUser } from "../auth/auth.types";
import { ProgressService } from "./progress.service";

@Controller("progress")
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get("overview")
  getOverview(
    @CurrentUser() user: AuthUser,
    @Query("days") days?: string
  ) {
    return this.progressService.getOverview(user.sub, days ? parseInt(days, 10) : undefined);
  }

  @Get("exercise/:id")
  getExerciseTrends(
    @CurrentUser() user: AuthUser,
    @Param("id") exerciseId: string,
    @Query("limit") limit?: string
  ) {
    return this.progressService.getExerciseTrends(
      user.sub,
      exerciseId,
      limit ? parseInt(limit, 10) : undefined
    );
  }

  @Get("muscles")
  getMusclesEffectiveVolume(
    @CurrentUser() user: AuthUser,
    @Query("days") days?: string,
    @Query("includeTargets") includeTargets?: string
  ) {
    return this.progressService.getMusclesEffectiveVolume(
      user.sub,
      days ? parseInt(days, 10) : undefined,
      includeTargets === "true" || includeTargets === "1"
    );
  }

  @Get("body")
  getBody(@CurrentUser() user: AuthUser) {
    return this.progressService.getBody(user.sub);
  }

  @Get("checkin/status")
  getCheckInStatus(@CurrentUser() user: AuthUser) {
    return this.progressService.getLatestCheckIn(user.sub);
  }

  @Post("checkin")
  submitCheckIn(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(checkInSchema)) body: unknown
  ) {
    return this.progressService.submitCheckIn(user.sub, body as never);
  }
}
