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

export const aiPlanSuggestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  apply_scope: z.enum(["ALL_GROUPS", "SINGLE_GROUPS"]).default("ALL_GROUPS"),
  set_delta: z.number().int().min(-3).max(3).default(0),
  rep_min_delta: z.number().int().min(-5).max(5).default(0),
  rep_max_delta: z.number().int().min(-5).max(5).default(0),
  rest_after_set_seconds: z.number().int().min(0).max(600).nullable().optional(),
  rest_between_exercises_seconds: z.number().int().min(0).max(600).nullable().optional(),
  swap_order_in_group: z.enum(["A1", "A2", "A3"]).nullable().optional(),
  swap_strategy: z.enum(["NONE", "NEXT_AVAILABLE"]).default("NONE")
});

export const aiRecommendationResponseSchema = z.object({
  model_version: z.string(),
  strategy_version: z.string(),
  safe_mode: z.boolean(),
  safety_flags: z.array(z.string()),
  rationale: z.array(z.string()),
  plan_suggestions: z.array(aiPlanSuggestionSchema),
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
export type AiPlanSuggestion = z.infer<typeof aiPlanSuggestionSchema>;
