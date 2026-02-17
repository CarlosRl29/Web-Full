"use client";

import { useEffect, useState } from "react";
import {
  createEmptyRoutine,
  Exercise,
  RoutineDraft,
  RoutineEditor
} from "../../../components/RoutineEditor";
import { apiRequest } from "../../../lib/api";
import { useCoachAuth } from "../../../lib/useCoachAuth";

export default function CoachRoutinesPage() {
  const { token, loading } = useCoachAuth();
  const [routines, setRoutines] = useState<any[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [draft, setDraft] = useState<RoutineDraft>(createEmptyRoutine());
  const [message, setMessage] = useState("");

  const loadData = async (accessToken: string) => {
    const [routineData, exerciseData] = await Promise.all([
      apiRequest<any[]>("/routines", {}, accessToken),
      apiRequest<Exercise[]>("/exercises?limit=200", {}, accessToken)
    ]);
    setRoutines(routineData);
    setExercises(exerciseData);
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadData(token);
  }, [token]);

  const saveRoutine = async () => {
    if (!token) {
      return;
    }
    const payload = {
      name: draft.name,
      description: draft.description || undefined,
      days: [
        {
          day_label: draft.day_label,
          order_index: 0,
          groups: draft.groups.map((group, groupIndex) => ({
            type: group.type,
            order_index: groupIndex,
            rounds_total: group.rounds_total,
            rest_between_exercises_seconds: group.rest_between_exercises_seconds,
            rest_after_round_seconds: group.rest_after_round_seconds,
            rest_after_set_seconds:
              group.type === "SINGLE" ? group.rest_after_set_seconds : undefined,
            exercises: group.exercises.map((exercise) => ({
              exercise_id: exercise.exercise_id,
              order_in_group: exercise.order_in_group,
              target_sets_per_round: exercise.target_sets_per_round,
              rep_range_min: exercise.rep_range_min,
              rep_range_max: exercise.rep_range_max,
              notes: exercise.notes || undefined
            }))
          }))
        }
      ]
    };

    try {
      if (draft.id) {
        await apiRequest(`/routines/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        }, token);
        setMessage("Rutina actualizada.");
      } else {
        await apiRequest("/routines", {
          method: "POST",
          body: JSON.stringify(payload)
        }, token);
        setMessage("Rutina creada.");
      }
      await loadData(token);
      setDraft(createEmptyRoutine());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar rutina");
    }
  };

  const hydrateDraftFromRoutine = (routine: any) => {
    const day = routine.days?.[0];
    if (!day) {
      return;
    }
    setDraft({
      id: routine.id,
      name: routine.name,
      description: routine.description ?? "",
      day_label: day.day_label,
      groups: day.groups.map((group: any) => ({
        type: group.type,
        rounds_total: group.rounds_total,
        rest_between_exercises_seconds: group.rest_between_exercises_seconds,
        rest_after_round_seconds: group.rest_after_round_seconds,
        rest_after_set_seconds: group.rest_after_set_seconds ?? undefined,
        exercises: group.exercises.map((exercise: any) => ({
          exercise_id: exercise.exercise_id,
          order_in_group: exercise.order_in_group,
          target_sets_per_round: exercise.target_sets_per_round,
          rep_range_min: exercise.rep_range_min ?? 8,
          rep_range_max: exercise.rep_range_max ?? 12,
          notes: exercise.notes ?? ""
        }))
      }))
    });
  };

  if (loading) {
    return <p>Cargando...</p>;
  }

  return (
    <section>
      <h1>Coach • Rutinas</h1>
      {message ? <p>{message}</p> : null}
      <button onClick={() => setDraft(createEmptyRoutine())}>Nueva rutina</button>
      <ul>
        {routines.map((routine) => (
          <li key={routine.id} style={{ marginTop: 8 }}>
            <strong>{routine.name}</strong>{" "}
            <button onClick={() => hydrateDraftFromRoutine(routine)}>Editar</button>
          </li>
        ))}
      </ul>

      <RoutineEditor
        draft={draft}
        exercises={exercises}
        onChange={setDraft}
        onSave={() => void saveRoutine()}
      />
    </section>
  );
}
