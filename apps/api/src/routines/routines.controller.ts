import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Post,
  UsePipes
} from "@nestjs/common";
import {
  createRoutineSchema,
  saveRoutineDayStructureSchema,
  updateRoutineSchema
} from "@gym/shared";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/current-user.decorator";
import { AuthUser } from "../auth/auth.types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { Roles } from "../common/roles.decorator";
import { RoutinesService } from "./routines.service";

@Controller("routines")
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Get()
  listByUser(@CurrentUser() user: AuthUser) {
    return this.routinesService.listByUser(user.sub, user.role);
  }

  @Get(":id")
  detail(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.routinesService.detail(id, user.sub, user.role);
  }

  @Post()
  @Roles(UserRole.COACH, UserRole.ADMIN, UserRole.USER)
  @UsePipes(new ZodValidationPipe(createRoutineSchema))
  create(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.routinesService.create(body as never, user.sub);
  }

  @Patch(":id")
  @UsePipes(new ZodValidationPipe(updateRoutineSchema))
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    return this.routinesService.update(id, body as never, user.sub, user.role);
  }

  @Put(":id/days/:dayId/structure")
  @UsePipes(new ZodValidationPipe(saveRoutineDayStructureSchema))
  saveDayStructure(
    @Param("id") id: string,
    @Param("dayId") dayId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    return this.routinesService.saveDayStructure(
      id,
      dayId,
      body as never,
      user.sub,
      user.role
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.routinesService.remove(id, user.sub, user.role);
  }
}
