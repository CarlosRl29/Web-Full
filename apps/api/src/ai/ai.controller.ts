import { Body, Controller, Get, Param, Post, Query, UsePipes } from "@nestjs/common";
import {
  aiAppliedSuggestionSchema,
  aiRecommendationRequestSchema
} from "@gym/shared";
import { UserRole } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../common/current-user.decorator";
import { Roles } from "../common/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AiService } from "./ai.service";

@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("recommendations")
  @UsePipes(new ZodValidationPipe(aiRecommendationRequestSchema))
  getRecommendations(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.aiService.getRecommendations(body as never, user);
  }

  @Post("applied")
  @Roles(UserRole.COACH, UserRole.ADMIN)
  @UsePipes(new ZodValidationPipe(aiAppliedSuggestionSchema))
  createApplied(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.aiService.createAppliedSuggestion(user, body as never);
  }

  @Get("applied")
  @Roles(UserRole.COACH, UserRole.ADMIN)
  listApplied(
    @CurrentUser() user: AuthUser,
    @Query("routine_id") routineId?: string,
    @Query("day_id") dayId?: string
  ) {
    return this.aiService.listAppliedSuggestions(user, {
      routine_id: routineId,
      day_id: dayId
    });
  }

  @Get("logs")
  getLogs(
    @CurrentUser() user: AuthUser,
    @Query("user_id") userId?: string,
    @Query("safety_flag") safetyFlag?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string
  ) {
    return this.aiService.getLogs(user, {
      user_id: userId,
      safety_flag: safetyFlag,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      cursor
    });
  }

  @Get("logs/:id")
  getLogById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.aiService.getLogById(user, id);
  }

  @Get("metrics")
  @Roles(UserRole.COACH, UserRole.ADMIN)
  getMetrics(@CurrentUser() user: AuthUser, @Query("days") days?: string) {
    return this.aiService.getMetrics(user, days ? Number(days) : 7);
  }
}
