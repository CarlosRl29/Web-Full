import { Body, Controller, Get, Post, Query, UsePipes } from "@nestjs/common";
import { createRoutineAssignmentSchema } from "@gym/shared";
import { UserRole } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../common/current-user.decorator";
import { Roles } from "../common/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CoachService } from "./coach.service";

@Controller("coach")
export class CoachController {
  constructor(private readonly coachService: CoachService) {}

  @Post("assignments")
  @Roles(UserRole.COACH, UserRole.ADMIN)
  @UsePipes(new ZodValidationPipe(createRoutineAssignmentSchema))
  createAssignment(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.coachService.createAssignment(body as never, user);
  }

  @Get("clients")
  @Roles(UserRole.COACH, UserRole.ADMIN)
  listClients(@CurrentUser() user: AuthUser) {
    return this.coachService.listCoachClients(user);
  }

  @Get("users")
  @Roles(UserRole.COACH, UserRole.ADMIN)
  listUsers(@Query("search") search?: string) {
    return this.coachService.listUsers(search);
  }
}
