import { z } from "zod";
import { ExerciseGroupType } from "../enums";

export const groupExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  order_in_group: z.enum(["A1", "A2", "A3"]),
  target_sets_per_round: z.number().int().positive(),
  rep_range_min: z.number().int().positive(),
  rep_range_max: z.number().int().positive(),
  notes: z.string().optional()
}).refine(
  (value) => value.rep_range_max >= value.rep_range_min,
  {
    message: "rep_range_max must be >= rep_range_min",
    path: ["rep_range_max"]
  }
);

export const exerciseGroupSchema = z.object({
  type: z.nativeEnum(ExerciseGroupType),
  order_index: z.number().int().nonnegative(),
  rounds_total: z.number().int().positive(),
  rest_between_exercises_seconds: z.number().int().nonnegative().default(0),
  rest_after_round_seconds: z.number().int().nonnegative().default(0),
  rest_after_set_seconds: z.number().int().nonnegative().optional(),
  exercises: z.array(groupExerciseSchema).min(1).max(3)
});

export const routineDaySchema = z.object({
  day_label: z.string().min(1),
  order_index: z.number().int().nonnegative(),
  groups: z.array(exerciseGroupSchema).min(1)
});

export const createRoutineSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  days: z.array(routineDaySchema).min(1)
});

export const updateRoutineSchema = createRoutineSchema.partial();

export const saveRoutineDayStructureSchema = z.object({
  day_label: z.string().min(1).optional(),
  order_index: z.number().int().nonnegative().optional(),
  groups: z.array(exerciseGroupSchema).min(1)
});

export const createRoutineAssignmentSchema = z.object({
  user_id: z.string().uuid(),
  routine_id: z.string().uuid(),
  is_active: z.boolean().default(true),
  start_date: z.string().datetime().optional(),
  coach_notes: z.string().max(1000).optional()
});

export const setActiveRoutineSchema = z.object({
  routine_id: z.string().uuid()
});

export const publishRoutineSchema = z.object({
  is_public: z.boolean(),
  marketplace_title: z.string().min(2),
  marketplace_goal: z.string().min(2),
  marketplace_level: z.string().min(2),
  marketplace_days_per_week: z.number().int().min(1).max(7),
  marketplace_duration_weeks: z.number().int().min(1).max(52).optional(),
  marketplace_description: z.string().min(4).max(2000),
  marketplace_tags: z.array(z.string().min(1)).max(12).default([])
});

export const createRoutineReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(400).optional()
});

export const followCoachSchema = z.object({
  coach_id: z.string().uuid()
});

export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;
export type SaveRoutineDayStructureInput = z.infer<typeof saveRoutineDayStructureSchema>;
export type CreateRoutineAssignmentInput = z.infer<typeof createRoutineAssignmentSchema>;
export type SetActiveRoutineInput = z.infer<typeof setActiveRoutineSchema>;
export type PublishRoutineInput = z.infer<typeof publishRoutineSchema>;
export type CreateRoutineReviewInput = z.infer<typeof createRoutineReviewSchema>;
export type FollowCoachInput = z.infer<typeof followCoachSchema>;
