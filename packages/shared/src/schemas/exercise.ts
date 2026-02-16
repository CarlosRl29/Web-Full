import { z } from "zod";

export const createExerciseSchema = z.object({
  name: z.string().min(2),
  muscle_group: z.string().min(2),
  equipment: z.string().min(2).optional(),
  instructions: z.string().optional()
});

export const exerciseQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(25)
});

export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
