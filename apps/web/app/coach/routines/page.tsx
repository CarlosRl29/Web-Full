"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createEmptyRoutine,
  Exercise,
  RoutineDraft,
  RoutineEditor
} from "../../../components/RoutineEditor";
import { apiRequest } from "../../../lib/api";
import { useCoachAuth } from "../../../lib/useCoachAuth";
import { AiPlanSuggestion, AiRecommendationResponse } from "@gym/shared";
import { useToast } from "../../../components/ToastProvider";
import { useUnsavedChanges } from "../../../components/UnsavedChangesProvider";

const ORDER_BY_TYPE: Record<"SINGLE" | "SUPERSET_2" | "SUPERSET_3", Array<"A1" | "A2" | "A3">> =
  {
    SINGLE: ["A1"],
    SUPERSET_2: ["A1", "A2"],
    SUPERSET_3: ["A1", "A2", "A3"]
  };

export default function CoachRoutinesPage() {
  const { token, loading } = useCoachAuth();
  const { showToast } = useToast();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [routines, setRoutines] = useState<any[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [draft, setDraft] = useState<RoutineDraft>(createEmptyRoutine());
  const [lastSavedDraft, setLastSavedDraft] = useState<RoutineDraft>(createEmptyRoutine());
  const [message, setMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<AiRecommendationResponse | null>(null);
  const [pendingApplied, setPendingApplied] = useState<Array<{ ai_log_id: string; applied_changes: Record<string, unknown> }>>([]);
  const [appliedTrace, setAppliedTrace] = useState<Array<{
    id: string;
    ai_log_id: string;
    created_at: string;
    routine_id: string;
    routine_day_id: string;
  }>>([]);

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

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(lastSavedDraft),
    [draft, lastSavedDraft]
  );

  useEffect(() => {
    setHasUnsavedChanges(isDirty);
    return () => setHasUnsavedChanges(false);
  }, [isDirty, setHasUnsavedChanges]);

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

  const fetchAppliedTrace = async (accessToken: string, routineId?: string, dayId?: string) => {
    if (!routineId || !dayId) {
      setAppliedTrace([]);
      return;
    }
    const params = new URLSearchParams({
      routine_id: routineId,
      day_id: dayId
    });
    const rows = await apiRequest<any[]>(`/ai/applied?${params.toString()}`, {}, accessToken);
    setAppliedTrace(
      rows.map((row) => ({
        id: row.id,
        ai_log_id: row.ai_log_id,
        created_at: row.created_at,
        routine_id: row.routine_id,
        routine_day_id: row.routine_day_id
      }))
    );
  };

  const persistAppliedChange = async (
    accessToken: string,
    aiLogId: string,
    routineId: string,
    routineDayId: string,
    appliedChanges: Record<string, unknown>
  ) => {
    await apiRequest(
      "/ai/applied",
      {
        method: "POST",
        body: JSON.stringify({
          ai_log_id: aiLogId,
          routine_id: routineId,
          routine_day_id: routineDayId,
          applied_changes: appliedChanges
        })
      },
      accessToken
    );
  };

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
      let savedRoutine: any;
      if (draft.id) {
        savedRoutine = await apiRequest(`/routines/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        }, token);
        setMessage("Rutina actualizada.");
        showToast("success", "Rutina guardada.");
      } else {
        savedRoutine = await apiRequest("/routines", {
          method: "POST",
          body: JSON.stringify(payload)
        }, token);
        setMessage("Rutina creada.");
        showToast("success", "Rutina creada.");
      }
      await loadData(token);
      hydrateDraftFromRoutine(savedRoutine);

      if (pendingApplied.length > 0) {
        const dayId = savedRoutine.days?.[0]?.id;
        if (savedRoutine.id && dayId) {
          for (const pending of pendingApplied) {
            await persistAppliedChange(
              token,
              pending.ai_log_id,
              savedRoutine.id,
              dayId,
              pending.applied_changes
            );
          }
          setPendingApplied([]);
          await fetchAppliedTrace(token, savedRoutine.id, dayId);
        }
      } else {
        await fetchAppliedTrace(token, savedRoutine.id, savedRoutine.days?.[0]?.id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar rutina");
      showToast("error", "No se pudo guardar la rutina.");
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
      showToast("error", "No se pudieron generar sugerencias AI.");
    } finally {
      setAiLoading(false);
    }
  };

  const nextExerciseId = (currentId: string): string | null => {
    if (exercises.length === 0) {
      return null;
    }
    const idx = exercises.findIndex((item) => item.id === currentId);
    if (idx < 0) {
      return null;
    }
    return exercises[(idx + 1) % exercises.length].id;
  };

  const validateApplySuggestion = (suggestion: AiPlanSuggestion): string | null => {
    const existingExerciseIds = new Set(exercises.map((item) => item.id));
    for (const group of draft.groups) {
      const allowedOrders = ORDER_BY_TYPE[group.type];
      if (
        group.exercises.length !== allowedOrders.length ||
        group.exercises.some((exercise) => !allowedOrders.includes(exercise.order_in_group))
      ) {
        return `Estructura invalida del grupo ${group.type}.`;
      }
    }

    if (suggestion.swap_strategy === "NEXT_AVAILABLE") {
      if (!suggestion.swap_order_in_group) {
        return "Sugerencia invalida: falta slot de swap.";
      }
      if (existingExerciseIds.size === 0) {
        return "No hay ejercicios disponibles para aplicar swap.";
      }
      for (const group of draft.groups) {
        if (suggestion.apply_scope === "SINGLE_GROUPS" && group.type !== "SINGLE") {
          continue;
        }
        const allowedOrders = ORDER_BY_TYPE[group.type];
        if (!allowedOrders.includes(suggestion.swap_order_in_group)) {
          return `El slot ${suggestion.swap_order_in_group} no aplica para ${group.type}.`;
        }
        const target = group.exercises.find(
          (exercise) => exercise.order_in_group === suggestion.swap_order_in_group
        );
        if (!target || !existingExerciseIds.has(target.exercise_id)) {
          return "No se puede hacer swap: ejercicio objetivo invalido o inexistente.";
        }
      }
    }

    for (const group of draft.groups) {
      if (suggestion.apply_scope === "SINGLE_GROUPS" && group.type !== "SINGLE") {
        continue;
      }
      for (const exercise of group.exercises) {
        const nextMin = Math.max(1, exercise.rep_range_min + suggestion.rep_min_delta);
        const nextMax = exercise.rep_range_max + suggestion.rep_max_delta;
        if (nextMax < nextMin) {
          return "Rango de repeticiones invalido: max debe ser mayor o igual a min.";
        }
      }
    }

    return null;
  };

  const applySuggestion = (suggestion: AiPlanSuggestion) => {
    const validationError = validateApplySuggestion(suggestion);
    if (validationError) {
      setMessage(validationError);
      showToast("error", validationError);
      return;
    }

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
          const swappedExerciseId = nextExerciseId(exercise.exercise_id);
          if (!swappedExerciseId) {
            return updated;
          }
          updated = {
            ...updated,
            exercise_id: swappedExerciseId
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
    const appliedChange = {
      suggestion_id: suggestion.id,
      title: suggestion.title,
      set_delta: suggestion.set_delta,
      rep_min_delta: suggestion.rep_min_delta,
      rep_max_delta: suggestion.rep_max_delta,
      rest_after_set_seconds: suggestion.rest_after_set_seconds ?? null,
      rest_between_exercises_seconds: suggestion.rest_between_exercises_seconds ?? null,
      swap_order_in_group: suggestion.swap_order_in_group ?? null,
      swap_strategy: suggestion.swap_strategy
    } as Record<string, unknown>;

    if (token && aiData?.ai_log_id && draft.id && draft.day_id) {
      const aiLogId = aiData.ai_log_id;
      const routineId = draft.id;
      const routineDayId = draft.day_id;
      void (async () => {
        try {
          await persistAppliedChange(token, aiLogId, routineId, routineDayId, appliedChange);
          await fetchAppliedTrace(token, routineId, routineDayId);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "No se pudo registrar AI aplicada");
          showToast("error", "No se pudo registrar la sugerencia aplicada.");
        }
      })();
    } else if (aiData?.ai_log_id) {
      setPendingApplied((prev) => [
        ...prev,
        { ai_log_id: aiData.ai_log_id, applied_changes: appliedChange }
      ]);
    }

    setMessage(`Sugerencia aplicada: ${suggestion.title}. Revisa y guarda cuando quieras.`);
    showToast("info", "Sugerencia aplicada al borrador.");
  };

  const hydrateDraftFromRoutine = (routine: any) => {
    const day = routine.days?.[0];
    if (!day) {
      return;
    }
    const nextDraft: RoutineDraft = {
      id: routine.id,
      day_id: day.id,
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
    };
    setDraft(nextDraft);
    setLastSavedDraft(nextDraft);
    if (token) {
      void fetchAppliedTrace(token, routine.id, day.id);
    }
  };

  if (loading) {
    return <p>Cargando...</p>;
  }

  return (
    <section className="axion-page">
      <section className="axion-hero">
        <h1>Rutinas AXION</h1>
        <p>Gestiona estructuras de entrenamiento y aplica sugerencias AI con trazabilidad completa.</p>
        <div className="axion-actions" style={{ marginTop: 14 }}>
          <button
            className="axion-button axion-button-primary"
            onClick={() => {
              const empty = createEmptyRoutine();
              setDraft(empty);
              setLastSavedDraft(empty);
              setMessage("");
            }}
          >
            Nueva rutina
          </button>
        </div>
      </section>
      {message ? <p className="axion-muted">{message}</p> : null}
      <section className="axion-card">
      {routines.length === 0 ? (
        <div className="axion-empty">
          <strong>Sin rutinas por ahora</strong>
          <p>Crea tu primera rutina para comenzar a trabajar con recomendaciones AI.</p>
          <div style={{ marginTop: 16 }}>
            <button
              className="axion-button axion-button-primary"
              onClick={() => {
                const empty = createEmptyRoutine();
                setDraft(empty);
                setLastSavedDraft(empty);
              }}
            >
              Crear rutina
            </button>
          </div>
        </div>
      ) : (
        <ul className="axion-list">
          {routines.map((routine) => (
            <li key={routine.id} className="axion-list-item">
              <strong>{routine.name}</strong>
              <div>
                <button className="axion-button axion-button-secondary" onClick={() => hydrateDraftFromRoutine(routine)}>
                  Editar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      </section>

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
              setMessage("Cambios descartados.");
              showToast("info", "Cambios descartados.");
            }}
          >
            Descartar cambios
          </button>
        </div>
      </section>

      <RoutineEditor
        draft={draft}
        exercises={exercises}
        onChange={setDraft}
        onSave={() => void saveRoutine()}
      />
      {appliedTrace.length > 0 ? (
        <section className="axion-card" style={{ marginTop: 10 }}>
          <strong>AI aplicada</strong>
          {appliedTrace.slice(0, 3).map((item) => (
            <p key={item.id} style={{ margin: "6px 0" }}>
              {new Date(item.created_at).toLocaleString()} •{" "}
              <a href={`/coach/ai-logs?log_id=${item.ai_log_id}`}>ver log</a>
            </p>
          ))}
        </section>
      ) : null}

      <section className="axion-card" style={{ marginTop: 20 }}>
        <h2>AI Sugerencias</h2>
        <button className="axion-button axion-button-primary" onClick={() => void generateSuggestions()} disabled={aiLoading}>
          {aiLoading ? "Generando..." : "Generar sugerencias"}
        </button>
        {aiData ? (
          <div style={{ marginTop: 12 }}>
            {aiData.safety_flags.length > 0 ? (
              <p style={{ color: "#b45309", fontWeight: 700 }}>
                Safety flags: {aiData.safety_flags.join(", ")}
              </p>
            ) : null}
            {aiData.dedup_hit ? (
              <p style={{ color: "#065f46", fontWeight: 700 }}>Cacheado (dedup)</p>
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
                  className="axion-card"
                  style={{ padding: 12, marginBottom: 10, background: "rgba(255,255,255,0.02)" }}
                >
                  <h3 style={{ margin: 0 }}>{suggestion.title}</h3>
                  <p>{suggestion.description}</p>
                  <button className="axion-button axion-button-secondary" onClick={() => applySuggestion(suggestion)}>
                    Aplicar
                  </button>
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
