import { Body, Controller, Get, Post } from "@nestjs/common";
import { CurrentUser } from "../common/current-user.decorator";
import { AuthUser } from "../auth/auth.types";
import { PlansService } from "./plans.service";

@Controller("plans")
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post("start")
  startPlan(
    @CurrentUser() user: AuthUser,
    @Body() body: { goal: string; priorityArea: string; weeksTotal: number; milestones?: unknown }
  ) {
    return this.plansService.startPlan(user.sub, body);
  }

  @Get("current")
  getCurrentPlan(@CurrentUser() user: AuthUser) {
    return this.plansService.getCurrentPlan(user.sub);
  }
}
