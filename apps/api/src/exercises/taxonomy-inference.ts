/**
 * Keyword-based taxonomy inference for exercises.
 * Used by sync-from-exercisedb and backfill script.
 */

import type { MuscleGroup, Submuscle, MovementPattern, ExerciseType, ExerciseDifficulty } from "@prisma/client";

const MUSCLE_KEYWORDS: Array<{ keywords: string[]; muscle: MuscleGroup }> = [
  { keywords: ["chest", "pectoral", "pecho", "bench", "press pecho", "fly", "flyes", "apertura"], muscle: "CHEST" },
  { keywords: ["back", "espalda", "dorsal", "lat", "row", "remo", "pull", "pull-up", "dominada", "pulldown"], muscle: "BACK" },
  { keywords: ["shoulder", "hombro", "deltoid", "deltoides", "ohp", "overhead", "military", "lateral raise", "face pull"], muscle: "SHOULDERS" },
  { keywords: ["bicep", "bíceps", "curl", "curl bíceps"], muscle: "BICEPS" },
  { keywords: ["tricep", "tríceps", "extension", "pushdown", "skull crusher", "francesa"], muscle: "TRICEPS" },
  { keywords: ["quad", "cuádriceps", "squat", "leg extension", "sentadilla", "prensa"], muscle: "QUADS" },
  { keywords: ["hamstring", "isquiotibial", "femoral", "leg curl", "rdl", "romanian", "peso muerto"], muscle: "HAMSTRINGS" },
  { keywords: ["glute", "glúteo", "hip thrust", "glute bridge", "abducción cadera"], muscle: "GLUTES" },
  { keywords: ["calf", "gemelo", "calves", "elevación"], muscle: "CALVES" },
  { keywords: ["core", "ab", "abdominal", "plank", "crunch", "oblique", "lumbar"], muscle: "CORE" }
];

const SUBMUSCLE_KEYWORDS: Array<{ keywords: string[]; submuscle: Submuscle; muscle: MuscleGroup }> = [
  { keywords: ["upper chest", "inclin", "incline", "superior"], submuscle: "UPPER_CHEST", muscle: "CHEST" },
  { keywords: ["mid chest", "flat"], submuscle: "MID_CHEST", muscle: "CHEST" },
  { keywords: ["decline", "inferior", "lower chest"], submuscle: "LOWER_CHEST", muscle: "CHEST" },
  { keywords: ["lat", "dorsal", "pulldown", "pull-up", "dominada"], submuscle: "LATS", muscle: "BACK" },
  { keywords: ["trap", "trapecio", "shrug"], submuscle: "TRAPS", muscle: "BACK" },
  { keywords: ["anterior delt", "front raise", "military", "ohp"], submuscle: "ANTERIOR_DELTOID", muscle: "SHOULDERS" },
  { keywords: ["lateral delt", "lateral raise", "lateral"], submuscle: "LATERAL_DELTOID", muscle: "SHOULDERS" },
  { keywords: ["rear delt", "face pull", "posterior"], submuscle: "REAR_DELTOID", muscle: "SHOULDERS" },
  { keywords: ["abs", "abdominal", "crunch", "plank"], submuscle: "ABS", muscle: "CORE" },
  { keywords: ["oblique", "lateral"], submuscle: "OBLIQUES", muscle: "CORE" },
  { keywords: ["erector", "lower back", "lumbar", "back extension"], submuscle: "ERECTORS", muscle: "CORE" }
];

const MOVEMENT_KEYWORDS: Array<{ keywords: string[]; pattern: MovementPattern }> = [
  { keywords: ["push", "press", "extension", "dip", "push-up", "flexión"], pattern: "PUSH" },
  { keywords: ["pull", "row", "remo", "curl", "pull-up", "dominada", "pulldown"], pattern: "PULL" },
  { keywords: ["squat", "sentadilla", "leg press", "prensa"], pattern: "SQUAT" },
  { keywords: ["deadlift", "rdl", "hinge", "peso muerto", "hip hinge"], pattern: "HINGE" },
  { keywords: ["lunge", "zancada", "split", "bulgarian"], pattern: "LUNGE" },
  { keywords: ["carry", "farmers", "walk"], pattern: "CARRY" },
  { keywords: ["plank", "crunch", "ab", "core", "abdominal"], pattern: "CORE" },
  { keywords: ["curl", "extension", "raise", "fly", "apertura", "isolation"], pattern: "ISOLATION" }
];

const COMPOUND_KEYWORDS = [
  "squat", "deadlift", "bench", "press", "row", "remo", "pull-up", "dominada",
  "lunge", "zancada", "prensa", "hip thrust", "ohp", "dip"
];
const ISOLATION_KEYWORDS = ["curl", "extension", "raise", "fly", "apertura", "shrug", "crunch"];
const BEGINNER_KEYWORDS = ["bodyweight", "peso corporal", "assisted", "assistida", "wall", "knee", "rodilla"];
const ADVANCED_KEYWORDS = ["olympic", "snatch", "clean", "jerk", "power clean", "hang", "single-leg", "pistol"];

export function inferPrimaryMuscle(name: string, muscleGroup: string, subMuscle: string | null): MuscleGroup | null {
  const text = `${name} ${muscleGroup} ${subMuscle ?? ""}`.toLowerCase();
  for (const { keywords, muscle } of MUSCLE_KEYWORDS) {
    if (keywords.some((k) => text.includes(k))) return muscle;
  }
  return null;
}

export function inferPrimarySubmuscle(
  name: string,
  muscleGroup: string,
  subMuscle: string | null,
  primaryMuscle: MuscleGroup | null
): Submuscle | null {
  if (!primaryMuscle) return null;
  const text = `${name} ${muscleGroup} ${subMuscle ?? ""}`.toLowerCase();
  for (const { keywords, submuscle, muscle } of SUBMUSCLE_KEYWORDS) {
    if (muscle === primaryMuscle && keywords.some((k) => text.includes(k))) return submuscle;
  }
  return null;
}

export function inferMovementPattern(name: string, muscleGroup: string): MovementPattern | null {
  const text = `${name} ${muscleGroup}`.toLowerCase();
  for (const { keywords, pattern } of MOVEMENT_KEYWORDS) {
    if (keywords.some((k) => text.includes(k))) return pattern;
  }
  return null;
}

export function inferExerciseType(name: string): ExerciseType | null {
  const text = name.toLowerCase();
  if (COMPOUND_KEYWORDS.some((k) => text.includes(k))) return "COMPOUND";
  if (ISOLATION_KEYWORDS.some((k) => text.includes(k))) return "ISOLATION";
  return null;
}

export function inferDifficulty(name: string): ExerciseDifficulty | null {
  const text = name.toLowerCase();
  if (ADVANCED_KEYWORDS.some((k) => text.includes(k))) return "ADVANCED";
  if (BEGINNER_KEYWORDS.some((k) => text.includes(k))) return "BEGINNER";
  return null;
}

export function toCanonicalSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}
