import { z } from "zod";
import { ExperienceLevel, TrainingGoal, UserMode } from "../enums";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  intended_mode: z.enum(["USER", "COACH", "AMBAS"]).optional().default("USER")
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(8)
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).optional(),
  goal: z.nativeEnum(TrainingGoal),
  experience_level: z.nativeEnum(ExperienceLevel),
  days_per_week: z.number().int().min(1).max(7),
  session_minutes: z.number().int().min(15).max(240),
  injuries: z.string().max(1000).optional(),
  equipment: z.array(z.string().min(1)).optional()
});

export const updateModeSchema = z.object({
  active_mode: z.nativeEnum(UserMode)
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateModeInput = z.infer<typeof updateModeSchema>;
