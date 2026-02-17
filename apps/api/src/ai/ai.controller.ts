import { Body, Controller, Get, Param, Post, Query, Res, UsePipes } from "@nestjs/common";
import { Response } from "express";
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

  @Get("logs/export.csv")
  @Roles(UserRole.COACH, UserRole.ADMIN)
  async exportLogsCsv(
    @CurrentUser() user: AuthUser,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("user_id") userId: string | undefined,
    @Query("coach_id") coachId: string | undefined,
    @Query("safety_flag") safetyFlag: string | undefined,
    @Res() res: Response
  ) {
    const csv = await this.aiService.exportLogsCsv(user, {
      from,
      to,
      user_id: userId,
      coach_id: coachId,
      safety_flag: safetyFlag
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"ai_audit_${stamp}.csv\"`);
    res.status(200).send(csv);
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

  @Get("alerts")
  @Roles(UserRole.COACH, UserRole.ADMIN)
  getAlerts(@CurrentUser() user: AuthUser, @Query("window_hours") windowHours?: string) {
    return this.aiService.getAlerts(user, windowHours ? Number(windowHours) : 24);
  }
}
