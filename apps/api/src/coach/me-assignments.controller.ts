import { Controller, Get } from "@nestjs/common";
import { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../common/current-user.decorator";
import { CoachService } from "./coach.service";

@Controller("me")
export class MeAssignmentsController {
  constructor(private readonly coachService: CoachService) {}

  @Get("assignments")
  listMyAssignments(@CurrentUser() user: AuthUser) {
    return this.coachService.listMyAssignments(user.sub);
  }
}
