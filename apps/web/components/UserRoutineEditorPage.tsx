"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createEmptyRoutine,
  Exercise,
  RoutineDraft,
  RoutineEditor
} from "./RoutineEditor";
import { apiRequest } from "../lib/api";
import { useAppAuth } from "../lib/useAppAuth";
import { useToast } from "./ToastProvider";
import { useUnsavedChanges } from "./UnsavedChangesProvider";

type Props = {
  routineId?: string;
};

export function UserRoutineEditorPage({ routineId }: Props) {
  const { token, loading } = useAppAuth();
  const { showToast } = useToast();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [draft, setDraft] = useState<RoutineDraft>(createEmptyRoutine());
  const [lastSavedDraft, setLastSavedDraft] = useState<RoutineDraft>(createEmptyRoutine());
  const [message, setMessage] = useState("");

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(lastSavedDraft),
    [draft, lastSavedDraft]
  );

  useEffect(() => {
    setHasUnsavedChanges(isDirty);
    return () => setHasUnsavedChanges(false);
  }, [isDirty, setHasUnsavedChanges]);

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      const [exerciseData, existingRoutine] = await Promise.all([
        apiRequest<Exercise[]>("/exercises?limit=200", {}, token),
        routineId ? apiRequest<any>(`/routines/${routineId}`, {}, token) : Promise.resolve(null)
      ]);
      setExercises(exerciseData);
      if (existingRoutine?.id) {
        const day = existingRoutine.days?.[0];
        if (!day) {
          return;
        }
        const nextDraft: RoutineDraft = {
          id: existingRoutine.id,
          day_id: day.id,
          name: existingRoutine.name,
          description: existingRoutine.description ?? "",
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
        };
        setDraft(nextDraft);
        setLastSavedDraft(nextDraft);
      }
    })().catch((error) => {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar datos");
    });
  }, [token, routineId]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

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
      const savedRoutine = draft.id
        ? await apiRequest<any>(`/routines/${draft.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
          }, token)
        : await apiRequest<any>("/routines", {
            method: "POST",
            body: JSON.stringify(payload)
          }, token);
      const day = savedRoutine.days?.[0];
      const nextDraft: RoutineDraft = {
        id: savedRoutine.id,
        day_id: day?.id,
        name: savedRoutine.name,
        description: savedRoutine.description ?? "",
        day_label: day?.day_label ?? draft.day_label,
        groups: day
          ? day.groups.map((group: any) => ({
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
          : draft.groups
      };
      setDraft(nextDraft);
      setLastSavedDraft(nextDraft);
      setMessage("Rutina guardada.");
      showToast("success", "Rutina guardada.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "No se pudo guardar rutina";
      setMessage(text);
      showToast("error", text);
    }
  };

  if (loading) {
    return <p className="axion-loading">Cargando editor...</p>;
  }

  return (
    <section className="axion-page">
      <section className="axion-hero">
        <h1>{routineId ? "Editar rutina" : "Nueva rutina"}</h1>
        <p>Define grupos, ejercicios y descansos para tu plan semanal.</p>
      </section>
      {message ? <p className="axion-muted">{message}</p> : null}
      <section className="axion-card" style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span className="axion-pill">
            {hasUnsavedChanges ? "Cambios sin guardar" : "Todo guardado"}
          </span>
          <button
            className="axion-button axion-button-secondary"
            disabled={!hasUnsavedChanges}
            onClick={() => {
              setDraft(lastSavedDraft);
              showToast("info", "Cambios descartados.");
            }}
          >
            Descartar cambios
          </button>
        </div>
      </section>
      <RoutineEditor draft={draft} exercises={exercises} onChange={setDraft} onSave={() => void saveRoutine()} />
    </section>
  );
}
