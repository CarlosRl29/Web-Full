import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import {
  finishSessionSchema,
  startSessionSchema,
  updateProgressSchema
} from "@gym/shared";
import { CurrentUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthUser } from "../auth/auth.types";
import { WorkoutSessionsService } from "./workout-sessions.service";

@Controller("workout-sessions")
export class WorkoutSessionsController {
  constructor(private readonly workoutSessionsService: WorkoutSessionsService) {}

  @Post("start")
  start(
    @Body(new ZodValidationPipe(startSessionSchema)) body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    return this.workoutSessionsService.start(body as never, user.sub);
  }

  @Get("active")
  getActive(@CurrentUser() user: AuthUser) {
    return this.workoutSessionsService.getActive(user.sub);
  }

  @Patch("progress")
  patchProgress(
    @Body(new ZodValidationPipe(updateProgressSchema)) body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    return this.workoutSessionsService.patchProgress(body as never, user.sub);
  }

  @Post("finish")
  finish(
    @Body(new ZodValidationPipe(finishSessionSchema)) body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    const { session_id } = body as { session_id: string };
    return this.workoutSessionsService.finish(user.sub, session_id);
  }
}
