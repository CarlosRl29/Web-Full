import { Body, Controller, Get, Patch, Post, UsePipes } from "@nestjs/common";
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
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() body: unknown) {
    return this.authService.register(body as never);
  }

  @Public()
  @Post("login")
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: unknown) {
    return this.authService.login(body as never);
  }

  @Public()
  @Post("refresh")
  @UsePipes(new ZodValidationPipe(refreshSchema))
  refresh(@Body() body: unknown) {
    const { refresh_token } = body as { refresh_token: string };
    return this.authService.refresh(refresh_token);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.sub);
  }

  @Patch("me/profile")
  @UsePipes(new ZodValidationPipe(updateProfileSchema))
  updateProfile(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.authService.updateProfile(user.sub, body as never);
  }

  @Patch("me/mode")
  @UsePipes(new ZodValidationPipe(updateModeSchema))
  updateMode(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.authService.updateMode(user.sub, body as never);
  }
}
