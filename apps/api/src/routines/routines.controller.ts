import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UsePipes
} from "@nestjs/common";
import { createRoutineSchema, updateRoutineSchema } from "@gym/shared";
import { CurrentUser } from "../common/current-user.decorator";
import { AuthUser } from "../auth/auth.types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RoutinesService } from "./routines.service";

@Controller("routines")
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Get()
  listByUser(@CurrentUser() user: AuthUser) {
    return this.routinesService.listByUser(user.sub);
  }

  @Get(":id")
  detail(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.routinesService.detail(id, user.sub);
  }

  @Post()
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
    return this.routinesService.update(id, body as never, user.sub);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.routinesService.remove(id, user.sub);
  }
}
