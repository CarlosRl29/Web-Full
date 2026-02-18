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
  createRoutineReviewSchema,
  createRoutineSchema,
  publishRoutineSchema,
  saveRoutineDayStructureSchema,
  setActiveRoutineSchema,
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

  @Get("owned")
  listOwned(@CurrentUser() user: AuthUser) {
    return this.routinesService.listOwnedByUser(user.sub, user.role);
  }

  @Get("assigned")
  listAssigned(@CurrentUser() user: AuthUser) {
    return this.routinesService.listAssignedToUser(user.sub);
  }

  @Get("active")
  getActiveRoutine(@CurrentUser() user: AuthUser) {
    return this.routinesService.getActiveRoutine(user.sub);
  }

  @Patch("active")
  @UsePipes(new ZodValidationPipe(setActiveRoutineSchema))
  setActiveRoutine(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.routinesService.setActiveRoutine(user.sub, body as never);
  }

  @Get("marketplace")
  listMarketplace(@CurrentUser() user: AuthUser) {
    return this.routinesService.listMarketplace(user.sub, user.role);
  }

  @Get("marketplace/:id")
  detailMarketplace(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.routinesService.marketplaceDetail(id, user.sub, user.role);
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

  @Patch(":id/publish")
  @Roles(UserRole.COACH, UserRole.ADMIN)
  @UsePipes(new ZodValidationPipe(publishRoutineSchema))
  publish(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    return this.routinesService.publishRoutine(id, user.sub, user.role, body as never);
  }

  @Post(":id/clone")
  @Roles(UserRole.USER, UserRole.COACH, UserRole.ADMIN)
  cloneRoutine(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.routinesService.clonePublicRoutine(id, user.sub);
  }

  @Post(":id/reviews")
  @Roles(UserRole.USER, UserRole.COACH, UserRole.ADMIN)
  @UsePipes(new ZodValidationPipe(createRoutineReviewSchema))
  createReview(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    return this.routinesService.upsertRoutineReview(id, user.sub, body as never);
  }

  @Post(":id/follow")
  @Roles(UserRole.USER, UserRole.COACH, UserRole.ADMIN)
  followCoach(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.routinesService.followRoutineCoach(id, user.sub);
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
