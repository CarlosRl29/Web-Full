import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ExperienceLevel, TrainingGoal, UserMode, UserRole } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import {
  LoginInput,
  RegisterInput,
  UpdateModeInput,
  UpdateProfileInput
} from "@gym/shared";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(input: RegisterInput) {
    const found = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (found) {
      throw new ConflictException("Email already in use");
    }

    const intendedMode = input.intended_mode ?? "USER";
    const preferredModes =
      intendedMode === "AMBAS"
        ? [UserMode.USER, UserMode.COACH]
        : intendedMode === "COACH"
          ? [UserMode.COACH]
          : [UserMode.USER];
    const activeMode =
      intendedMode === "COACH" ? UserMode.COACH : UserMode.USER;
    const role =
      intendedMode === "COACH" || intendedMode === "AMBAS"
        ? UserRole.COACH
        : UserRole.USER;

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        full_name: input.full_name,
        role,
        preferred_modes: preferredModes,
        active_mode: activeMode,
        password_hash: await bcrypt.hash(input.password, 10)
      }
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await bcrypt.compare(input.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? "super-refresh-secret"
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.refresh_token_hash) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const valid = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!valid) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        preferred_modes: true,
        active_mode: true,
        goal: true,
        experience_level: true,
        days_per_week: true,
        session_minutes: true,
        injuries: true,
        equipment: true,
        active_routine_id: true,
        created_at: true
      }
    });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        full_name: input.full_name,
        goal: input.goal as TrainingGoal,
        experience_level: input.experience_level as ExperienceLevel,
        days_per_week: input.days_per_week,
        session_minutes: input.session_minutes,
        injuries: input.injuries,
        equipment: input.equipment ?? []
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        preferred_modes: true,
        active_mode: true,
        goal: true,
        experience_level: true,
        days_per_week: true,
        session_minutes: true,
        injuries: true,
        equipment: true,
        active_routine_id: true,
        created_at: true
      }
    });
    return updated;
  }

  async updateMode(userId: string, input: UpdateModeInput) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, preferred_modes: true }
    });
    if (!current) {
      throw new UnauthorizedException("User not found");
    }
    const canUseCoachMode = current.role === UserRole.COACH || current.role === UserRole.ADMIN;
    if (input.active_mode === UserMode.COACH && !canUseCoachMode) {
      throw new ForbiddenException("User cannot use coach mode");
    }
    if (!current.preferred_modes.includes(input.active_mode)) {
      throw new ForbiddenException("Mode is not enabled for this user");
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { active_mode: input.active_mode },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        preferred_modes: true,
        active_mode: true,
        goal: true,
        experience_level: true,
        days_per_week: true,
        session_minutes: true,
        injuries: true,
        equipment: true,
        active_routine_id: true,
        created_at: true
      }
    });
  }

  private async issueTokens(userId: string, email: string, role: UserRole) {
    const payload = { sub: userId, email, role };
    const access_token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? "super-access-secret",
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m"
    });
    const refresh_token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? "super-refresh-secret",
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d"
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refresh_token_hash: await bcrypt.hash(refresh_token, 10)
      }
    });

    return { access_token, refresh_token };
  }
}
