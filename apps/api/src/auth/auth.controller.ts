import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  updateModeSchema,
  updateProfileSchema
} from "@gym/shared";
import { AuthService } from "./auth.service";
import { CurrentUser } from "../common/current-user.decorator";
import { Public } from "../common/public.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthUser } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  register(@Body(new ZodValidationPipe(registerSchema)) body: unknown) {
    return this.authService.register(body as never);
  }

  @Public()
  @Post("login")
  login(@Body(new ZodValidationPipe(loginSchema)) body: unknown) {
    return this.authService.login(body as never);
  }

  @Public()
  @Post("refresh")
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: unknown) {
    const { refresh_token } = body as { refresh_token: string };
    return this.authService.refresh(refresh_token);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.sub);
  }

  @Patch("me/profile")
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: unknown
  ) {
    return this.authService.updateProfile(user.sub, body as never);
  }

  @Patch("me/mode")
  updateMode(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateModeSchema)) body: unknown
  ) {
    return this.authService.updateMode(user.sub, body as never);
  }
}
