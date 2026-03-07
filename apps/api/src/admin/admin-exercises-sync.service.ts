/**
 * Admin service: sync exercises from ExerciseDB API.
 * Creates exercises with taxonomy (primary_muscle, movement_pattern, etc.) and EN translation.
 */

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  inferPrimaryMuscle,
  inferPrimarySubmuscle,
  inferMovementPattern,
  inferExerciseType,
  inferDifficulty,
  toCanonicalSlug
} from "../exercises/taxonomy-inference";

const EXERCISEDB_BASE = "https://exercisedb.dev/api/v1";
const LIMIT_PER_PAGE = 25;
const DELAY_MS = 800;

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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(offset: number): Promise<{ data: ExerciseDBItem[]; total: number }> {
  const url = `${EXERCISEDB_BASE}/exercises?limit=${LIMIT_PER_PAGE}&offset=${offset}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const waitMs = attempt * 5000;
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
  throw new Error("ExerciseDB API: demasiados intentos por rate limit");
}

function mapEquipment(eq: string | undefined): string | null {
  if (!eq) return null;
  const lower = eq.toLowerCase();
  if (lower.includes("barbell") || lower.includes("barra")) return "Barra";
  if (lower.includes("dumbbell") || lower.includes("mancuerna")) return "Mancuernas";
  if (lower.includes("kettlebell")) return "Kettlebell";
  if (lower.includes("cable") || lower.includes("polea")) return "Polea";
  if (lower.includes("machine") || lower.includes("máquina")) return "Máquina";
  if (lower.includes("body") || lower.includes("weight") || lower.includes("bodyweight")) return "Bodyweight";
  if (lower.includes("band") || lower.includes("banda")) return "Banda elástica";
  return eq;
}

@Injectable()
export class AdminExercisesSyncService {
  constructor(private readonly prisma: PrismaService) {}

  /** Delete all exercises (and translations via cascade). Clears GroupExercise first. */
  async clearAll(): Promise<{ deleted: number }> {
    const groupCount = await this.prisma.groupExercise.count();
    if (groupCount > 0) {
      await this.prisma.groupExercise.deleteMany({});
    }
    const count = await this.prisma.exercise.count();
    await this.prisma.exercise.deleteMany({});
    return { deleted: count };
  }

  /** Sync exercises from ExerciseDB. Creates with taxonomy + EN translation + canonical_slug. */
  async syncFromExerciseDB(): Promise<{
    inserted: number;
    updated: number;
    total: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let offset = 0;
    let total = 0;
    let inserted = 0;
    let updated = 0;
    const existingSlugs = new Set<string>(
      (await this.prisma.exercise.findMany({ where: { canonical_slug: { not: null } }, select: { canonical_slug: true } }))
        .map((e) => e.canonical_slug!)
        .filter(Boolean)
    );

    const ensureUniqueSlug = (slug: string): string => {
      let candidate = slug || "exercise";
      let suffix = 0;
      while (existingSlugs.has(candidate)) {
        suffix++;
        candidate = `${slug}_${suffix}`;
      }
      existingSlugs.add(candidate);
      return candidate;
    };

    do {
      await delay(DELAY_MS);
      const { data, total: metaTotal } = await fetchPage(offset);
      if (total === 0) total = metaTotal;

      for (const item of data) {
        const muscle = item.targetMuscles?.[0] ?? "general";
        const subMuscle = item.secondaryMuscles?.length ? item.secondaryMuscles.join(", ") : null;
        const bodyPart = item.bodyParts?.[0] ?? null;
        const equipment = mapEquipment(item.equipments?.[0]);
        const instructions = item.instructions?.length ? item.instructions.join("\n\n") : null;

        const primaryMuscle = inferPrimaryMuscle(item.name, muscle, subMuscle);
        const primarySubmuscle = inferPrimarySubmuscle(item.name, muscle, subMuscle, primaryMuscle);
        const movementPattern = inferMovementPattern(item.name, muscle);
        const exerciseType = inferExerciseType(item.name);
        const difficulty = inferDifficulty(item.name);
        const slug = ensureUniqueSlug(toCanonicalSlug(item.name));

        try {
          const result = await this.prisma.exercise.upsert({
            where: { name: item.name },
            update: {
              muscle_group: muscle,
              sub_muscle: subMuscle,
              body_part: bodyPart,
              equipment: equipment,
              media_url: item.gifUrl ?? null,
              instructions,
              primary_muscle: primaryMuscle ?? undefined,
              primary_submuscle: primarySubmuscle ?? undefined,
              movement_pattern: movementPattern ?? undefined,
              exercise_type: exerciseType ?? undefined,
              difficulty: difficulty ?? undefined,
              canonical_slug: slug
            },
            create: {
              name: item.name,
              muscle_group: muscle,
              sub_muscle: subMuscle,
              body_part: bodyPart,
              equipment: equipment,
              media_url: item.gifUrl ?? null,
              instructions,
              primary_muscle: primaryMuscle ?? undefined,
              primary_submuscle: primarySubmuscle ?? undefined,
              movement_pattern: movementPattern ?? undefined,
              exercise_type: exerciseType ?? undefined,
              difficulty: difficulty ?? undefined,
              canonical_slug: slug
            }
          });

          const hasEn = await this.prisma.exerciseTranslation.findUnique({
            where: { exercise_id_locale: { exercise_id: result.id, locale: "en" } }
          });
          if (!hasEn) {
            await this.prisma.exerciseTranslation.create({
              data: { exercise_id: result.id, locale: "en", name: item.name }
            });
          }

          if (result.created_at.getTime() === result.updated_at.getTime()) {
            inserted++;
          } else {
            updated++;
          }
        } catch (err) {
          errors.push(`${item.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      offset += LIMIT_PER_PAGE;
    } while (offset < total);

    return { inserted, updated, total, errors };
  }
}
