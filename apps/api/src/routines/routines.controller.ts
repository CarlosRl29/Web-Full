import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Post
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
  setActiveRoutine(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(setActiveRoutineSchema)) body: unknown
  ) {
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
  create(
    @Body(new ZodValidationPipe(createRoutineSchema)) body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    return this.routinesService.create(body as never, user.sub);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRoutineSchema)) body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    return this.routinesService.update(id, body as never, user.sub, user.role);
  }

  @Patch(":id/publish")
  @Roles(UserRole.COACH, UserRole.ADMIN)
  publish(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(publishRoutineSchema)) body: unknown,
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
  createReview(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createRoutineReviewSchema)) body: unknown,
    @CurrentUser() user: AuthUser
  ) {
    return this.routinesService.upsertRoutineReview(id, user.sub, body as never);
  }

  @Post(":id/follow")
  @Roles(UserRole.USER, UserRole.COACH, UserRole.ADMIN)
  followCoach(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.routinesService.followRoutineCoach(id, user.sub);
  }

  @Post("coach/:coachId/follow")
  @Roles(UserRole.USER, UserRole.COACH, UserRole.ADMIN)
  followCoachById(@Param("coachId") coachId: string, @CurrentUser() user: AuthUser) {
    return this.routinesService.followCoachById(coachId, user.sub);
  }

  @Put(":id/days/:dayId/structure")
  saveDayStructure(
    @Param("id") id: string,
    @Param("dayId") dayId: string,
    @Body(new ZodValidationPipe(saveRoutineDayStructureSchema)) body: unknown,
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
