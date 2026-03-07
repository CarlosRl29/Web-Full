import { Injectable, Logger } from "@nestjs/common";
import type { MuscleGroup } from "./exercise-types";
import { PrismaService } from "../prisma/prisma.service";
import {
  inferDifficulty,
  inferExerciseType,
  inferMovementPattern,
  inferPrimaryMuscle,
  toCanonicalSlug
} from "./taxonomy-inference";
import { TOP_RANKS_BY_MUSCLE } from "./exercise-ranks";

const EXERCISEDB_BASE = "https://exercisedb.dev/api/v1";
const PAGE_SIZE = 50;
const BATCH_SIZE = 20;
const MAX_SYNC_ITEMS = 200;
const CORE_MUSCLE_SET = new Set<MuscleGroup>([
  "CHEST",
  "BACK",
  "SHOULDERS",
  "BICEPS",
  "TRICEPS",
  "QUADS",
  "HAMSTRINGS",
  "GLUTES",
  "CALVES",
  "CORE"
]);
const ALLOWED_EQUIPMENT = [
  "bodyweight",
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "kettlebell",
  "smith",
  "band",
  "bench",
  "ez bar",
  "trap bar"
];

type ExerciseDbItem = {
  name?: string;
  targetMuscles?: string[];
  secondaryMuscles?: string[];
  bodyParts?: string[];
  equipments?: string[];
  instructions?: string[];
  gifUrl?: string;
  exerciseType?: string;
  exerciseTypes?: string[];
  type?: string;
};

type MappedExercise = {
  nameEn: string;
  canonicalSlug: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  movementPattern: ReturnType<typeof inferMovementPattern>;
  exerciseType: ReturnType<typeof inferExerciseType>;
  difficulty: ReturnType<typeof inferDifficulty>;
  muscleGroup: string;
  subMuscle: string | null;
  bodyPart: string | null;
  equipment: string | null;
  instructions: string | null;
  mediaUrl: string | null;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function mapMuscleToEnum(raw: string): MuscleGroup | null {
  const token = normalizeText(raw);
  if (token.includes("chest") || token.includes("pect")) return "CHEST";
  if (token.includes("back") || token.includes("lat")) return "BACK";
  if (token.includes("shoulder") || token.includes("deltoid")) return "SHOULDERS";
  if (token.includes("bicep")) return "BICEPS";
  if (token.includes("tricep")) return "TRICEPS";
  if (token.includes("quad")) return "QUADS";
  if (token.includes("hamstring")) return "HAMSTRINGS";
  if (token.includes("glute")) return "GLUTES";
  if (token.includes("calf")) return "CALVES";
  if (token.includes("ab") || token.includes("core")) return "CORE";
  return null;
}

function mapEquipment(raw: string | undefined): string | null {
  if (!raw) return null;
  const token = normalizeText(raw);
  if (token.includes("bodyweight") || token.includes("body weight")) return "Bodyweight";
  if (token.includes("barbell")) return "Barbell";
  if (token.includes("dumbbell")) return "Dumbbell";
  if (token.includes("machine")) return "Machine";
  if (token.includes("cable")) return "Cable";
  if (token.includes("kettlebell")) return "Kettlebell";
  if (token.includes("smith")) return "Smith Machine";
  if (token.includes("band")) return "Resistance Band";
  if (token.includes("bench")) return "Bench";
  if (token.includes("ez bar")) return "EZ Bar";
  if (token.includes("trap bar")) return "Trap Bar";
  return toTitleCase(token);
}

function isStrengthExercise(item: ExerciseDbItem): boolean {
  const allTypes = [
    item.exerciseType,
    ...(item.exerciseTypes ?? []),
    item.type
  ]
    .filter(Boolean)
    .map((value) => normalizeText(String(value)));

  if (allTypes.length === 0) return true;
  return allTypes.some((value) => value === "strength");
}

function isAllowedEquipment(equipment: string | null): boolean {
  if (!equipment) return true;
  const token = normalizeText(equipment);
  return ALLOWED_EQUIPMENT.some((value) => token.includes(value));
}

function splitInChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

@Injectable()
export class ExerciseSyncService {
  private readonly logger = new Logger(ExerciseSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async fetchPage(offset: number): Promise<{ data: ExerciseDbItem[]; total: number | null }> {
    const url = `${EXERCISEDB_BASE}/exercises?limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ExerciseDB request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as
      | { data?: ExerciseDbItem[]; metadata?: { totalExercises?: number } }
      | ExerciseDbItem[];

    if (Array.isArray(payload)) {
      return { data: payload, total: null };
    }

    return {
      data: payload.data ?? [],
      total: payload.metadata?.totalExercises ?? null
    };
  }

  private normalizeExercise(item: ExerciseDbItem): MappedExercise | null {
    const nameEn = item.name?.trim();
    if (!nameEn) return null;
    if (!isStrengthExercise(item)) return null;

    const targetMuscles = item.targetMuscles ?? [];
    const secondaryRaw = item.secondaryMuscles ?? [];
    const equipment = mapEquipment(item.equipments?.[0]);

    const primaryFromSource = mapMuscleToEnum(targetMuscles[0] ?? "");
    const inferredPrimary = primaryFromSource ?? inferPrimaryMuscle(nameEn, targetMuscles[0] ?? "", secondaryRaw.join(", "));
    if (!inferredPrimary || !CORE_MUSCLE_SET.has(inferredPrimary)) return null;
    if (!isAllowedEquipment(equipment)) return null;

    const canonicalSlug = toCanonicalSlug(nameEn);
    if (!canonicalSlug) return null;

    const secondaryMuscles = Array.from(
      new Set(
        secondaryRaw
          .map((raw) => mapMuscleToEnum(raw))
          .filter((value): value is MuscleGroup => Boolean(value))
          .filter((value) => CORE_MUSCLE_SET.has(value) && value !== inferredPrimary)
      )
    );

    return {
      nameEn,
      canonicalSlug,
      primaryMuscle: inferredPrimary,
      secondaryMuscles,
      movementPattern: inferMovementPattern(nameEn, targetMuscles[0] ?? ""),
      exerciseType: inferExerciseType(nameEn),
      difficulty: inferDifficulty(nameEn),
      muscleGroup: targetMuscles[0] ?? "general",
      subMuscle: secondaryRaw.length > 0 ? secondaryRaw.join(", ") : null,
      bodyPart: item.bodyParts?.[0] ?? null,
      equipment,
      instructions: item.instructions?.length ? item.instructions.join("\n\n") : null,
      mediaUrl: item.gifUrl ?? null
    };
  }

  async syncFromExerciseDb(): Promise<{ inserted: number; updated: number; total: number }> {
    let inserted = 0;
    let updated = 0;
    let offset = 0;
    let fetchedTotal: number | null = null;
    const seenSlugs = new Set<string>();

    while (inserted + updated < MAX_SYNC_ITEMS) {
      let page: { data: ExerciseDbItem[]; total: number | null };
      try {
        page = await this.fetchPage(offset);
      } catch (error) {
        this.logger.error(`Failed to fetch ExerciseDB page at offset ${offset}`, error instanceof Error ? error.stack : undefined);
        break;
      }

      if (fetchedTotal === null) fetchedTotal = page.total;
      if (page.data.length === 0) break;

      const mapped = page.data
        .map((item) => this.normalizeExercise(item))
        .filter((item): item is MappedExercise => Boolean(item))
        .filter((item) => {
          if (seenSlugs.has(item.canonicalSlug)) return false;
          seenSlugs.add(item.canonicalSlug);
          return true;
        });

      for (const chunk of splitInChunks(mapped, BATCH_SIZE)) {
        for (const exercise of chunk) {
          if (inserted + updated >= MAX_SYNC_ITEMS) break;
          try {
            const existing = await this.prisma.exercise.findFirst({
              where: {
                OR: [
                  { canonical_slug: exercise.canonicalSlug },
                  { name: { equals: exercise.nameEn, mode: "insensitive" } }
                ]
              },
              select: { id: true }
            });

            let exerciseId: string;
            if (existing) {
              exerciseId = existing.id;
              await this.prisma.exercise.update({
                where: { id: existing.id },
                data: {
                  name: exercise.nameEn,
                  canonical_slug: exercise.canonicalSlug,
                  source: "exercisedb",
                  muscle_group: exercise.muscleGroup,
                  sub_muscle: exercise.subMuscle,
                  body_part: exercise.bodyPart,
                  equipment: exercise.equipment,
                  instructions: exercise.instructions,
                  media_url: exercise.mediaUrl,
                  primary_muscle: exercise.primaryMuscle,
                  secondary_muscles: exercise.secondaryMuscles,
                  movement_pattern: exercise.movementPattern ?? undefined,
                  exercise_type: exercise.exerciseType ?? undefined,
                  difficulty: exercise.difficulty ?? undefined
                }
              });
              await this.prisma.exerciseTranslation.upsert({
                where: {
                  exercise_id_locale: {
                    exercise_id: existing.id,
                    locale: "en"
                  }
                },
                update: { name: exercise.nameEn },
                create: {
                  exercise_id: existing.id,
                  locale: "en",
                  name: exercise.nameEn
                }
              });
              updated++;
            } else {
              const created = await this.prisma.exercise.create({
                data: {
                  name: exercise.nameEn,
                  canonical_slug: exercise.canonicalSlug,
                  source: "exercisedb",
                  muscle_group: exercise.muscleGroup,
                  sub_muscle: exercise.subMuscle,
                  body_part: exercise.bodyPart,
                  equipment: exercise.equipment,
                  instructions: exercise.instructions,
                  media_url: exercise.mediaUrl,
                  primary_muscle: exercise.primaryMuscle,
                  secondary_muscles: exercise.secondaryMuscles,
                  movement_pattern: exercise.movementPattern ?? undefined,
                  exercise_type: exercise.exerciseType ?? undefined,
                  difficulty: exercise.difficulty ?? undefined
                }
              });
              await this.prisma.exerciseTranslation.upsert({
                where: {
                  exercise_id_locale: {
                    exercise_id: created.id,
                    locale: "en"
                  }
                },
                update: { name: exercise.nameEn },
                create: {
                  exercise_id: created.id,
                  locale: "en",
                  name: exercise.nameEn
                }
              });
              exerciseId = created.id;
              inserted++;
            }
            if (exerciseId && exercise.primaryMuscle && exercise.canonicalSlug) {
              const topSlugs = TOP_RANKS_BY_MUSCLE[exercise.primaryMuscle];
              const rankIndex = topSlugs.indexOf(exercise.canonicalSlug);
              if (rankIndex >= 0) {
                await this.prisma.exerciseMuscleRank.upsert({
                  where: {
                    exercise_id_muscle: { exercise_id: exerciseId, muscle: exercise.primaryMuscle }
                  },
                  update: { rank: rankIndex + 1 },
                  create: {
                    exercise_id: exerciseId,
                    muscle: exercise.primaryMuscle,
                    rank: rankIndex + 1
                  }
                });
              }
            }
          } catch (error) {
            this.logger.error(
              `Failed to upsert exercise "${exercise.nameEn}" (${exercise.canonicalSlug})`,
              error instanceof Error ? error.stack : undefined
            );
          }
        }
      }

      offset += PAGE_SIZE;
      if (fetchedTotal !== null && offset >= fetchedTotal) break;
    }

    return { inserted, updated, total: inserted + updated };
  }
}
