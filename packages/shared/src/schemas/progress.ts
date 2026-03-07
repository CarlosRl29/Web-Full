import { z } from "zod";

export const checkInSchema = z.object({
  fatigue: z.number().int().min(1).max(5),
  pain_location: z.enum(["none", "shoulder", "knee", "back", "elbow", "other"]),
  sleep_quality: z.enum(["good", "average", "poor"]),
  difficulty: z.enum(["very_easy", "good", "hard", "very_hard"])
});

export type CheckInInput = z.infer<typeof checkInSchema>;
