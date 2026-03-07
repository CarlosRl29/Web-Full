import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  ExerciseDifficulty,
  ExerciseType,
  MovementPattern,
  MuscleGroup,
  Submuscle
} from "@prisma/client";

export type ExerciseWithTaxonomy = {
  id: string;
  name: string;
  muscle_group: string;
  sub_muscle: string | null;
  equipment: string | null;
  primary_muscle: MuscleGroup | null;
  primary_submuscle: Submuscle | null;
  secondary_muscles?: MuscleGroup[];
  movement_pattern: MovementPattern | null;
  exercise_type: ExerciseType | null;
  difficulty: ExerciseDifficulty | null;
  exercise_family: string | null;
};

export type ExerciseLibraryFilters = {
  muscleGroups?: string[];
  equipment?: string[];
  excludeMuscleGroups?: string[];
  excludeEquipment?: string[];
  limit?: number;
  userId?: string;
};

export type ExerciseLibraryItem = {
  id: string;
  name: string;
  muscle_group: string;
  sub_muscle: string | null;
  body_part: string | null;
  equipment: string | null;
};

const EQUIPMENT_ALIASES: Record<string, string[]> = {
  barbell: ["barbell", "barra", "Barra"],
  dumbbell: ["dumbbell", "mancuernas", "Mancuernas"],
  kettlebell: ["kettlebell", "Kettlebell"],
  "body weight": ["body weight", "bodyweight", "peso corporal", "Bodyweight"],
  cable: ["cable", "polea", "Polea"],
  "resistance band": ["resistance band", "banda elástica"],
  "smith machine": ["smith machine", "máquina smith", "Máquina"],
  "ez barbell": ["ez barbell", "barra ez"],
  "medicine ball": ["medicine ball", "balón medicinal"],
  machine: ["machine", "máquina", "maquina", "Máquina", "Banco"]
};

/** Service to fetch exercises from the database. AI can ONLY select from this library. */
@Injectable()
export class ExerciseLibraryService {
  constructor(private readonly prisma: PrismaService) {}

  private matchesEquipment(exEquipment: string | null, filterEquipment: string[]): boolean {
    if (filterEquipment.length === 0) return true;
    const eq = (exEquipment ?? "body weight").toLowerCase().replace(/_/g, " ").trim();
    return filterEquipment.some((filterKey) => {
      const key = filterKey.toLowerCase().trim();
      const aliases = EQUIPMENT_ALIASES[key] ?? [key];
      return aliases.some((a) => eq === a.toLowerCase() || eq.includes(a.toLowerCase()));
    });
  }

  private matchesMuscle(muscleGroup: string, filterMuscles: string[]): boolean {
    if (filterMuscles.length === 0) return true;
    const mg = muscleGroup.toLowerCase();
    return filterMuscles.some((m) => mg.includes(m.toLowerCase()) || m.toLowerCase().includes(mg));
  }

  private getDisplayName(
    ex: { translations?: Array<{ locale: string; name: string }>; name: string },
    locale: "es" | "en" = "en"
  ): string {
    const translations = ex.translations ?? [];
    const byLocale = translations.find((t) => t.locale === locale);
    const byEn = translations.find((t) => t.locale === "en");
    return (byLocale ?? byEn)?.name ?? ex.name;
  }

  async getExerciseLibrary(
    filters: ExerciseLibraryFilters = {},
    locale: "es" | "en" = "en"
  ): Promise<ExerciseLibraryItem[]> {
    const {
      muscleGroups = [],
      equipment = [],
      excludeMuscleGroups = [],
      excludeEquipment = [],
      limit = 500,
      userId
    } = filters;

    const andClauses: object[] = [];

    if (muscleGroups.length > 0) {
      andClauses.push({
        OR: muscleGroups.map((m) => ({
          muscle_group: { contains: m, mode: "insensitive" as const }
        }))
      });
    }

    if (excludeMuscleGroups.length > 0) {
      andClauses.push({
        AND: excludeMuscleGroups.map((m) => ({
          NOT: { muscle_group: { contains: m, mode: "insensitive" as const } }
        }))
      });
    }

    const exercises = await this.prisma.exercise.findMany({
      where: andClauses.length > 0 ? { AND: andClauses } : undefined,
      include: { translations: true },
      orderBy: { name: "asc" as const },
      take: limit
    });

    let filtered = exercises;
    if (equipment.length > 0) {
      filtered = exercises.filter((ex) => this.matchesEquipment(ex.equipment, equipment));
    }
    if (excludeEquipment.length > 0) {
      filtered = filtered.filter((ex) => !this.matchesEquipment(ex.equipment, excludeEquipment));
    }

    return this.applyUserPreferences(filtered, userId, locale);
  }

  private async applyUserPreferences(
    exercises: Array<{ id: string; exercise_family?: string | null; translations?: Array<{ locale: string; name: string }>; name: string; muscle_group: string; sub_muscle: string | null; body_part: string | null; equipment: string | null }>,
    userId: string | undefined,
    locale: "es" | "en"
  ): Promise<ExerciseLibraryItem[]> {
    const mapEx = (ex: (typeof exercises)[0]) => ({
      id: ex.id,
      name: this.getDisplayName(ex, locale),
      muscle_group: ex.muscle_group,
      sub_muscle: ex.sub_muscle,
      body_part: ex.body_part,
      equipment: ex.equipment
    });

    if (!userId) return exercises.map(mapEx);

    const prefs = await this.prisma.userExercisePreference.findMany({
      where: { user_id: userId }
    });
    const avoidIds = new Set(prefs.filter((p) => p.preference_type === "AVOID" && p.exercise_id).map((p) => p.exercise_id!));
    const preferIds = new Set(prefs.filter((p) => p.preference_type === "PREFER" && p.exercise_id).map((p) => p.exercise_id!));
    const preferFamilies = new Set(prefs.filter((p) => p.preference_type === "PREFER" && p.exercise_family).map((p) => p.exercise_family!));

    const filtered = exercises.filter((ex) => !avoidIds.has(ex.id));
    const withPreferred = filtered.map((ex) => ({
      ex,
      isPreferred: preferIds.has(ex.id) || (ex.exercise_family != null && preferFamilies.has(ex.exercise_family))
    }));
    withPreferred.sort((a, b) => (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0));

    return withPreferred.map(({ ex }) => mapEx(ex));
  }

  /** Day type -> taxonomy: movement_pattern + primary_muscle */
  private getTaxonomyForDayType(dayType: string): { movementPatterns: MovementPattern[]; muscles: MuscleGroup[] } {
    switch (dayType) {
      case "PUSH":
        return {
          movementPatterns: ["PUSH", "ISOLATION"],
          muscles: ["CHEST", "SHOULDERS", "TRICEPS"]
        };
      case "PULL":
        return { movementPatterns: ["PULL", "ISOLATION"], muscles: ["BACK", "BICEPS"] };
      case "LEGS":
      case "LOWER":
        return {
          movementPatterns: ["SQUAT", "HINGE", "LUNGE", "ISOLATION"],
          muscles: ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES"]
        };
      case "UPPER":
        return {
          movementPatterns: ["PUSH", "PULL", "ISOLATION"],
          muscles: ["CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS"]
        };
      case "FULL":
        return {
          movementPatterns: ["PUSH", "PULL", "SQUAT", "HINGE", "LUNGE", "CORE", "ISOLATION"],
          muscles: ["CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS", "QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE"]
        };
      case "CHEST_TRICEPS":
        return {
          movementPatterns: ["PUSH", "ISOLATION"],
          muscles: ["CHEST", "SHOULDERS", "TRICEPS"]
        };
      case "BACK_BICEPS":
        return { movementPatterns: ["PULL", "ISOLATION"], muscles: ["BACK", "BICEPS"] };
      case "LEGS_FULL":
      case "LOWER_QUAD_FOCUS":
      case "LOWER_GLUTE_HAM_FOCUS":
        return {
          movementPatterns: ["SQUAT", "HINGE", "LUNGE", "CORE", "ISOLATION"],
          muscles: ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE"]
        };
      case "SHOULDERS_CORE":
        return {
          movementPatterns: ["PUSH", "PULL", "ISOLATION", "CORE"],
          muscles: ["SHOULDERS", "CORE"]
        };
      default:
        return { movementPatterns: ["PUSH"], muscles: ["CHEST"] };
    }
  }

  /** Get exercises for push/pull/legs muscle groups. Prefers taxonomy; fallbacks to muscle_group. */
  async getExercisesByDayType(
    dayType: "PUSH" | "PULL" | "LEGS" | "UPPER" | "LOWER" | "FULL",
    equipment: string[],
    limit = 80,
    locale: "es" | "en" = "en",
    userId?: string
  ): Promise<ExerciseLibraryItem[]> {
    const { movementPatterns, muscles: taxonomyMuscles } = this.getTaxonomyForDayType(dayType);
    const equipmentFilter =
      equipment.length > 0
        ? [...equipment.map((e) => String(e).toLowerCase().trim()), "body weight"]
        : [
            "barbell",
            "dumbbell",
            "body weight",
            "kettlebell",
            "cable",
            "resistance band",
            "smith machine"
          ];

    const include = {
      translations: { select: { locale: true, name: true } }
    };

    type ExWithFamily = ExerciseLibraryItem & { exercise_family?: string | null };
    const all: ExWithFamily[] = [];
    const seenIds = new Set<string>();

    const byTaxonomy = await this.prisma.exercise.findMany({
      where: {
        primary_muscle: { in: taxonomyMuscles },
        movement_pattern: { in: movementPatterns }
      },
      include,
      take: limit * 2
    });
    for (const ex of byTaxonomy) {
      if (seenIds.has(ex.id)) continue;
      if (!this.matchesEquipment(ex.equipment, equipmentFilter)) continue;
      seenIds.add(ex.id);
      all.push({
        id: ex.id,
        name: this.getDisplayName(ex, locale),
        muscle_group: ex.muscle_group,
        sub_muscle: ex.sub_muscle,
        body_part: ex.body_part,
        equipment: ex.equipment,
        exercise_family: ex.exercise_family
      });
      if (all.length >= limit) return userId ? this.applyUserPreferences(all, userId, locale) : all;
    }

    if (all.length < limit) {
      console.warn(
        `[ExerciseLibrary] Only ${all.length} taxonomy-classified exercises for ${dayType} (need ${limit}); ` +
          `falling back to muscle_group. Consider running backfill-exercise-taxonomy or classifying more exercises.`
      );
    }

    const PUSH_MUSCLES = [
      "chest",
      "pectorals",
      "shoulders",
      "deltoids",
      "triceps",
      "pecho",
      "pectorales",
      "hombros",
      "tríceps",
      "full body"
    ];
    const PULL_MUSCLES = [
      "back",
      "upper back",
      "lats",
      "biceps",
      "espalda",
      "dorsales",
      "bíceps",
      "trapecio",
      "antebrazos",
      "full body"
    ];
    const LEGS_MUSCLES = [
      "quadriceps",
      "hamstrings",
      "glutes",
      "calves",
      "cuádriceps",
      "isquiotibiales",
      "glúteos",
      "gemelos",
      "piernas",
      "full body",
      "abdominales"
    ];

    let muscles: string[];
    switch (dayType) {
      case "PUSH":
        muscles = PUSH_MUSCLES;
        break;
      case "PULL":
        muscles = PULL_MUSCLES;
        break;
      case "LEGS":
        muscles = LEGS_MUSCLES;
        break;
      case "UPPER":
        muscles = [...PUSH_MUSCLES, ...PULL_MUSCLES];
        break;
      case "LOWER":
        muscles = LEGS_MUSCLES;
        break;
      case "FULL":
        muscles = [...PUSH_MUSCLES, ...PULL_MUSCLES, ...LEGS_MUSCLES];
        break;
      default:
        muscles = PUSH_MUSCLES;
    }

    for (const m of muscles) {
      const rows = await this.prisma.exercise.findMany({
        where: { muscle_group: { contains: m, mode: "insensitive" as const } },
        include,
        take: limit
      });
      for (const ex of rows) {
        if (seenIds.has(ex.id)) continue;
        if (!this.matchesEquipment(ex.equipment, equipmentFilter)) continue;
        seenIds.add(ex.id);
        all.push({
          id: ex.id,
          name: this.getDisplayName(ex, locale),
          muscle_group: ex.muscle_group,
          sub_muscle: ex.sub_muscle,
          body_part: ex.body_part,
          equipment: ex.equipment,
          exercise_family: ex.exercise_family
        });
      }
    }

    if (all.length === 0 && equipmentFilter.length > 1) {
      const fallback = await this.prisma.exercise.findMany({
        where: { muscle_group: { contains: muscles[0], mode: "insensitive" as const } },
        include,
        take: 50
      });
      for (const ex of fallback) {
        if (!seenIds.has(ex.id)) {
          seenIds.add(ex.id);
          all.push({
            id: ex.id,
            name: this.getDisplayName(ex, locale),
            muscle_group: ex.muscle_group,
            sub_muscle: ex.sub_muscle,
            body_part: ex.body_part,
            equipment: ex.equipment,
            exercise_family: ex.exercise_family
          });
        }
      }
    }

    return userId ? this.applyUserPreferences(all, userId, locale) : all;
  }

  /** Get exercises with full taxonomy for AXION generator. Filters by day type, equipment, applies avoid/prefer. */
  async getExercisesWithTaxonomyForDayType(
    dayType: "PUSH" | "PULL" | "LEGS" | "UPPER" | "LOWER" | "FULL" | "CHEST_TRICEPS" | "BACK_BICEPS" | "LEGS_FULL" | "SHOULDERS_CORE" | "LOWER_QUAD_FOCUS" | "LOWER_GLUTE_HAM_FOCUS",
    equipment: string[],
    limit = 100,
    userId?: string
  ): Promise<ExerciseWithTaxonomy[]> {
    const { movementPatterns, muscles: taxonomyMuscles } = this.getTaxonomyForDayType(dayType);
    const equipmentFilter =
      equipment.length > 0
        ? [...equipment.map((e) => String(e).toLowerCase().trim()), "body weight"]
        : [
            "barbell",
            "dumbbell",
            "body weight",
            "kettlebell",
            "cable",
            "resistance band",
            "smith machine"
          ];

    const include = { translations: { select: { locale: true, name: true } } };
    const byTaxonomy = await this.prisma.exercise.findMany({
      where: {
        primary_muscle: { in: taxonomyMuscles },
        movement_pattern: { in: movementPatterns }
      },
      include,
      take: limit * 2
    });

    const all: ExerciseWithTaxonomy[] = [];
    const seenIds = new Set<string>();
    for (const ex of byTaxonomy) {
      if (seenIds.has(ex.id)) continue;
      if (!this.matchesEquipment(ex.equipment, equipmentFilter)) continue;
      seenIds.add(ex.id);
      all.push({
        id: ex.id,
        name: this.getDisplayName(ex, "es"),
        muscle_group: ex.muscle_group,
        sub_muscle: ex.sub_muscle,
        equipment: ex.equipment,
        primary_muscle: ex.primary_muscle,
        primary_submuscle: ex.primary_submuscle,
        secondary_muscles: ex.secondary_muscles,
        movement_pattern: ex.movement_pattern,
        exercise_type: ex.exercise_type,
        difficulty: ex.difficulty,
        exercise_family: ex.exercise_family
      });
      if (all.length >= limit) break;
    }

    if (userId) {
      const prefs = await this.prisma.userExercisePreference.findMany({
        where: { user_id: userId }
      });
      const avoidIds = new Set(prefs.filter((p) => p.preference_type === "AVOID" && p.exercise_id).map((p) => p.exercise_id!));
      const filtered = all.filter((ex) => !avoidIds.has(ex.id));
      const preferIds = new Set(prefs.filter((p) => p.preference_type === "PREFER" && p.exercise_id).map((p) => p.exercise_id!));
      const preferFamilies = new Set(prefs.filter((p) => p.preference_type === "PREFER" && p.exercise_family).map((p) => p.exercise_family!));
      const withPreferred = filtered.map((ex) => ({
        ex,
        isPreferred: preferIds.has(ex.id) || (ex.exercise_family != null && preferFamilies.has(ex.exercise_family))
      }));
      withPreferred.sort((a, b) => (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0));
      return withPreferred.map(({ ex }) => ex);
    }
    return all;
  }

  /** Validate that all exercise IDs exist in the database. */
  async validateExerciseIds(ids: string[]): Promise<{ valid: string[]; invalid: string[] }> {
    const unique = [...new Set(ids)];
    const found = await this.prisma.exercise.findMany({
      where: { id: { in: unique } },
      select: { id: true }
    });
    const validSet = new Set(found.map((e) => e.id));
    const valid = unique.filter((id) => validSet.has(id));
    const invalid = unique.filter((id) => !validSet.has(id));
    return { valid, invalid };
  }
}
