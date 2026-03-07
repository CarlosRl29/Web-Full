/**
 * Backfill exercise taxonomy from existing name + muscle_group + sub_muscle.
 * Does NOT overwrite exercises that already have primary_muscle set (manually classified).
 *
 * Usage: npm run backfill-exercise-taxonomy -w apps/api
 */

import { config } from "dotenv";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

config({ path: path.join(process.cwd(), ".env") });
if (!process.env.DATABASE_URL) {
  config({ path: path.join(process.cwd(), "../../.env") });
}

type MuscleGroup =
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
type Submuscle =
  | "UPPER_CHEST"
  | "MID_CHEST"
  | "LOWER_CHEST"
  | "LATS"
  | "UPPER_BACK"
  | "MID_BACK"
  | "LOWER_BACK"
  | "TRAPS"
  | "ANTERIOR_DELTOID"
  | "LATERAL_DELTOID"
  | "REAR_DELTOID"
  | "QUADS"
  | "HAMSTRINGS"
  | "GLUTES"
  | "CALVES"
  | "ABS"
  | "OBLIQUES"
  | "ERECTORS"
  | "BICEPS"
  | "TRICEPS";
type MovementPattern =
  | "PUSH"
  | "PULL"
  | "SQUAT"
  | "HINGE"
  | "LUNGE"
  | "CARRY"
  | "CORE"
  | "ISOLATION";
type ExerciseType = "COMPOUND" | "ISOLATION";
type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

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

function inferMuscle(name: string, muscleGroup: string, subMuscle: string | null): MuscleGroup | null {
  const text = `${name} ${muscleGroup} ${subMuscle ?? ""}`.toLowerCase();
  for (const { keywords, muscle } of MUSCLE_KEYWORDS) {
    if (keywords.some((k) => text.includes(k))) return muscle;
  }
  return null;
}

function inferSubmuscle(
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

function inferMovement(name: string, muscleGroup: string): MovementPattern | null {
  const text = `${name} ${muscleGroup}`.toLowerCase();
  for (const { keywords, pattern } of MOVEMENT_KEYWORDS) {
    if (keywords.some((k) => text.includes(k))) return pattern;
  }
  return null;
}

function inferExerciseType(name: string): ExerciseType | null {
  const text = name.toLowerCase();
  if (COMPOUND_KEYWORDS.some((k) => text.includes(k))) return "COMPOUND";
  if (ISOLATION_KEYWORDS.some((k) => text.includes(k))) return "ISOLATION";
  return null;
}

function inferDifficulty(name: string): Difficulty | null {
  const text = name.toLowerCase();
  if (ADVANCED_KEYWORDS.some((k) => text.includes(k))) return "ADVANCED";
  if (BEGINNER_KEYWORDS.some((k) => text.includes(k))) return "BEGINNER";
  return null;
}

type ExerciseWithTaxonomy = {
  id: string;
  name: string;
  muscle_group: string;
  sub_muscle: string | null;
  primary_muscle?: string | null;
  primary_submuscle?: string | null;
  movement_pattern?: string | null;
  exercise_type?: string | null;
  difficulty?: string | null;
};

async function main() {
  const prisma = new PrismaClient();
  const raw = await prisma.exercise.findMany({
    select: {
      id: true,
      name: true,
      muscle_group: true,
      sub_muscle: true,
      primary_muscle: true,
      primary_submuscle: true,
      movement_pattern: true,
      exercise_type: true,
      difficulty: true
    } as never
  });
  const exercises = raw as ExerciseWithTaxonomy[];

  const total = exercises.length;
  const hasAnyTaxonomy = (e: ExerciseWithTaxonomy) =>
    e.primary_muscle != null ||
    e.primary_submuscle != null ||
    e.movement_pattern != null ||
    e.exercise_type != null ||
    e.difficulty != null;
  const alreadyClassified = exercises.filter(hasAnyTaxonomy);
  const toProcess = exercises.filter((e) => !hasAnyTaxonomy(e));

  let filled = 0;
  const nullsByField: Record<string, number> = {
    primary_muscle: 0,
    primary_submuscle: 0,
    movement_pattern: 0,
    exercise_type: 0,
    difficulty: 0
  };

  for (const ex of toProcess) {
    const primaryMuscle = inferMuscle(ex.name, ex.muscle_group, ex.sub_muscle);
    const primarySubmuscle = inferSubmuscle(ex.name, ex.muscle_group, ex.sub_muscle, primaryMuscle);
    const movementPattern = inferMovement(ex.name, ex.muscle_group);
    const exerciseType = inferExerciseType(ex.name);
    const difficulty = inferDifficulty(ex.name);

    if (primaryMuscle || primarySubmuscle || movementPattern || exerciseType || difficulty) {
      await prisma.exercise.update({
        where: { id: ex.id },
        data: {
          primary_muscle: primaryMuscle ?? undefined,
          primary_submuscle: primarySubmuscle ?? undefined,
          movement_pattern: movementPattern ?? undefined,
          exercise_type: exerciseType ?? undefined,
          difficulty: difficulty ?? undefined
        } as never
      });
      filled++;
    }

    if (!primaryMuscle) nullsByField.primary_muscle++;
    if (!primarySubmuscle && primaryMuscle) nullsByField.primary_submuscle++;
    if (!movementPattern) nullsByField.movement_pattern++;
    if (!exerciseType) nullsByField.exercise_type++;
    if (!difficulty) nullsByField.difficulty++;
  }

  console.log("=== Backfill Report ===");
  console.log(`Total exercises: ${total}`);
  console.log(`Already classified (skipped): ${alreadyClassified.length}`);
  console.log(`Processed: ${toProcess.length}`);
  console.log(`Filled this run: ${filled}`);
  console.log(`Filled %: ${total > 0 ? ((alreadyClassified.length + filled) / total * 100).toFixed(1) : 0}%`);
  console.log("Remaining nulls by field (among processed):");
  console.log(`  primary_muscle: ${nullsByField.primary_muscle}`);
  console.log(`  primary_submuscle: ${nullsByField.primary_submuscle}`);
  console.log(`  movement_pattern: ${nullsByField.movement_pattern}`);
  console.log(`  exercise_type: ${nullsByField.exercise_type}`);
  console.log(`  difficulty: ${nullsByField.difficulty}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
