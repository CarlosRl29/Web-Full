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
  ai_log_id: z.string(),
  model_version: z.string(),
  strategy_version: z.string(),
  dedup_hit: z.boolean(),
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

export const aiAppliedSuggestionSchema = z.object({
  ai_log_id: z.string().uuid(),
  routine_id: z.string().uuid(),
  routine_day_id: z.string().uuid(),
  applied_changes: z.record(z.unknown())
});

export const aiGenerateRoutineRequestSchema = z.object({
  profile: z
    .object({
      experience_level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
      goal: z.enum(["STRENGTH", "HYPERTROPHY", "MIXED"]),
      days_per_week: z.number().int().min(2).max(6)
    })
    .optional(),
  use_saved_profile: z.boolean().optional(),
  constraints: z
    .object({
      equipment: z.array(z.string().min(1)).optional(),
      injuries: z.string().max(500).optional(),
      session_minutes: z.number().int().min(20).max(120).optional()
    })
    .optional()
});

/** AXION v1 single-day workout generator request */
export const aiGenerateWorkoutDayRequestSchema = z.object({
  goal: z.enum(["STRENGTH", "HYPERTROPHY", "FAT_LOSS", "ENDURANCE"]),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  sex: z.enum(["MALE", "FEMALE", "PREFER_NOT"]).optional(),
  dayFocus: z.enum(["CHEST", "BACK", "LEGS", "SHOULDERS", "PUSH", "PULL", "UPPER", "LOWER"]),
  durationMinutes: z.union([z.literal(45), z.literal(60), z.literal(75), z.literal(90)]),
  equipment_available: z.array(z.string().min(1)).default([]),
  locale: z.enum(["es", "en"]).optional(),
  history: z
    .object({
      recent_exercise_ids: z.array(z.string().uuid()).optional()
    })
    .optional()
});

export type AiGenerateWorkoutDayRequest = z.infer<typeof aiGenerateWorkoutDayRequestSchema>;

/** AXION v1 deterministic routine generator request */
export const aiGenerateRoutineAxionRequestSchema = z.object({
  goal: z.enum(["STRENGTH", "HYPERTROPHY", "FAT_LOSS", "ENDURANCE"]),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  sex: z.enum(["MALE", "FEMALE", "PREFER_NOT"]).optional(),
  priority_area: z.enum(["BALANCED", "UPPER_BODY", "LOWER_BODY"]),
  days_per_week: z.union([z.literal(4), z.literal(5), z.literal(6)]),
  session_duration_mode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  session_minutes: z.union([z.literal(45), z.literal(60), z.literal(75), z.literal(90)]).optional(),
  equipment_available: z.array(z.string().min(1)).default([]),
  history: z
    .object({
      recent_exercise_ids: z.array(z.string().uuid()).optional(),
      fatigue_signals: z.boolean().optional()
    })
    .optional()
});

/** Standardized success response for POST /api/ai/generate-routine */
export const aiGenerateRoutineSuccessSchema = z.object({
  routineId: z.string().uuid(),
  draft: z.object({
    name: z.string(),
    description: z.string().optional(),
    days: z.array(z.unknown())
  }),
  warnings: z.array(z.string()),
  score: z.number(),
  nextSteps: z.array(z.string()),
  requestId: z.string()
});

/** Standardized failure response for POST /api/ai/generate-routine */
export const aiGenerateRoutineFailureSchema = z.object({
  errorCode: z.enum(["MISSING_CONTEXT", "VALIDATION_FAILED", "RULES_FAILED", "SAFETY_GATE"]),
  missingFields: z.array(z.string()).optional(),
  validationErrors: z.array(z.unknown()).optional(),
  requestId: z.string()
});

export type AiGenerateRoutineSuccess = z.infer<typeof aiGenerateRoutineSuccessSchema>;
export type AiGenerateRoutineFailure = z.infer<typeof aiGenerateRoutineFailureSchema>;

export const aiGenerateRoutineResponseSchema = z.object({
  routine: z.object({
    name: z.string(),
    description: z.string().optional(),
    days: z.array(
      z.object({
        day_label: z.string(),
        order_index: z.number(),
        groups: z.array(
          z.object({
            type: z.enum(["SINGLE", "SUPERSET_2", "SUPERSET_3"]),
            order_index: z.number(),
            rounds_total: z.number(),
            rest_between_exercises_seconds: z.number(),
            rest_after_round_seconds: z.number(),
            rest_after_set_seconds: z.number().optional(),
            exercises: z.array(
              z.object({
                exercise_id: z.string().uuid(),
                order_in_group: z.enum(["A1", "A2", "A3"]),
                target_sets_per_round: z.number(),
                rep_range_min: z.number(),
                rep_range_max: z.number(),
                notes: z.string().optional(),
                exercise_name: z.string().optional()
              })
            )
          })
        )
      })
    )
  })
});

/** Strict schema for AI-generated routine draft - AI MUST return JSON matching this.
 *  Maps to CreateRoutineInput groups structure for compatibility. */
export const aiRoutineDraftExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  order_in_group: z.enum(["A1", "A2", "A3"]),
  target_sets_per_round: z.number().int().min(1).max(8),
  rep_range_min: z.number().int().min(1).max(30),
  rep_range_max: z.number().int().min(1).max(30),
  notes: z.string().max(200).optional(),
  exercise_name: z.string().optional()
}).refine((e) => e.rep_range_max >= e.rep_range_min, {
  message: "rep_range_max must be >= rep_range_min",
  path: ["rep_range_max"]
});

export const aiRoutineDraftGroupSchema = z.object({
  type: z.enum(["SINGLE", "SUPERSET_2", "SUPERSET_3"]),
  order_index: z.number().int().nonnegative(),
  rounds_total: z.number().int().min(1).max(5),
  rest_between_exercises_seconds: z.number().int().min(0).max(300),
  rest_after_round_seconds: z.number().int().min(0).max(300),
  rest_after_set_seconds: z.number().int().min(0).max(300).optional(),
  exercises: z.array(aiRoutineDraftExerciseSchema).min(1).max(3)
});

export const aiRoutineDraftDaySchema = z.object({
  day_label: z.string().min(1).max(60),
  order_index: z.number().int().nonnegative(),
  groups: z.array(aiRoutineDraftGroupSchema).min(1)
});

export const aiRoutineDraftSchema = z.object({
  name: z.string().min(2).max(120),
  goal: z.enum(["STRENGTH", "HYPERTROPHY", "MIXED"]),
  description: z.string().max(500).optional(),
  days: z.array(aiRoutineDraftDaySchema).min(1).max(7)
});

export type AiRoutineDraft = z.infer<typeof aiRoutineDraftSchema>;
export type AiRoutineDraftDay = z.infer<typeof aiRoutineDraftDaySchema>;
export type AiRoutineDraftGroup = z.infer<typeof aiRoutineDraftGroupSchema>;
export type AiRoutineDraftExercise = z.infer<typeof aiRoutineDraftExerciseSchema>;

export type AiAppliedSuggestionInput = z.infer<typeof aiAppliedSuggestionSchema>;

export type AiRecommendationRequest = z.infer<typeof aiRecommendationRequestSchema>;
export type AiRecommendationResponse = z.infer<typeof aiRecommendationResponseSchema>;
export type AiPlanSuggestion = z.infer<typeof aiPlanSuggestionSchema>;
export type AiGenerateRoutineRequest = z.infer<typeof aiGenerateRoutineRequestSchema>;
export type AiGenerateRoutineAxionRequest = z.infer<typeof aiGenerateRoutineAxionRequestSchema>;
export type AiGenerateRoutineResponse = z.infer<typeof aiGenerateRoutineResponseSchema>;
