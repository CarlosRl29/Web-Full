import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Res
} from "@nestjs/common";
import { Response } from "express";
import {
  aiAppliedSuggestionSchema,
  aiGenerateRoutineAxionRequestSchema,
  aiGenerateRoutineRequestSchema,
  aiGenerateWorkoutDayRequestSchema,
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
  getRecommendations(
    @Body(new ZodValidationPipe(aiRecommendationRequestSchema)) body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    return this.aiService.getRecommendations(body as never, user);
  }

  @Post("generate-routine")
  async generateRoutine(
    @Body(new ZodValidationPipe(aiGenerateRoutineRequestSchema)) body: unknown,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: false }) res: Response
  ) {
    try {
      const result = await this.aiService.generateRoutine(body as never, user);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      if (err instanceof HttpException) {
        const payload = err.getResponse();
        if (payload && typeof payload === "object" && "errorCode" in payload) {
          return res.status(err.getStatus()).json(payload);
        }
      }
      throw err;
    }
  }

  @Post("generate-workout-day")
  async generateWorkoutDay(
    @Body(new ZodValidationPipe(aiGenerateWorkoutDayRequestSchema)) body: unknown,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: false }) res: Response
  ) {
    try {
      const result = await this.aiService.generateWorkoutDay(body as never, user);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      if (err instanceof HttpException) {
        const payload = err.getResponse();
        if (payload && typeof payload === "object" && "errorCode" in payload) {
          return res.status(err.getStatus()).json(payload);
        }
      }
      throw err;
    }
  }

  @Post("generate-routine-axion")
  async generateRoutineAxion(
    @Body(new ZodValidationPipe(aiGenerateRoutineAxionRequestSchema)) body: unknown,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: false }) res: Response
  ) {
    try {
      const result = await this.aiService.generateRoutineAxion(body as never, user);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      if (err instanceof HttpException) {
        const payload = err.getResponse();
        if (payload && typeof payload === "object" && "errorCode" in payload) {
          return res.status(err.getStatus()).json(payload);
        }
      }
      throw err;
    }
  }

  @Post("applied")
  @Roles(UserRole.COACH, UserRole.ADMIN)
  createApplied(
    @Body(new ZodValidationPipe(aiAppliedSuggestionSchema)) body: unknown,
    @CurrentUser() user: AuthUser
  ) {
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
