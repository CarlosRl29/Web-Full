/**
 * AI Tool System - The AI operates using these tools instead of free text generation.
 * Each tool returns real data from the database; the AI never guesses.
 */

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AnalyticsService } from "../../analytics/analytics.service";
import {
  ExerciseLibraryService,
  type ExerciseLibraryFilters
} from "./exercise-library.service";
import type { UserContext } from "./routine-rules";

export type UserProfile = {
  id: string;
  goal: string | null;
  experience_level: string | null;
  days_per_week: number | null;
  equipment: string[];
  injuries: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  age: number | null;
  session_minutes: number | null;
};

export type LoadTargets = {
  reps: { min: number; max: number };
  sets: number;
  restSeconds: number;
};

@Injectable()
export class AiToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly exerciseLibrary: ExerciseLibraryService
  ) {}

  /** Tool: getUserProfile(userId) - Fetch real user profile from DB */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        goal: true,
        experience_level: true,
        days_per_week: true,
        equipment: true,
        injuries: true,
        weight_kg: true,
        height_cm: true,
        body_fat_pct: true,
        age: true,
        session_minutes: true
      }
    });
    if (!user) return null;
    return {
      ...user,
      equipment: user.equipment ?? [],
      goal: user.goal as string | null,
      experience_level: user.experience_level as string | null
    };
  }

  /** Tool: getExerciseLibrary(filters) - AI can ONLY choose from this list */
  async getExerciseLibrary(filters: ExerciseLibraryFilters) {
    return this.exerciseLibrary.getExerciseLibrary(filters);
  }

  /** Tool: getExercisesByDayType - Get exercises for PUSH/PULL/LEGS etc. */
  async getExercisesByDayType(
    dayType: "PUSH" | "PULL" | "LEGS" | "UPPER" | "LOWER" | "FULL",
    equipment: string[],
    limit = 80,
    locale: "es" | "en" = "es",
    userId?: string
  ) {
    return this.exerciseLibrary.getExercisesByDayType(dayType, equipment, limit, locale, userId);
  }

  /** Tool: getUserHistory(userId) - Training summary for progression context */
  async getUserHistory(userId: string, windowDays = 28) {
    return this.analytics.getTrainingSummary(userId, windowDays);
  }

  /** Tool: calculateLoadTargets(goal, level) - Deterministic load targets from knowledge base */
  calculateLoadTargets(
    goal: "STRENGTH" | "HYPERTROPHY" | "MIXED",
    level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
  ): LoadTargets {
    const reps =
      goal === "STRENGTH"
        ? { min: 4, max: 8 }
        : goal === "HYPERTROPHY"
          ? { min: 8, max: 12 }
          : { min: 10, max: 15 };
    const sets = level === "BEGINNER" ? 3 : level === "INTERMEDIATE" ? 4 : 4;
    const rest = goal === "STRENGTH" ? 120 : goal === "HYPERTROPHY" ? 90 : 75;
    return { reps, sets, restSeconds: rest };
  }

  /** Tool: buildUserContext - Build context for rule engine from profile + overrides */
  buildUserContext(
    profile: UserProfile | null,
    overrides?: {
      goal?: string;
      experience_level?: string;
      days_per_week?: number;
      equipment?: string[];
      injuries?: string;
      session_minutes?: number;
      disabledMovements?: string[];
      knowledgeSnippets?: string[];
    }
  ): UserContext {
    const goal = (overrides?.goal ?? profile?.goal ?? "MIXED") as UserContext["goal"];
    const experienceLevel = (overrides?.experience_level ??
      profile?.experience_level ??
      "INTERMEDIATE") as UserContext["experienceLevel"];
    const equipment = overrides?.equipment ?? profile?.equipment ?? [];
    const injuries = overrides?.injuries ?? profile?.injuries ?? "";
    const sessionMinutes = overrides?.session_minutes ?? profile?.session_minutes;

    return {
      experienceLevel,
      goal,
      equipment: Array.isArray(equipment) ? equipment : [],
      injuries: injuries || undefined,
      disabledMovements: overrides?.disabledMovements,
      sessionMinutes: sessionMinutes ?? undefined,
      knowledgeSnippets: overrides?.knowledgeSnippets
    };
  }
}
