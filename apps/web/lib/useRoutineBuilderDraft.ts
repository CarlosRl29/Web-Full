"use client";

import { useCallback, useMemo, useState } from "react";

export type BuilderDayKey = "L" | "M" | "X" | "J" | "V" | "S" | "D";

export type BuilderExercise = {
  id: string;
  name: string;
  muscle_group?: string | null;
  equipment?: string | null;
  instructions?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  submuscle?: string | null;
  type?: string | null;
};

export type RoutineBuilderItem = {
  instance_id: string;
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  weight?: number;
  rest_seconds: number;
  notes?: string;
};

export type RoutineBuilderDay = {
  key: BuilderDayKey;
  label: string;
  title: string;
  items: RoutineBuilderItem[];
};

export type RoutineBuilderDraft = {
  routine_id?: string;
  week_title: string;
  week_goal: "FUERZA" | "HIPERTROFIA" | "RESISTENCIA" | "MIXTO";
  active_day: BuilderDayKey;
  days: RoutineBuilderDay[];
};

const DAY_DEFS: Array<{ key: BuilderDayKey; label: string }> = [
  { key: "L", label: "L" },
  { key: "M", label: "M" },
  { key: "X", label: "X" },
  { key: "J", label: "J" },
  { key: "V", label: "V" },
  { key: "S", label: "S" },
  { key: "D", label: "D" }
];

function createEmptyDraft(): RoutineBuilderDraft {
  return {
    week_title: "",
    week_goal: "MIXTO",
    active_day: "L",
    days: DAY_DEFS.map((day) => ({
      key: day.key,
      label: day.label,
      title: `Día ${day.label}`,
      items: []
    }))
  };
}

function parseGoal(description?: string | null): RoutineBuilderDraft["week_goal"] {
  if (!description) {
    return "MIXTO";
  }
  const lower = description.toLowerCase();
  if (lower.includes("fuerza")) {
    return "FUERZA";
  }
  if (lower.includes("hipertrof")) {
    return "HIPERTROFIA";
  }
  if (lower.includes("resisten")) {
    return "RESISTENCIA";
  }
  return "MIXTO";
}

function toInstanceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useRoutineBuilderDraft() {
  const [draft, setDraft] = useState<RoutineBuilderDraft>(createEmptyDraft);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(JSON.stringify(createEmptyDraft()));

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draft) !== savedSnapshot,
    [draft, savedSnapshot]
  );

  const setWeekTitle = useCallback((value: string) => {
    setDraft((prev) => ({ ...prev, week_title: value }));
  }, []);

  const setWeekGoal = useCallback((value: RoutineBuilderDraft["week_goal"]) => {
    setDraft((prev) => ({ ...prev, week_goal: value }));
  }, []);

  const setActiveDay = useCallback((day: BuilderDayKey) => {
    setDraft((prev) => ({ ...prev, active_day: day }));
  }, []);

  const updateActiveDayTitle = useCallback((value: string) => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((day) =>
        day.key === prev.active_day ? { ...day, title: value } : day
      )
    }));
  }, []);

  const addExerciseToActiveDay = useCallback((exercise: BuilderExercise) => {
    const item: RoutineBuilderItem = {
      instance_id: toInstanceId(),
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      sets: 3,
      reps_min: 8,
      reps_max: 12,
      weight: undefined,
      rest_seconds: 90,
      notes: ""
    };
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((day) =>
        day.key === prev.active_day ? { ...day, items: [...day.items, item] } : day
      )
    }));
    return item;
  }, []);

  const removeItem = useCallback((instanceId: string) => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((day) =>
        day.key === prev.active_day
          ? { ...day, items: day.items.filter((item) => item.instance_id !== instanceId) }
          : day
      )
    }));
  }, []);

  const updateItem = useCallback(
    (instanceId: string, patch: Partial<RoutineBuilderItem>) => {
      setDraft((prev) => ({
        ...prev,
        days: prev.days.map((day) =>
          day.key === prev.active_day
            ? {
                ...day,
                items: day.items.map((item) =>
                  item.instance_id === instanceId ? { ...item, ...patch } : item
                )
              }
            : day
        )
      }));
    },
    []
  );

  const reorderActiveDayItems = useCallback((activeId: string, overId: string) => {
    if (!activeId || !overId || activeId === overId) {
      return;
    }
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((day) => {
        if (day.key !== prev.active_day) {
          return day;
        }
        const from = day.items.findIndex((item) => item.instance_id === activeId);
        const to = day.items.findIndex((item) => item.instance_id === overId);
        if (from < 0 || to < 0) {
          return day;
        }
        const next = [...day.items];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return { ...day, items: next };
      })
    }));
  }, []);

  const clearActiveDay = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((day) =>
        day.key === prev.active_day ? { ...day, items: [] } : day
      )
    }));
  }, []);

  const resetDraft = useCallback(() => {
    const next = createEmptyDraft();
    setDraft(next);
    setSavedSnapshot(JSON.stringify(next));
  }, []);

  const discardChanges = useCallback(() => {
    setDraft(JSON.parse(savedSnapshot) as RoutineBuilderDraft);
  }, [savedSnapshot]);

  const loadRoutine = useCallback((routine: any) => {
    const next = createEmptyDraft();
    next.routine_id = routine.id;
    next.week_title = routine.name ?? "";
    next.week_goal = parseGoal(routine.description);
    (routine.days ?? []).forEach((apiDay: any, idx: number) => {
      const target = next.days[idx];
      if (!target) {
        return;
      }
      target.title = apiDay.day_label ?? target.title;
      target.items = (apiDay.groups ?? []).flatMap((group: any) =>
        (group.exercises ?? []).map((exercise: any) => ({
          instance_id: toInstanceId(),
          exercise_id: exercise.exercise_id,
          exercise_name: exercise.exercise?.name ?? exercise.exercise_name ?? "Ejercicio",
          sets: exercise.target_sets_per_round ?? 3,
          reps_min: exercise.rep_range_min ?? 8,
          reps_max: exercise.rep_range_max ?? 12,
          weight: undefined,
          rest_seconds:
            group.rest_after_set_seconds ??
            group.rest_between_exercises_seconds ??
            group.rest_after_round_seconds ??
            90,
          notes: exercise.notes ?? ""
        }))
      );
    });
    setDraft(next);
    setSavedSnapshot(JSON.stringify(next));
  }, []);

  const markSaved = useCallback(() => {
    setSavedSnapshot(JSON.stringify(draft));
  }, [draft]);

  const activeDay = useMemo(
    () => draft.days.find((day) => day.key === draft.active_day) ?? draft.days[0],
    [draft]
  );

  return {
    draft,
    activeDay,
    hasUnsavedChanges,
    setWeekTitle,
    setWeekGoal,
    setActiveDay,
    updateActiveDayTitle,
    addExerciseToActiveDay,
    removeItem,
    updateItem,
    reorderActiveDayItems,
    clearActiveDay,
    resetDraft,
    discardChanges,
    loadRoutine,
    markSaved
  };
}
