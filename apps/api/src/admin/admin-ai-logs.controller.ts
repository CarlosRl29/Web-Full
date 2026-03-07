import { Controller, Get, Query } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../common/current-user.decorator";
import { Roles } from "../common/roles.decorator";
import { AdminAiLogsService } from "./admin-ai-logs.service";

@Controller("admin/ai")
export class AdminAiLogsController {
  constructor(private readonly adminAiLogsService: AdminAiLogsService) {}

  @Get("logs")
  @Roles(UserRole.ADMIN)
  getLogs(
    @CurrentUser() _user: AuthUser,
    @Query("limit") limit?: string
  ) {
    const parsedLimit = limit ? Math.min(Math.max(Number(limit), 1), 100) : 50;
    return this.adminAiLogsService.getRoutineGenerationLogs(parsedLimit);
  }
}
