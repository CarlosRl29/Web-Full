/**
 * Agrega ejercicios en ESPAÑOL con fotos (GIF) desde ExerciseDB.
 * - Borra ejercicios existentes (opcional con --keep)
 * - Traduce nombres e instrucciones a español vía MyMemory API
 * - Mapea músculos y partes del cuerpo a español
 * - Conserva media_url (GIF) de ExerciseDB
 *
 * Uso: npx ts-node apps/api/scripts/seed-exercises-spanish.ts
 *      npx ts-node apps/api/scripts/seed-exercises-spanish.ts --limit=100
 *      npx ts-node apps/api/scripts/seed-exercises-spanish.ts --keep  (no borra antes)
 */

import { PrismaClient } from "@prisma/client";

const EXERCISEDB_BASE = "https://exercisedb.dev/api/v1";
const MYMEMORY_URL = "https://api.mymemory.translated.net/get";
const LIMIT_PER_PAGE = 25;
const DELAY_MS = 900;
const TRANSLATE_DELAY_MS = 300;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ExerciseDBItem = {
  exerciseId: string;
  name: string;
  gifUrl: string;
  targetMuscles: string[];
  bodyParts: string[];
  equipments: string[];
  secondaryMuscles: string[];
  instructions: string[];
};

const MUSCLE_EN_TO_ES: Record<string, string> = {
  chest: "Pecho",
  pectorals: "Pectorales",
  "upper back": "Espalda alta",
  back: "Espalda",
  lats: "Dorsales",
  biceps: "Bíceps",
  bicep: "Bíceps",
  triceps: "Tríceps",
  tricep: "Tríceps",
  shoulders: "Hombros",
  deltoids: "Deltoides",
  deltoid: "Deltoides",
  "upper arms": "Brazos superiores",
  "lower arms": "Antebrazos",
  forearms: "Antebrazos",
  quadriceps: "Cuádriceps",
  quads: "Cuádriceps",
  hamstrings: "Isquiotibiales",
  glutes: "Glúteos",
  calves: "Gemelos",
  "upper legs": "Piernas superiores",
  "lower legs": "Piernas inferiores",
  waist: "Core",
  abs: "Abdominales",
  traps: "Trapecio",
  trapezius: "Trapecio",
  serratus: "Serrato",
  general: "General"
};

const BODYPART_EN_TO_ES: Record<string, string> = {
  chest: "Pecho",
  back: "Espalda",
  shoulders: "Hombros",
  "upper arms": "Brazos",
  "lower arms": "Antebrazos",
  "upper legs": "Piernas",
  "lower legs": "Piernas",
  waist: "Core",
  cardio: "Cardio"
};

const EQUIPMENT_EN_TO_ES: Record<string, string> = {
  "body weight": "Peso corporal",
  barbell: "Barra",
  dumbbell: "Mancuernas",
  kettlebell: "Kettlebell",
  cable: "Polea",
  "resistance band": "Banda elástica",
  "smith machine": "Máquina Smith",
  "ez barbell": "Barra EZ",
  "medicine ball": "Balón medicinal",
  "wobble board": "Tabla de equilibrio"
};

function toSpanish(value: string | null, map: Record<string, string>): string | null {
  if (!value?.trim()) return null;
  const key = value.toLowerCase().trim();
  return map[key] ?? value;
}

async function translateToSpanish(text: string): Promise<string> {
  if (!text?.trim()) return text;
  if (text.length > 450) {
    const parts = text.split(/(?=Step:\d+)/i);
    const results: string[] = [];
    for (const part of parts) {
      const p = part.trim();
      if (!p) continue;
      const t = await translateChunk(p);
      results.push(t);
      await delay(TRANSLATE_DELAY_MS);
    }
    return results.join("\n\n");
  }
  return translateChunk(text);
}

async function translateChunk(text: string): Promise<string> {
  try {
    const res = await fetch(
      `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=en|es`
    );
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
  } catch (e) {
    console.warn("  Traducción fallida:", (e as Error).message);
  }
  return text;
}

async function fetchPage(offset: number, limit: number): Promise<{ data: ExerciseDBItem[]; total: number }> {
  const url = `${EXERCISEDB_BASE}/exercises?limit=${limit}&offset=${offset}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const waitMs = attempt * 5000;
      console.log(`  Rate limit (429). Esperando ${waitMs / 1000}s...`);
      await delay(waitMs);
      continue;
    }
    if (!res.ok) throw new Error(`ExerciseDB API error: ${res.status}`);
    const json = await res.json();
    return {
      data: json.data ?? [],
      total: json.metadata?.totalExercises ?? 0
    };
  }
  throw new Error("ExerciseDB: demasiados intentos");
}

async function main() {
  const args = process.argv.slice(2);
  const keepExisting = args.includes("--keep");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const maxExercises = limitArg ? parseInt(limitArg.split("=")[1], 10) : 300;

  const prisma = new PrismaClient();

  if (!keepExisting) {
    console.log("Eliminando GroupExercise y Exercise...");
    await prisma.groupExercise.deleteMany({});
    await prisma.exercise.deleteMany({});
    console.log("  Ejercicios eliminados.");
  }

  let offset = 0;
  let total = 0;
  let inserted = 0;
  let skipped = 0;

  console.log(`\nObteniendo ejercicios de ExerciseDB (máx ${maxExercises})...`);

  while (inserted + skipped < maxExercises) {
    await delay(DELAY_MS);
    const { data, total: metaTotal } = await fetchPage(offset, LIMIT_PER_PAGE);
    if (total === 0) total = metaTotal;

    for (const item of data) {
      if (inserted + skipped >= maxExercises) break;

      const muscleEn = item.targetMuscles?.[0] ?? "general";
      const muscleEs = toSpanish(muscleEn, MUSCLE_EN_TO_ES) ?? "General";
      const bodyPartEs = toSpanish(item.bodyParts?.[0] ?? null, BODYPART_EN_TO_ES);
      const equipmentEs = toSpanish(item.equipments?.[0] ?? null, EQUIPMENT_EN_TO_ES);
      const subMuscleEn = item.secondaryMuscles?.join(", ") ?? null;
      let subMuscleEs = subMuscleEn;
      if (subMuscleEn) {
        subMuscleEs = subMuscleEn
          .split(",")
          .map((s) => toSpanish(s.trim(), MUSCLE_EN_TO_ES) ?? s.trim())
          .join(", ");
      }

      let nameEs = item.name;
      let instructionsEs: string | null = item.instructions?.length
        ? item.instructions.join("\n\n")
        : null;

      try {
        nameEs = await translateToSpanish(item.name);
        await delay(TRANSLATE_DELAY_MS);
        if (instructionsEs) {
          instructionsEs = await translateToSpanish(instructionsEs);
          await delay(TRANSLATE_DELAY_MS);
        }
      } catch (e) {
        console.warn(`  Sin traducir "${item.name}":`, (e as Error).message);
      }

      const existing = await prisma.exercise.findFirst({
        where: { name: nameEs }
      });
      if (existing) {
        skipped++;
        continue;
      }

      try {
        await prisma.exercise.create({
          data: {
            name: nameEs,
            muscle_group: muscleEs,
            sub_muscle: subMuscleEs,
            body_part: bodyPartEs,
            equipment: equipmentEs,
            media_url: item.gifUrl ?? null,
            instructions: instructionsEs
          } as never
        });
        inserted++;
      } catch (err) {
        console.error(`Error creando "${nameEs}":`, err);
      }
    }

    offset += LIMIT_PER_PAGE;
    console.log(`  Procesados ${Math.min(offset, total)} / ${Math.min(total, maxExercises)} | Insertados: ${inserted}`);
    if (offset >= total || data.length === 0) break;
  }

  console.log(`\nListo. Insertados: ${inserted}, Omitidos: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
