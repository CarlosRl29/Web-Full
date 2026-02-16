import { Body, Controller, Get, Param, Post, Query, UsePipes } from "@nestjs/common";
import { createExerciseSchema, exerciseQuerySchema } from "@gym/shared";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/current-user.decorator";
import { Roles } from "../common/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthUser } from "../auth/auth.types";
import { ExercisesService } from "./exercises.service";

@Controller("exercises")
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    const parsed = exerciseQuerySchema.parse(query);
    return this.exercisesService.list(parsed.search, parsed.limit);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.exercisesService.detail(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @UsePipes(new ZodValidationPipe(createExerciseSchema))
  create(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.exercisesService.create(body as never, user.sub);
  }
}
