"use client";

import { ExerciseGroupType } from "@gym/shared";

export type Exercise = {
  id: string;
  name: string;
};

export type RoutineExerciseDraft = {
  exercise_id: string;
  order_in_group: "A1" | "A2" | "A3";
  target_sets_per_round: number;
  rep_range_min: number;
  rep_range_max: number;
  notes: string;
};

export type RoutineGroupDraft = {
  type: "SINGLE" | "SUPERSET_2" | "SUPERSET_3";
  rounds_total: number;
  rest_between_exercises_seconds: number;
  rest_after_round_seconds: number;
  rest_after_set_seconds?: number;
  exercises: RoutineExerciseDraft[];
};

export type RoutineDraft = {
  id?: string;
  name: string;
  description: string;
  day_label: string;
  groups: RoutineGroupDraft[];
};

const ORDER_MAP: Record<RoutineGroupDraft["type"], Array<"A1" | "A2" | "A3">> = {
  SINGLE: ["A1"],
  SUPERSET_2: ["A1", "A2"],
  SUPERSET_3: ["A1", "A2", "A3"]
};

function emptyExercise(order: "A1" | "A2" | "A3"): RoutineExerciseDraft {
  return {
    exercise_id: "",
    order_in_group: order,
    target_sets_per_round: 3,
    rep_range_min: 8,
    rep_range_max: 12,
    notes: ""
  };
}

export function createEmptyGroup(type: RoutineGroupDraft["type"] = "SINGLE"): RoutineGroupDraft {
  return {
    type,
    rounds_total: 1,
    rest_between_exercises_seconds: 20,
    rest_after_round_seconds: 90,
    rest_after_set_seconds: type === "SINGLE" ? 60 : undefined,
    exercises: ORDER_MAP[type].map((order) => emptyExercise(order))
  };
}

export function createEmptyRoutine(): RoutineDraft {
  return {
    name: "",
    description: "",
    day_label: "Dia 1",
    groups: [createEmptyGroup("SINGLE")]
  };
}

type Props = {
  draft: RoutineDraft;
  exercises: Exercise[];
  onChange: (next: RoutineDraft) => void;
  onSave: () => void;
};

export function RoutineEditor({ draft, exercises, onChange, onSave }: Props) {
  return (
    <section style={{ marginTop: 20, border: "1px solid #ddd", padding: 16 }}>
      <h2>Editor de rutina</h2>
      <input
        value={draft.name}
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
        placeholder="Nombre rutina"
        style={{ width: "100%", padding: 8, marginBottom: 8 }}
      />
      <input
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
        placeholder="Descripcion"
        style={{ width: "100%", padding: 8, marginBottom: 8 }}
      />
      <input
        value={draft.day_label}
        onChange={(e) => onChange({ ...draft, day_label: e.target.value })}
        placeholder="Dia (ej. Lunes)"
        style={{ width: "100%", padding: 8, marginBottom: 12 }}
      />

      {draft.groups.map((group, groupIndex) => (
        <div
          key={`${group.type}-${groupIndex}`}
          style={{ border: "1px solid #eee", padding: 12, marginBottom: 12 }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={group.type}
              onChange={(e) => {
                const type = e.target.value as RoutineGroupDraft["type"];
                const nextGroups = [...draft.groups];
                const existing = nextGroups[groupIndex];
                const orders = ORDER_MAP[type];
                nextGroups[groupIndex] = {
                  ...existing,
                  type,
                  rest_after_set_seconds:
                    type === "SINGLE" ? existing.rest_after_set_seconds ?? 60 : undefined,
                  exercises: orders.map((order, idx) =>
                    existing.exercises[idx]
                      ? { ...existing.exercises[idx], order_in_group: order }
                      : emptyExercise(order)
                  )
                };
                onChange({ ...draft, groups: nextGroups });
              }}
            >
              <option value={ExerciseGroupType.SINGLE}>SINGLE</option>
              <option value={ExerciseGroupType.SUPERSET_2}>SUPERSET_2</option>
              <option value={ExerciseGroupType.SUPERSET_3}>SUPERSET_3</option>
            </select>
            <input
              type="number"
              value={group.rounds_total}
              onChange={(e) => {
                const next = [...draft.groups];
                next[groupIndex] = { ...next[groupIndex], rounds_total: Number(e.target.value) };
                onChange({ ...draft, groups: next });
              }}
              placeholder="Rondas"
            />
            <button
              onClick={() =>
                onChange({
                  ...draft,
                  groups: draft.groups.filter((_, idx) => idx !== groupIndex)
                })
              }
            >
              Eliminar grupo
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              type="number"
              value={group.rest_between_exercises_seconds}
              onChange={(e) => {
                const next = [...draft.groups];
                next[groupIndex] = {
                  ...next[groupIndex],
                  rest_between_exercises_seconds: Number(e.target.value)
                };
                onChange({ ...draft, groups: next });
              }}
              placeholder="Rest entre ejercicios"
            />
            <input
              type="number"
              value={group.rest_after_round_seconds}
              onChange={(e) => {
                const next = [...draft.groups];
                next[groupIndex] = {
                  ...next[groupIndex],
                  rest_after_round_seconds: Number(e.target.value)
                };
                onChange({ ...draft, groups: next });
              }}
              placeholder="Rest despues ronda"
            />
            {group.type === "SINGLE" ? (
              <input
                type="number"
                value={group.rest_after_set_seconds ?? 60}
                onChange={(e) => {
                  const next = [...draft.groups];
                  next[groupIndex] = {
                    ...next[groupIndex],
                    rest_after_set_seconds: Number(e.target.value)
                  };
                  onChange({ ...draft, groups: next });
                }}
                placeholder="Rest despues set"
              />
            ) : null}
          </div>

          {group.exercises.map((exercise, exerciseIndex) => (
            <div
              key={`${exercise.order_in_group}-${exerciseIndex}`}
              style={{ marginTop: 10, padding: 8, background: "#fafafa" }}
            >
              <strong>{exercise.order_in_group}</strong>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <select
                  value={exercise.exercise_id}
                  onChange={(e) => {
                    const next = [...draft.groups];
                    const nextExercises = [...next[groupIndex].exercises];
                    nextExercises[exerciseIndex] = {
                      ...nextExercises[exerciseIndex],
                      exercise_id: e.target.value
                    };
                    next[groupIndex] = { ...next[groupIndex], exercises: nextExercises };
                    onChange({ ...draft, groups: next });
                  }}
                >
                  <option value="">Seleccionar ejercicio</option>
                  {exercises.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={exercise.target_sets_per_round}
                  onChange={(e) => {
                    const next = [...draft.groups];
                    const nextExercises = [...next[groupIndex].exercises];
                    nextExercises[exerciseIndex] = {
                      ...nextExercises[exerciseIndex],
                      target_sets_per_round: Number(e.target.value)
                    };
                    next[groupIndex] = { ...next[groupIndex], exercises: nextExercises };
                    onChange({ ...draft, groups: next });
                  }}
                  placeholder="Sets"
                />
                <input
                  type="number"
                  value={exercise.rep_range_min}
                  onChange={(e) => {
                    const next = [...draft.groups];
                    const nextExercises = [...next[groupIndex].exercises];
                    nextExercises[exerciseIndex] = {
                      ...nextExercises[exerciseIndex],
                      rep_range_min: Number(e.target.value)
                    };
                    next[groupIndex] = { ...next[groupIndex], exercises: nextExercises };
                    onChange({ ...draft, groups: next });
                  }}
                  placeholder="Reps min"
                />
                <input
                  type="number"
                  value={exercise.rep_range_max}
                  onChange={(e) => {
                    const next = [...draft.groups];
                    const nextExercises = [...next[groupIndex].exercises];
                    nextExercises[exerciseIndex] = {
                      ...nextExercises[exerciseIndex],
                      rep_range_max: Number(e.target.value)
                    };
                    next[groupIndex] = { ...next[groupIndex], exercises: nextExercises };
                    onChange({ ...draft, groups: next });
                  }}
                  placeholder="Reps max"
                />
              </div>
            </div>
          ))}
        </div>
      ))}

      <button onClick={() => onChange({ ...draft, groups: [...draft.groups, createEmptyGroup("SINGLE")] })}>
        Agregar grupo
      </button>
      <button style={{ marginLeft: 8 }} onClick={onSave}>
        Guardar rutina
      </button>
    </section>
  );
}
