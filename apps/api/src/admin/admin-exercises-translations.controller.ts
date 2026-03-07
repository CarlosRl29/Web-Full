import { Body, Controller, Get, Patch, Param, Post, Query } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/current-user.decorator";
import { Roles } from "../common/roles.decorator";
import { AuthUser } from "../auth/auth.types";
import { AdminExercisesTranslationsService } from "./admin-exercises-translations.service";

@Controller("admin/exercises/translations")
export class AdminExercisesTranslationsController {
  constructor(private readonly service: AdminExercisesTranslationsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  list(
    @CurrentUser() _user: AuthUser,
    @Query("locale") locale?: "es" | "en"
  ) {
    return this.service.listTranslations(locale);
  }

  @Post("bulk-es")
  @Roles(UserRole.ADMIN)
  bulkCreateEs(@CurrentUser() _user: AuthUser) {
    return this.service.bulkCreateMissingEs();
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() _user: AuthUser,
    @Param("id") id: string,
    @Body() body: { name?: string; short_description?: string; technique_steps?: string[]; cues?: string[]; common_mistakes?: string[] }
  ) {
    return this.service.updateTranslation(id, body);
  }
}
