import { z } from "zod";

export const muscleGroupEnum = z.enum([
  "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS", "QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE"
]);
export const submuscleEnum = z.enum([
  "UPPER_CHEST", "MID_CHEST", "LOWER_CHEST", "LATS", "UPPER_BACK", "MID_BACK", "LOWER_BACK", "TRAPS",
  "ANTERIOR_DELTOID", "LATERAL_DELTOID", "REAR_DELTOID", "QUADS", "HAMSTRINGS", "GLUTES", "CALVES",
  "ABS", "OBLIQUES", "ERECTORS", "BICEPS", "TRICEPS"
]);
export const equipmentEnum = z.enum([
  "Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Kettlebell",
  "Smith Machine", "Resistance Band", "Bench", "EZ Bar", "Trap Bar"
]);
const movementPatternEnum = z.enum([
  "PUSH", "PULL", "SQUAT", "HINGE", "LUNGE", "CARRY", "CORE", "ISOLATION"
]);
const exerciseTypeEnum = z.enum(["COMPOUND", "ISOLATION"]);
const difficultyEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);

export const SUBMUSCLE_TO_MUSCLE: Record<string, string> = {
  UPPER_CHEST: "CHEST", MID_CHEST: "CHEST", LOWER_CHEST: "CHEST",
  LATS: "BACK", UPPER_BACK: "BACK", MID_BACK: "BACK", LOWER_BACK: "BACK", TRAPS: "BACK",
  ANTERIOR_DELTOID: "SHOULDERS", LATERAL_DELTOID: "SHOULDERS", REAR_DELTOID: "SHOULDERS",
  QUADS: "QUADS", HAMSTRINGS: "HAMSTRINGS", GLUTES: "GLUTES", CALVES: "CALVES",
  ABS: "CORE", OBLIQUES: "CORE", ERECTORS: "CORE",
  BICEPS: "BICEPS", TRICEPS: "TRICEPS"
};

function submuscleBelongsToMuscle(sub: string, muscle: string): boolean {
  return SUBMUSCLE_TO_MUSCLE[sub] === muscle;
}

const taxonomyFields = {
  primary_muscle: muscleGroupEnum.optional().nullable(),
  primary_submuscle: submuscleEnum.optional().nullable(),
  secondary_muscles: z.array(muscleGroupEnum).optional(),
  movement_pattern: movementPatternEnum.optional().nullable(),
  exercise_type: exerciseTypeEnum.optional().nullable(),
  difficulty: difficultyEnum.optional().nullable()
};

export const createExerciseSchema = z.object({
  name: z.string().min(2),
  muscle_group: z.string().min(2),
  sub_muscle: z.string().optional(),
  body_part: z.string().optional(),
  equipment: z.string().min(2).optional(),
  instructions: z.string().optional(),
  media_url: z.string().url().optional(),
  ...taxonomyFields
}).refine(
  (data) => {
    if (data.primary_submuscle && data.primary_muscle) {
      return submuscleBelongsToMuscle(data.primary_submuscle, data.primary_muscle);
    }
    return true;
  },
  { message: "primary_submuscle must belong to primary_muscle", path: ["primary_submuscle"] }
);

export const updateExerciseSchema = z.object({
  name: z.string().min(2).optional(),
  muscle_group: z.string().min(2).optional(),
  sub_muscle: z.string().optional().nullable(),
  body_part: z.string().optional().nullable(),
  equipment: z.string().min(2).optional().nullable(),
  instructions: z.string().optional().nullable(),
  media_url: z.string().url().optional().nullable(),
  ...taxonomyFields
}).refine(
  (data) => {
    if (data.primary_submuscle && data.primary_muscle) {
      return submuscleBelongsToMuscle(data.primary_submuscle, data.primary_muscle);
    }
    return true;
  },
  { message: "primary_submuscle must belong to primary_muscle", path: ["primary_submuscle"] }
);

export const exerciseQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  muscle: z.union([muscleGroupEnum, z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)),
  submuscle: z.union([submuscleEnum, z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)),
  body_part: z.string().optional(),
  equipment: z.union([equipmentEnum, z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)),
  locale: z.enum(["es", "en"]).optional()
});

export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
