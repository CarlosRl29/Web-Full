import { z } from "zod";

export const aiRecommendationRequestSchema = z.object({
  profile: z.object({
    experience_level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
    goal: z.enum(["STRENGTH", "HYPERTROPHY", "MIXED"]),
    days_per_week: z.number().int().min(1).max(7)
  }),
  constraints: z.object({
    equipment: z.array(z.string().min(1)).optional(),
    injuries: z.string().max(500).optional(),
    acute_pain: z.boolean().optional(),
    session_minutes: z.number().int().min(15).max(180).optional()
  }).optional(),
  context: z.object({
    window_days: z.number().int().min(7).max(90).default(28)
  })
});

export const aiRecommendationResponseSchema = z.object({
  safe_mode: z.boolean(),
  safety_flags: z.array(z.string()),
  disclaimer: z.string(),
  recommendation_summary: z.string(),
  adjustments: z.array(z.object({
    title: z.string(),
    description: z.string(),
    delta_volume_percent: z.number().min(0).max(15).nullable().optional()
  })),
  based_on: z.object({
    window_days: z.number().int(),
    sessions_analyzed: z.number().int(),
    volume_total: z.number(),
    adherence: z.number(),
    average_rpe: z.number().nullable()
  })
});

export type AiRecommendationRequest = z.infer<typeof aiRecommendationRequestSchema>;
export type AiRecommendationResponse = z.infer<typeof aiRecommendationResponseSchema>;
