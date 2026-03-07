/**
 * DEPRECADO: Usar API POST /admin/exercises/sync-from-exercisedb (admin)
 * o la UI /coach/exercises-sync
 *
 * Este script no incluye taxonomy (primary_muscle, movement_pattern, etc.)
 * ni traducciones. La API sí.
 *
 * Uso legacy: npm run sync-exercisedb -w apps/api
 */

import { PrismaClient } from "@prisma/client";

const EXERCISEDB_BASE = "https://exercisedb.dev/api/v1";
const LIMIT_PER_PAGE = 25;
const DELAY_MS = 800;

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

async function fetchPage(offset: number): Promise<{ data: ExerciseDBItem[]; total: number }> {
  const url = `${EXERCISEDB_BASE}/exercises?limit=${LIMIT_PER_PAGE}&offset=${offset}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const waitMs = attempt * 5000;
      console.log(`  Rate limit (429). Esperando ${waitMs / 1000}s antes de reintentar...`);
      await delay(waitMs);
      continue;
    }
    if (!res.ok) {
      throw new Error(`ExerciseDB API error: ${res.status}`);
    }
    const json = await res.json();
    return {
      data: json.data ?? [],
      total: json.metadata?.totalExercises ?? 0
    };
  }
  throw new Error("ExerciseDB API: demasiados intentos por rate limit");
}

function mapToOurSchema(item: ExerciseDBItem) {
  const muscle = item.targetMuscles?.[0] ?? "general";
  const subMuscle = item.secondaryMuscles?.length ? item.secondaryMuscles.join(", ") : null;
  const bodyPart = item.bodyParts?.[0] ?? null;
  const equipment = item.equipments?.[0] ?? null;
  const instructions =
    item.instructions?.length ? item.instructions.join("\n\n") : null;

  return {
    name: item.name,
    muscle_group: muscle,
    sub_muscle: subMuscle,
    body_part: bodyPart,
    equipment: equipment,
    media_url: item.gifUrl ?? null,
    instructions
  };
}

async function main() {
  const prisma = new PrismaClient();
  let offset = 0;
  let total = 0;
  let inserted = 0;
  let updated = 0;

  console.log("Sincronizando ejercicios desde ExerciseDB...");

  do {
    await delay(DELAY_MS);
    const { data, total: metaTotal } = await fetchPage(offset);
    if (total === 0) total = metaTotal;

    for (const item of data) {
      const mapped = mapToOurSchema(item);
      try {
        const result = await prisma.exercise.upsert({
          where: { name: item.name },
          update: {
            muscle_group: mapped.muscle_group,
            sub_muscle: mapped.sub_muscle,
            body_part: mapped.body_part,
            equipment: mapped.equipment,
            media_url: mapped.media_url,
            instructions: mapped.instructions
          } as never,
          create: mapped as never
        });
        if (result.created_at.getTime() === result.updated_at.getTime()) {
          inserted++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`Error en "${item.name}":`, err);
      }
    }

    offset += LIMIT_PER_PAGE;
    console.log(`  Procesados ${Math.min(offset, total)} / ${total} ejercicios`);
  } while (offset < total);

  console.log(`\nListo. Insertados: ${inserted}, Actualizados: ${updated}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
