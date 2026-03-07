/**
 * Muscle group type matching Prisma enum.
 * Used when @prisma/client MuscleGroup is not available (e.g. before generate).
 */
export type MuscleGroup =
  | "CHEST"
  | "BACK"
  | "SHOULDERS"
  | "BICEPS"
  | "TRICEPS"
  | "QUADS"
  | "HAMSTRINGS"
  | "GLUTES"
  | "CALVES"
  | "CORE";
