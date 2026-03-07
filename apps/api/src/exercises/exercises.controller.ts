import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import { createExerciseSchema, exerciseQuerySchema, updateExerciseSchema } from "@gym/shared";
import { ZodError } from "zod";
import { Public } from "../common/public.decorator";
import { CurrentUser } from "../common/current-user.decorator";
import { Roles } from "../common/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthUser } from "../auth/auth.types";
import type { MuscleGroup } from "./exercise-types";
import { ExercisesService } from "./exercises.service";

@Controller("exercises")
export class ExercisesController {
  private readonly logger = new Logger(ExercisesController.name);

  constructor(private readonly exercisesService: ExercisesService) {}

  @Public()
  @Get("filter-options")
  filterOptions() {
    return this.exercisesService.getFilterOptions();
  }

  @Public()
  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    let parsed: { search?: string; limit: number; muscle?: string; submuscle?: string; body_part?: string; equipment?: string; locale?: "es" | "en" };
    try {
      parsed = exerciseQuerySchema.parse(query);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException({ message: "Invalid query params", issues: e.issues });
      }
      throw e;
    }
    return this.exercisesService.list({
      search: parsed.search,
      limit: parsed.limit,
      muscle: parsed.muscle as MuscleGroup | undefined,
      submuscle: parsed.submuscle,
      body_part: parsed.body_part,
      equipment: parsed.equipment,
      locale: parsed.locale
    });
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.exercisesService.detail(id);
  }

  @Post()
  @Roles("ADMIN" as const)
  create(
    @Body(new ZodValidationPipe(createExerciseSchema)) body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    return this.exercisesService.create(body as never, user.sub);
  }

  @Patch(":id")
  @Roles("ADMIN" as const)
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateExerciseSchema)) body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    this.logger.log(`PATCH /exercises/${id} by ${user.sub}`);
    try {
      const result = await this.exercisesService.update(id, body as never);
      if (!result) {
        this.logger.warn(`Exercise ${id} not found`);
      }
      return result;
    } catch (err) {
      this.logger.error(`PATCH /exercises/${id} failed`, err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }
}
