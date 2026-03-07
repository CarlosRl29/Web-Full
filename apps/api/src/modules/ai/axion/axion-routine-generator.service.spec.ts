import { Test, TestingModule } from "@nestjs/testing";
import { AxionRoutineGeneratorService } from "./axion-routine-generator.service";
import { ExerciseLibraryService } from "../exercise-library.service";
import { RoutineValidationService } from "../routine-validation.service";
import { RoutinesService } from "../../../routines/routines.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { PrismaModule } from "../../../prisma/prisma.module";
import { getSplitTemplate } from "./axion-split-templates";
import { getSlotTemplatesForDayType } from "./axion-slot-templates";
import { getWeeklyTargetSets } from "./axion-volume-presets";
import { getLoadPreset } from "./axion-load-presets";
import { scoreExercise, selectBestExercise } from "./axion-exercise-scorer";
import type { SlotConstraint } from "./axion-types";
import type { ExerciseWithTaxonomy } from "./axion-types";

describe("AxionRoutineGeneratorService", () => {
  let service: AxionRoutineGeneratorService;

  const mockExerciseLibrary = {
    getExercisesWithTaxonomyForDayType: jest.fn()
  };
  const mockValidation = {
    toRoutineResponse: jest.fn((draft: { name: string; days: Array<{ day_label: string; groups: Array<{ exercises: Array<{ exercise_id: string }> }> }> }) => ({
      routine: {
        name: draft.name,
        description: "",
        days: draft.days.map((d) => ({
          day_label: d.day_label,
          order_index: 0,
          groups: d.groups.map((g) => ({
            type: "SINGLE",
            order_index: 0,
            rounds_total: 1,
            rest_between_exercises_seconds: 90,
            rest_after_round_seconds: 90,
            rest_after_set_seconds: 90,
            exercises: g.exercises.map((e) => ({
              exercise_id: e.exercise_id,
              order_in_group: "A1",
              target_sets_per_round: 4,
              rep_range_min: 8,
              rep_range_max: 12,
              notes: undefined
            }))
          }))
        }))
      }
    }))
  };
  const mockRoutinesService = {
    create: jest.fn().mockResolvedValue({
      id: "routine-1",
      name: "AXION • Hipertrofia • 4 días",
      description: "",
      days: []
    })
  };
  const mockPrisma = {
    userExercisePreference: { findMany: jest.fn().mockResolvedValue([]) }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockExerciseLibrary.getExercisesWithTaxonomyForDayType.mockResolvedValue(
      [
        { id: "ex-1", name: "Bench Press", muscle_group: "Chest", sub_muscle: null, equipment: "barbell", primary_muscle: "CHEST", primary_submuscle: "MID_CHEST", movement_pattern: "PUSH", exercise_type: "COMPOUND", difficulty: "INTERMEDIATE", exercise_family: "bench" },
        { id: "ex-2", name: "Incline DB Press", muscle_group: "Chest", sub_muscle: null, equipment: "dumbbell", primary_muscle: "CHEST", primary_submuscle: "UPPER_CHEST", movement_pattern: "PUSH", exercise_type: "COMPOUND", difficulty: "INTERMEDIATE", exercise_family: "press" },
        { id: "ex-3", name: "Cable Fly", muscle_group: "Chest", sub_muscle: null, equipment: "cable", primary_muscle: "CHEST", primary_submuscle: "MID_CHEST", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", difficulty: "BEGINNER", exercise_family: "fly" },
        { id: "ex-4", name: "Lateral Raise", muscle_group: "Shoulders", sub_muscle: null, equipment: "dumbbell", primary_muscle: "SHOULDERS", primary_submuscle: "LATERAL_DELTOID", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", difficulty: "BEGINNER", exercise_family: "raise" },
        { id: "ex-5", name: "Tricep Pushdown", muscle_group: "Triceps", sub_muscle: null, equipment: "cable", primary_muscle: "TRICEPS", primary_submuscle: "TRICEPS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", difficulty: "BEGINNER", exercise_family: "pushdown" },
        { id: "ex-6", name: "Barbell Row", muscle_group: "Back", sub_muscle: null, equipment: "barbell", primary_muscle: "BACK", primary_submuscle: "LATS", movement_pattern: "PULL", exercise_type: "COMPOUND", difficulty: "INTERMEDIATE", exercise_family: "row" },
        { id: "ex-7", name: "Lat Pulldown", muscle_group: "Back", sub_muscle: null, equipment: "cable", primary_muscle: "BACK", primary_submuscle: "UPPER_BACK", movement_pattern: "PULL", exercise_type: "COMPOUND", difficulty: "BEGINNER", exercise_family: "pulldown" },
        { id: "ex-8", name: "Face Pull", muscle_group: "Shoulders", sub_muscle: null, equipment: "cable", primary_muscle: "SHOULDERS", primary_submuscle: "REAR_DELTOID", movement_pattern: "PULL", exercise_type: "ISOLATION", difficulty: "BEGINNER", exercise_family: "facepull" },
        { id: "ex-9", name: "Barbell Curl", muscle_group: "Biceps", sub_muscle: null, equipment: "barbell", primary_muscle: "BICEPS", primary_submuscle: "BICEPS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", difficulty: "BEGINNER", exercise_family: "curl" },
        { id: "ex-10", name: "Squat", muscle_group: "Quads", sub_muscle: null, equipment: "barbell", primary_muscle: "QUADS", primary_submuscle: "QUADS", movement_pattern: "SQUAT", exercise_type: "COMPOUND", difficulty: "INTERMEDIATE", exercise_family: "squat" },
        { id: "ex-11", name: "RDL", muscle_group: "Hamstrings", sub_muscle: null, equipment: "barbell", primary_muscle: "HAMSTRINGS", primary_submuscle: "HAMSTRINGS", movement_pattern: "HINGE", exercise_type: "COMPOUND", difficulty: "INTERMEDIATE", exercise_family: "rdl" },
        { id: "ex-12", name: "Lunge", muscle_group: "Quads", sub_muscle: null, equipment: "dumbbell", primary_muscle: "QUADS", primary_submuscle: "QUADS", movement_pattern: "LUNGE", exercise_type: "COMPOUND", difficulty: "BEGINNER", exercise_family: "lunge" },
        { id: "ex-13", name: "Leg Curl", muscle_group: "Hamstrings", sub_muscle: null, equipment: "machine", primary_muscle: "HAMSTRINGS", primary_submuscle: "HAMSTRINGS", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", difficulty: "BEGINNER", exercise_family: "curl" },
        { id: "ex-14", name: "Calf Raise", muscle_group: "Calves", sub_muscle: null, equipment: "machine", primary_muscle: "CALVES", primary_submuscle: "CALVES", movement_pattern: "ISOLATION", exercise_type: "ISOLATION", difficulty: "BEGINNER", exercise_family: "raise" }
      ] as ExerciseWithTaxonomy[]
    );

    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        AxionRoutineGeneratorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ExerciseLibraryService, useValue: mockExerciseLibrary },
        { provide: RoutineValidationService, useValue: mockValidation },
        { provide: RoutinesService, useValue: mockRoutinesService }
      ]
    }).compile();

    service = module.get(AxionRoutineGeneratorService);
  });

  describe("split selection", () => {
    it("returns 4-day BALANCED split as Upper Lower Upper Lower", () => {
      const split = getSplitTemplate(4, "BALANCED");
      expect(split.days).toHaveLength(4);
      expect(split.days[0]).toEqual(["UPPER"]);
      expect(split.days[1]).toEqual(["LOWER"]);
      expect(split.days[2]).toEqual(["UPPER"]);
      expect(split.days[3]).toEqual(["LOWER"]);
    });

    it("returns 4-day LOWER_BODY split with quad/glute-ham specialization", () => {
      const split = getSplitTemplate(4, "LOWER_BODY");
      expect(split.days).toHaveLength(4);
      expect(split.days[0]).toEqual(["LOWER_QUAD_FOCUS"]);
      expect(split.days[1]).toEqual(["UPPER"]);
      expect(split.days[2]).toEqual(["LOWER_GLUTE_HAM_FOCUS"]);
      expect(split.days[3]).toEqual(["UPPER"]);
    });

    it("returns 5-day BALANCED split as Push Pull Legs Upper Lower", () => {
      const split = getSplitTemplate(5, "BALANCED");
      expect(split.days).toHaveLength(5);
      expect(split.days[0]).toEqual(["PUSH"]);
      expect(split.days[1]).toEqual(["PULL"]);
      expect(split.days[2]).toEqual(["LEGS"]);
    });

    it("returns 6-day BALANCED split as PPL PPL", () => {
      const split = getSplitTemplate(6, "BALANCED");
      expect(split.days).toHaveLength(6);
      expect(split.days[0]).toEqual(["PUSH"]);
      expect(split.days[1]).toEqual(["PULL"]);
      expect(split.days[2]).toEqual(["LEGS"]);
      expect(split.days[3]).toEqual(["PUSH"]);
      expect(split.days[4]).toEqual(["PULL"]);
      expect(split.days[5]).toEqual(["LEGS"]);
    });
  });

  describe("volume distribution", () => {
    it("returns weekly targets for all submuscles", () => {
      const targets = getWeeklyTargetSets("HYPERTROPHY", "INTERMEDIATE", "BALANCED");
      expect(targets.QUADS).toBeGreaterThan(0);
      expect(targets.MID_CHEST).toBeGreaterThan(0);
    });

    it("LOWER_BODY priority increases lower muscle volume", () => {
      const balanced = getWeeklyTargetSets("HYPERTROPHY", "INTERMEDIATE", "BALANCED");
      const lower = getWeeklyTargetSets("HYPERTROPHY", "INTERMEDIATE", "LOWER_BODY");
      expect(lower.QUADS).toBeGreaterThanOrEqual(balanced.QUADS);
      expect(lower.BICEPS).toBeLessThanOrEqual(balanced.BICEPS);
    });
  });

  describe("slot generation", () => {
    it("CHEST_TRICEPS has 4 chest + 2 triceps slots", () => {
      const slots = getSlotTemplatesForDayType("CHEST_TRICEPS");
      const chestSlots = slots.filter((s) =>
        ["UPPER_CHEST", "MID_CHEST", "LOWER_CHEST"].includes(s.submuscle)
      );
      const tricepsSlots = slots.filter((s) => s.submuscle === "TRICEPS");
      expect(chestSlots.length).toBe(4);
      expect(tricepsSlots.length).toBe(2);
    });

    it("LOWER_QUAD_FOCUS has squat, leg press, BSS, leg ext, calves", () => {
      const slots = getSlotTemplatesForDayType("LOWER_QUAD_FOCUS");
      const patterns = slots.map((s) => s.movement_pattern);
      expect(patterns).toContain("SQUAT");
      expect(patterns).toContain("LUNGE");
      expect(patterns).toContain("ISOLATION");
    });
    it("PUSH day has max 4 chest-related slots, triceps max 2 exercises", () => {
      const slots = getSlotTemplatesForDayType("PUSH");
      const chestSlots = slots.filter((s) =>
        ["UPPER_CHEST", "MID_CHEST", "LOWER_CHEST"].includes(s.submuscle)
      );
      const tricepsSlots = slots.filter((s) => s.submuscle === "TRICEPS");
      expect(chestSlots.length).toBeLessThanOrEqual(4);
      expect(tricepsSlots.length).toBeGreaterThan(0);
      expect(tricepsSlots.every((s) => s.max_exercises <= 2)).toBe(true);
    });

    it("LEGS day has squat, hinge, unilateral slot", () => {
      const slots = getSlotTemplatesForDayType("LEGS");
      const patterns = slots.map((s) => s.movement_pattern);
      expect(patterns).toContain("SQUAT");
      expect(patterns).toContain("HINGE");
      expect(patterns).toContain("LUNGE");
    });
  });

  describe("scoring", () => {
    let preferred: ExerciseWithTaxonomy;
    let avoided: ExerciseWithTaxonomy;
    let neutral: ExerciseWithTaxonomy;

    beforeEach(() => {
      preferred = {
        id: "pref-1",
        name: "Bench",
        muscle_group: "Chest",
        sub_muscle: null,
        equipment: "barbell",
        primary_muscle: "CHEST",
        primary_submuscle: "MID_CHEST",
        movement_pattern: "PUSH",
        exercise_type: "COMPOUND",
        difficulty: "INTERMEDIATE",
        exercise_family: "bench"
      } as unknown as ExerciseWithTaxonomy;
      avoided = { ...preferred, id: "avoid-1" } as unknown as ExerciseWithTaxonomy;
      neutral = { ...preferred, id: "neutral-1" } as unknown as ExerciseWithTaxonomy;
    });

    it("returns -999 for avoided exercises", () => {
      const ctx = {
        equipment: ["barbell"],
        userLevel: "INTERMEDIATE" as const,
        avoidIds: new Set<string>(["avoid-1"]),
        preferIds: new Set<string>(),
        preferFamilies: new Set<string>(),
        recentlyUsedIds: new Set<string>()
      };
      const slot: SlotConstraint = {
        primary_submuscle: "MID_CHEST",
        movement_pattern: "PUSH",
        exercise_type: "COMPOUND"
      };
      expect(scoreExercise(avoided, slot, ctx)).toBe(-999);
    });

    it("boosts score for preferred exercises", () => {
      const ctx = {
        equipment: ["barbell"],
        userLevel: "INTERMEDIATE" as const,
        avoidIds: new Set<string>(),
        preferIds: new Set<string>(["pref-1"]),
        preferFamilies: new Set<string>(),
        recentlyUsedIds: new Set<string>()
      };
      const slot: SlotConstraint = {
        primary_submuscle: "MID_CHEST",
        movement_pattern: "PUSH",
        exercise_type: "COMPOUND"
      };
      const preferredScore = scoreExercise(preferred, slot, ctx);
      const neutralScore = scoreExercise(neutral, slot, ctx);
      expect(preferredScore).toBeGreaterThan(neutralScore);
    });

    it("selectBestExercise returns preferred when available", () => {
      const ctx = {
        equipment: ["barbell"],
        userLevel: "INTERMEDIATE" as const,
        avoidIds: new Set<string>(),
        preferIds: new Set<string>(["pref-1"]),
        preferFamilies: new Set<string>(),
        recentlyUsedIds: new Set<string>()
      };
      const slot: SlotConstraint = {
        primary_submuscle: "MID_CHEST",
        movement_pattern: "PUSH",
        exercise_type: "COMPOUND"
      };
      const result = selectBestExercise(
        [neutral, preferred],
        slot,
        ctx,
        new Set()
      );
      expect(result?.id).toBe("pref-1");
    });

    it("pattern redundancy guard blocks 3rd compound of same movement pattern", () => {
      const pushEx1 = { ...preferred, id: "push1", movement_pattern: "PUSH" as const } as unknown as ExerciseWithTaxonomy;
      const pushEx2 = { ...preferred, id: "push2", movement_pattern: "PUSH" as const } as unknown as ExerciseWithTaxonomy;
      const pushEx3 = { ...preferred, id: "push3", movement_pattern: "PUSH" as const } as unknown as ExerciseWithTaxonomy;
      const patternCounts = new Map<string, number>([["PUSH", 2]]);
      const ctx = {
        equipment: ["barbell"],
        userLevel: "INTERMEDIATE" as const,
        avoidIds: new Set<string>(),
        preferIds: new Set<string>(),
        preferFamilies: new Set<string>(),
        recentlyUsedIds: new Set<string>(),
        patternCounts: patternCounts as Map<import("@prisma/client").MovementPattern, number>
      };
      const slot: SlotConstraint = {
        primary_submuscle: "MID_CHEST",
        movement_pattern: "PUSH",
        exercise_type: "COMPOUND"
      };
      const score = scoreExercise(pushEx3, slot, ctx);
      expect(score).toBe(-999);
    });

    it("excludes avoided exercises (replacement learning affects future generation)", () => {
      const ctx = {
        equipment: ["barbell"],
        userLevel: "INTERMEDIATE" as const,
        avoidIds: new Set<string>(["avoid-1"]),
        preferIds: new Set<string>(),
        preferFamilies: new Set<string>(),
        recentlyUsedIds: new Set<string>()
      };
      const slot: SlotConstraint = {
        primary_submuscle: "MID_CHEST",
        movement_pattern: "PUSH",
        exercise_type: "COMPOUND"
      };
      const result = selectBestExercise(
        [avoided, neutral],
        slot,
        ctx,
        new Set()
      );
      expect(result?.id).toBe("neutral-1");
    });
  });

  describe("RIR 0 rule", () => {
    it("HYPERTROPHY isolation allows RIR 0 on last isolation; compound does not", () => {
      const hypIso = getLoadPreset("HYPERTROPHY", false);
      const hypCompound = getLoadPreset("HYPERTROPHY", true);
      expect(hypIso.allowRir0OnLastIsolation).toBe(true);
      expect(hypCompound.allowRir0OnLastIsolation).toBe(false);
    });

    it("STRENGTH and FAT_LOSS do not allow RIR 0 on isolations", () => {
      expect(getLoadPreset("STRENGTH", false).allowRir0OnLastIsolation).toBeUndefined();
      expect(getLoadPreset("FAT_LOSS", false).allowRir0OnLastIsolation).toBeUndefined();
    });
  });

  describe("generate", () => {
    it("returns draft with days and metadata", async () => {
      const result = await service.generate({
        goal: "HYPERTROPHY",
        level: "INTERMEDIATE",
        priority_area: "BALANCED",
        days_per_week: 4,
        session_duration_mode: "AUTO",
        session_minutes: 60,
        equipment_available: ["barbell", "dumbbell", "cable", "machine"]
      });

      expect(result.draft.name).toContain("AXION");
      expect(result.draft.days.length).toBeGreaterThan(0);
      expect(result.metadata.blockLengthWeeks).toBe(6);
      expect(result.metadata.split).toBeDefined();
    });
  });
});
