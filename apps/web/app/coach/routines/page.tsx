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
import { AiPlanSuggestion, AiRecommendationResponse } from "@gym/shared";

export default function CoachRoutinesPage() {
  const { token, loading } = useCoachAuth();
  const [routines, setRoutines] = useState<any[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [draft, setDraft] = useState<RoutineDraft>(createEmptyRoutine());
  const [message, setMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<AiRecommendationResponse | null>(null);

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

  const getGoal = (): "STRENGTH" | "HYPERTROPHY" | "MIXED" => {
    const text = `${draft.name} ${draft.description}`.toLowerCase();
    if (text.includes("fuerza") || text.includes("strength")) {
      return "STRENGTH";
    }
    if (text.includes("hipertrof") || text.includes("hypertrophy")) {
      return "HYPERTROPHY";
    }
    return "MIXED";
  };

  const generateSuggestions = async () => {
    if (!token) {
      return;
    }
    setAiLoading(true);
    setMessage("");
    try {
      const data = await apiRequest<AiRecommendationResponse>(
        "/ai/recommendations",
        {
          method: "POST",
          body: JSON.stringify({
            profile: {
              experience_level: "INTERMEDIATE",
              goal: getGoal(),
              days_per_week: 4
            },
            context: { window_days: 28 }
          })
        },
        token
      );
      setAiData(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar sugerencias");
    } finally {
      setAiLoading(false);
    }
  };

  const nextExerciseId = (currentId: string): string => {
    if (exercises.length === 0) {
      return currentId;
    }
    const idx = exercises.findIndex((item) => item.id === currentId);
    if (idx < 0) {
      return exercises[0].id;
    }
    return exercises[(idx + 1) % exercises.length].id;
  };

  const applySuggestion = (suggestion: AiPlanSuggestion) => {
    const nextGroups = draft.groups.map((group) => {
      if (suggestion.apply_scope === "SINGLE_GROUPS" && group.type !== "SINGLE") {
        return group;
      }

      const nextExercises = group.exercises.map((exercise) => {
        let updated = {
          ...exercise,
          target_sets_per_round: Math.max(1, exercise.target_sets_per_round + suggestion.set_delta),
          rep_range_min: Math.max(1, exercise.rep_range_min + suggestion.rep_min_delta),
          rep_range_max: Math.max(
            Math.max(1, exercise.rep_range_min + suggestion.rep_min_delta),
            exercise.rep_range_max + suggestion.rep_max_delta
          )
        };
        if (
          suggestion.swap_strategy === "NEXT_AVAILABLE" &&
          suggestion.swap_order_in_group &&
          exercise.order_in_group === suggestion.swap_order_in_group
        ) {
          updated = {
            ...updated,
            exercise_id: nextExerciseId(exercise.exercise_id)
          };
        }
        return updated;
      });

      return {
        ...group,
        rest_after_set_seconds:
          group.type === "SINGLE" && suggestion.rest_after_set_seconds != null
            ? suggestion.rest_after_set_seconds
            : group.rest_after_set_seconds,
        rest_between_exercises_seconds:
          suggestion.rest_between_exercises_seconds != null
            ? suggestion.rest_between_exercises_seconds
            : group.rest_between_exercises_seconds,
        exercises: nextExercises
      };
    });

    setDraft({
      ...draft,
      groups: nextGroups
    });
    setMessage(`Sugerencia aplicada: ${suggestion.title}. Revisa y guarda cuando quieras.`);
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

      <section style={{ marginTop: 20, border: "1px solid #ddd", padding: 16 }}>
        <h2>AI Sugerencias</h2>
        <button onClick={() => void generateSuggestions()} disabled={aiLoading}>
          {aiLoading ? "Generando..." : "Generar sugerencias"}
        </button>
        {aiData ? (
          <div style={{ marginTop: 12 }}>
            {aiData.safety_flags.length > 0 ? (
              <p style={{ color: "#b45309", fontWeight: 700 }}>
                Safety flags: {aiData.safety_flags.join(", ")}
              </p>
            ) : null}
            <p style={{ margin: "8px 0" }}>{aiData.recommendation_summary}</p>
            <ul>
              {aiData.rationale.map((item, idx) => (
                <li key={`${item}-${idx}`}>{item}</li>
              ))}
            </ul>
            <div style={{ marginTop: 10 }}>
              {aiData.plan_suggestions.map((suggestion) => (
                <article
                  key={suggestion.id}
                  style={{
                    border: "1px solid #eee",
                    padding: 12,
                    marginBottom: 10,
                    background: "#fafafa"
                  }}
                >
                  <h3 style={{ margin: 0 }}>{suggestion.title}</h3>
                  <p>{suggestion.description}</p>
                  <button onClick={() => applySuggestion(suggestion)}>Aplicar</button>
                </article>
              ))}
            </div>
            <small>
              model: {aiData.model_version} • strategy: {aiData.strategy_version}
            </small>
          </div>
        ) : null}
      </section>
    </section>
  );
}
