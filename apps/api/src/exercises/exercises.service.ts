import { Injectable } from "@nestjs/common";
import { CreateExerciseInput, UpdateExerciseInput } from "@gym/shared";
import type { MuscleGroup } from "./exercise-types";
import { PrismaService } from "../prisma/prisma.service";

/** Search terms → variants (ES + EN) for text search */
const SEARCH_EXPAND: Record<string, string[]> = {
  pecho: ["pecho", "pectorales", "chest", "pectorals", "pectoral"],
  pectorales: ["pectorales", "pecho", "chest", "pectorals"],
  espalda: ["espalda", "dorsales", "back", "upper back", "lats"],
  dorsales: ["dorsales", "espalda", "back", "lats"],
  biceps: ["bíceps", "biceps", "bicep"],
  bíceps: ["bíceps", "biceps"],
  triceps: ["tríceps", "triceps", "tricep"],
  tríceps: ["tríceps", "triceps"],
  hombros: ["hombros", "deltoides", "shoulders", "deltoids"],
  deltoides: ["deltoides", "hombros", "shoulders"],
  cuádriceps: ["cuádriceps", "quadriceps", "quads"],
  cuadriceps: ["cuádriceps", "quadriceps"],
  isquiotibiales: ["isquiotibiales", "hamstrings"],
  glúteos: ["glúteos", "glutes"],
  gluteos: ["glúteos", "glutes"],
  gemelos: ["gemelos", "calves"],
  abdominales: ["abdominales", "abs", "waist", "core"],
  abs: ["abdominales", "abs", "waist"],
  core: ["core", "abdominales", "waist"]
};

function expandSearchTerms(term: string): string[] {
  const lower = term.toLowerCase().trim();
  const expanded = new Set<string>([lower]);
  if (SEARCH_EXPAND[lower]) {
    SEARCH_EXPAND[lower].forEach((t) => expanded.add(t));
  }
  return Array.from(expanded);
}

/** Search terms → MuscleGroup when search implies a muscle (for ranking) */
const SEARCH_TO_MUSCLE: Record<string, MuscleGroup> = {
  pecho: "CHEST",
  pectorales: "CHEST",
  chest: "CHEST",
  pectorals: "CHEST",
  espalda: "BACK",
  dorsales: "BACK",
  back: "BACK",
  lats: "BACK",
  biceps: "BICEPS",
  bíceps: "BICEPS",
  triceps: "TRICEPS",
  tríceps: "TRICEPS",
  hombros: "SHOULDERS",
  deltoides: "SHOULDERS",
  shoulders: "SHOULDERS",
  cuádriceps: "QUADS",
  quadriceps: "QUADS",
  quads: "QUADS",
  isquiotibiales: "HAMSTRINGS",
  hamstrings: "HAMSTRINGS",
  glúteos: "GLUTES",
  gluteos: "GLUTES",
  glutes: "GLUTES",
  gemelos: "CALVES",
  calves: "CALVES",
  abdominales: "CORE",
  abs: "CORE",
  core: "CORE"
};

function inferMuscleFromSearch(search: string): MuscleGroup | null {
  const token = search.toLowerCase().trim();
  return SEARCH_TO_MUSCLE[token] ?? null;
}

/** Filter options: value = API value, label = Spanish display */
const MUSCLE_OPTIONS: Array<{ value: MuscleGroup; label: string }> = [
  { value: "CHEST", label: "Pectorales" },
  { value: "BACK", label: "Espalda" },
  { value: "SHOULDERS", label: "Hombros" },
  { value: "BICEPS", label: "Bíceps" },
  { value: "TRICEPS", label: "Tríceps" },
  { value: "QUADS", label: "Cuádriceps" },
  { value: "HAMSTRINGS", label: "Isquiotibiales" },
  { value: "GLUTES", label: "Glúteos" },
  { value: "CALVES", label: "Gemelos" },
  { value: "CORE", label: "Core" }
];

const SUBMUSCLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "UPPER_CHEST", label: "Pectoral superior" },
  { value: "MID_CHEST", label: "Pectoral medio" },
  { value: "LOWER_CHEST", label: "Pectoral inferior" },
  { value: "LATS", label: "Dorsales" },
  { value: "UPPER_BACK", label: "Espalda alta" },
  { value: "MID_BACK", label: "Espalda media" },
  { value: "LOWER_BACK", label: "Espalda baja" },
  { value: "TRAPS", label: "Trapecio" },
  { value: "ANTERIOR_DELTOID", label: "Deltoides anterior" },
  { value: "LATERAL_DELTOID", label: "Deltoides lateral" },
  { value: "REAR_DELTOID", label: "Deltoides posterior" },
  { value: "ABS", label: "Abdominales" },
  { value: "OBLIQUES", label: "Oblicuos" },
  { value: "ERECTORS", label: "Erectores" }
];

const EQUIPMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "Barbell", label: "Barra" },
  { value: "Dumbbell", label: "Mancuernas" },
  { value: "Machine", label: "Máquina" },
  { value: "Cable", label: "Polea" },
  { value: "Bodyweight", label: "Peso corporal" },
  { value: "Kettlebell", label: "Kettlebell" },
  { value: "Smith Machine", label: "Smith" },
  { value: "Resistance Band", label: "Banda elástica" },
  { value: "Bench", label: "Banco" },
  { value: "EZ Bar", label: "Barra EZ" },
  { value: "Trap Bar", label: "Barra hexagonal" }
];

/** Localized labels for muscles and submuscles (ES / EN) */
const MUSCLE_LABELS: Record<"es" | "en", Record<string, string>> = {
  es: Object.fromEntries(MUSCLE_OPTIONS.map((o) => [o.value, o.label])),
  en: {
    CHEST: "Chest",
    BACK: "Back",
    SHOULDERS: "Shoulders",
    BICEPS: "Biceps",
    TRICEPS: "Triceps",
    QUADS: "Quads",
    HAMSTRINGS: "Hamstrings",
    GLUTES: "Glutes",
    CALVES: "Calves",
    CORE: "Core"
  }
};

const SUBMUSCLE_LABELS: Record<"es" | "en", Record<string, string>> = {
  es: Object.fromEntries(SUBMUSCLE_OPTIONS.map((o) => [o.value, o.label])),
  en: {
    UPPER_CHEST: "Upper chest",
    MID_CHEST: "Mid chest",
    LOWER_CHEST: "Lower chest",
    LATS: "Lats",
    UPPER_BACK: "Upper back",
    MID_BACK: "Mid back",
    LOWER_BACK: "Lower back",
    TRAPS: "Traps",
    ANTERIOR_DELTOID: "Anterior deltoid",
    LATERAL_DELTOID: "Lateral deltoid",
    REAR_DELTOID: "Rear deltoid",
    QUADS: "Quads",
    HAMSTRINGS: "Hamstrings",
    GLUTES: "Glutes",
    CALVES: "Calves",
    ABS: "Abs",
    OBLIQUES: "Obliques",
    ERECTORS: "Erectors",
    BICEPS: "Biceps",
    TRICEPS: "Triceps"
  }
};

function getMuscleLabel(value: string | null | undefined, locale: "es" | "en"): string | null {
  if (!value) return null;
  return MUSCLE_LABELS[locale][value] ?? value.replace(/_/g, " ");
}

function getSubmuscleLabel(value: string | null | undefined, locale: "es" | "en"): string | null {
  if (!value) return null;
  return SUBMUSCLE_LABELS[locale][value] ?? value.replace(/_/g, " ");
}

type ListParams = {
  search?: string;
  limit?: number;
  offset?: number;
  muscle?: MuscleGroup;
  submuscle?: string;
  body_part?: string;
  equipment?: string;
  locale?: "es" | "en";
  pending_only?: boolean;
};

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  private getDisplayName(
    ex: { translations?: Array<{ locale: string; name: string }>; name: string },
    locale: "es" | "en"
  ): string {
    const translations = ex.translations ?? [];
    const byLocale = translations.find((t) => t.locale === locale);
    const byEn = translations.find((t) => t.locale === "en");
    return (byLocale ?? byEn)?.name ?? ex.name;
  }

  private getLocalizedInstructions(
    ex: { translations?: Array<{ locale: string; short_description?: string | null }>; instructions?: string | null },
    locale: "es" | "en"
  ): string | null {
    const translations = ex.translations ?? [];
    const byLocale = translations.find((t) => t.locale === locale);
    const byEn = translations.find((t) => t.locale === "en");
    const fromTranslation = (byLocale ?? byEn)?.short_description;
    return fromTranslation ?? ex.instructions ?? null;
  }

  async list(params: ListParams = {}) {
    const {
      search,
      limit = 100,
      offset = 0,
      muscle,
      submuscle,
      body_part,
      equipment,
      locale = "en",
      pending_only = false
    } = params;
    const andClauses: object[] = [];

    if (pending_only) {
      andClauses.push({
        OR: [
          { primary_muscle: null },
          { movement_pattern: null }
        ]
      });
    }

    if (search && search.trim()) {
      const terms = expandSearchTerms(search.trim());
      const orClauses: object[] = [];
      for (const term of terms) {
        orClauses.push(
          { name: { contains: term, mode: "insensitive" as const } },
          { canonical_slug: { contains: term, mode: "insensitive" as const } },
          { translations: { some: { name: { contains: term, mode: "insensitive" as const } } } }
        );
      }
      andClauses.push({ OR: orClauses });
    }
    if (muscle) {
      andClauses.push({ primary_muscle: muscle });
    }
    if (submuscle && submuscle.trim()) {
      andClauses.push({ primary_submuscle: submuscle.trim() as never });
    }
    if (body_part && body_part.trim()) {
      andClauses.push({ body_part: { contains: body_part.trim(), mode: "insensitive" as const } });
    }
    if (equipment && equipment.trim()) {
      andClauses.push({ equipment: equipment.trim() });
    }

    const where = andClauses.length > 0 ? { AND: andClauses } : undefined;
    const rankMuscle = muscle ?? (search?.trim() ? inferMuscleFromSearch(search.trim()) : null);

    type ExWithTranslations = { id: string; name: string; equipment: string | null; muscle_group: string | null; sub_muscle: string | null; media_url: string | null; instructions: string | null; translations: Array<{ locale: string; name: string; short_description?: string | null }> } & Record<string, unknown>;
    let sorted: ExWithTranslations[];

    if (rankMuscle) {
      const rankedRanks = await this.prisma.exerciseMuscleRank.findMany({
        where: { muscle: rankMuscle },
        orderBy: { rank: "asc" },
        select: { exercise_id: true, rank: true },
        take: offset + limit + 500
      });
      const rankedIds = rankedRanks.map((r: { exercise_id: string }) => r.exercise_id);
      const rankById = new Map(
        rankedRanks.map((r: { exercise_id: string; rank: number }) => [r.exercise_id, r.rank])
      );

      const whereAnd = where ? (Array.isArray((where as { AND?: object[] }).AND) ? (where as { AND: object[] }).AND : [where]) : [];
      const rankedWhere = rankedIds.length > 0 ? { AND: [...whereAnd, { id: { in: rankedIds } }] } : { id: { in: [] } };
      const unrankedWhere = { AND: [...whereAnd, { id: { notIn: rankedIds } }] };

      const [rankedExercises, unrankedExercises] = await Promise.all([
        this.prisma.exercise.findMany({
          where: rankedWhere as never,
          include: { translations: true },
          orderBy: { name: "asc" }
        }),
        this.prisma.exercise.findMany({
          where: unrankedWhere as never,
          include: { translations: true },
          orderBy: { name: "asc" },
          take: limit + 200
        })
      ]);

      const rankNum = (id: string): number => (rankById.get(id) as number | undefined) ?? 9999;
      const rankedSorted = rankedExercises.sort(
        (a: ExWithTranslations, b: ExWithTranslations) => rankNum(a.id) - rankNum(b.id)
      );
      sorted = [...rankedSorted, ...unrankedExercises].slice(offset, offset + limit);
    } else {
      const exercises = await this.prisma.exercise.findMany({
        where: where as never,
        include: { translations: true },
        orderBy: { name: "asc" },
        skip: offset,
        take: limit
      });
      sorted = exercises;
    }

    type ExWithTaxonomy = ExWithTranslations & {
      canonical_slug?: string | null;
      primary_muscle?: string | null;
      primary_submuscle?: string | null;
      secondary_muscles?: unknown[];
      movement_pattern?: string | null;
      exercise_type?: string | null;
      difficulty?: string | null;
    };

    const secondaryArr = (e: ExWithTaxonomy) =>
      (Array.isArray((e as ExWithTaxonomy).secondary_muscles) ? (e as ExWithTaxonomy).secondary_muscles : []) as string[];

    return sorted.map((ex: ExWithTranslations) => {
      const e = ex as ExWithTaxonomy;
      const displayName = this.getDisplayName(ex, locale);
      const instructions = this.getLocalizedInstructions(ex, locale);
      const submuscle = e.primary_submuscle ?? e.sub_muscle ?? null;
      const sec = secondaryArr(e);
      return {
        id: ex.id,
        canonical_slug: e.canonical_slug ?? null,
        primary_muscle: e.primary_muscle ?? null,
        primary_submuscle: e.primary_submuscle ?? null,
        secondary_muscles: sec,
        primary_muscle_label: getMuscleLabel(e.primary_muscle, locale),
        primary_submuscle_label: getSubmuscleLabel(e.primary_submuscle, locale),
        secondary_muscles_labels: sec.map((m) => getMuscleLabel(m, locale)).filter(Boolean) as string[],
        movement_pattern: e.movement_pattern ?? null,
        exercise_type: e.exercise_type ?? null,
        difficulty: e.difficulty ?? null,
        equipment: ex.equipment,
        display_name: displayName,
        name: displayName,
        name_en: ex.name,
        muscle_group: ex.muscle_group,
        sub_muscle: ex.sub_muscle ?? null,
        submuscle,
        instructions,
        image_url: ex.media_url ?? null,
        type: e.exercise_type ?? ex.equipment ?? null
      };
    });
  }

  detail(id: string) {
    return this.prisma.exercise.findUnique({ where: { id } });
  }

  getFilterOptions() {
    return {
      muscles: MUSCLE_OPTIONS,
      submuscles: SUBMUSCLE_OPTIONS,
      types: EQUIPMENT_OPTIONS
    };
  }

  create(input: CreateExerciseInput, userId: string) {
    return this.prisma.exercise.create({
      data: {
        ...input,
        created_by_id: userId
      }
    });
  }

  async update(id: string, input: UpdateExerciseInput) {
    const existing = await this.prisma.exercise.findUnique({ where: { id } });
    if (!existing) return null;
    return this.prisma.exercise.update({
      where: { id },
      data: input as Record<string, unknown>
    });
  }
}
