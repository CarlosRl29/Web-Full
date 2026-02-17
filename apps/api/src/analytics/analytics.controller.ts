import { Controller, Get, Param, Query } from "@nestjs/common";
import { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../common/current-user.decorator";
import { AnalyticsService } from "./analytics.service";

@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("workout-sessions/:id/analytics")
  getWorkoutSessionAnalytics(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.analyticsService.getWorkoutSessionAnalytics(id, user);
  }

  @Get("me/training-summary")
  getTrainingSummary(
    @CurrentUser() user: AuthUser,
    @Query("days") days?: string
  ) {
    const parsedDays = days ? Number(days) : 28;
    return this.analyticsService.getTrainingSummary(user.sub, parsedDays);
  }
}
