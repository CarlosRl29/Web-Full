import { Body, Controller, Get, Param, Post, Query, UsePipes } from "@nestjs/common";
import {
  aiRecommendationRequestSchema
} from "@gym/shared";
import { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../common/current-user.decorator";
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

  @Get("logs")
  getLogs(
    @CurrentUser() user: AuthUser,
    @Query("user_id") userId?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string
  ) {
    return this.aiService.getLogs(user, {
      user_id: userId,
      limit: limit ? Number(limit) : undefined,
      cursor
    });
  }

  @Get("logs/:id")
  getLogById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.aiService.getLogById(user, id);
  }
}
