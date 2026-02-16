import { z } from "zod";

const restOverridesSchema = z.object({
  rest_between_exercises_seconds: z.number().int().nonnegative().optional(),
  rest_after_round_seconds: z.number().int().nonnegative().optional(),
  rest_after_set_seconds: z.number().int().nonnegative().optional()
});

export const startSessionSchema = z.object({
  routine_id: z.string().uuid(),
  day_id: z.string().uuid(),
  overrides: restOverridesSchema.optional()
});

export const updateProgressSchema = z.object({
  current_pointer: z
    .object({
      group_index: z.number().int().nonnegative(),
      exercise_index: z.number().int().nonnegative(),
      set_index: z.number().int().nonnegative(),
      round_index: z.number().int().nonnegative()
    })
    .optional(),
  set_update: z
    .object({
      workout_exercise_item_id: z.string().uuid(),
      set_number: z.number().int().positive(),
      weight: z.number().nonnegative().optional(),
      reps: z.number().int().positive().optional(),
      rpe: z.number().min(1).max(10).optional(),
      is_done: z.boolean().default(false)
    })
    .optional()
});

export const finishSessionSchema = z.object({
  session_id: z.string().uuid()
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
