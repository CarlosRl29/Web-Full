"use client";

import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiPlanSuggestion, AiRecommendationResponse, SUBMUSCLE_TO_MUSCLE } from "@gym/shared";
import { apiRequest } from "../../lib/api";
import {
  BuilderExercise,
  RoutineBuilderItem,
  useRoutineBuilderDraft
} from "../../lib/useRoutineBuilderDraft";
import { useToast } from "../ToastProvider";
import { useUnsavedChanges } from "../UnsavedChangesProvider";
import { useLanguage } from "../LanguageProvider";
import { ExerciseLibrary } from "./ExerciseLibrary";
import { GenerateRoutineModal } from "./GenerateRoutineModal";
import { MiniEditModal } from "./MiniEditModal";
import { RoutineDrawer } from "./RoutineDrawer";
import { RoutinePanel } from "./RoutinePanel";
import { TechniqueModal } from "./TechniqueModal";
import {
  type BuilderProfile,
  mapMeToBuilderProfile,
  builderProfileToDefaultProfile
} from "../../lib/builderProfile";

type Props = {
  token: string;
  initialRoutineId?: string;
};

export function RoutineBuilder({ token, initialRoutineId }: Props) {
  const { showToast } = useToast();
  const { locale } = useLanguage();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const {
    draft,
    activeDay,
    hasUnsavedChanges: internalDirty,
    setWeekTitle,
    setWeekGoal,
    setActiveDay,
    updateActiveDayTitle,
    addExerciseToActiveDay,
    removeItem,
    updateItem,
    reorderActiveDayItems,
    clearActiveDay,
    discardChanges,
    loadRoutine,
    markSaved
  } = useRoutineBuilderDraft();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } })
  );

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState({ muscle: "", submuscle: "", type: "" });
  const [limit, setLimit] = useState(100);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [allExercises, setAllExercises] = useState<BuilderExercise[]>([]);
  const [filterOptions, setFilterOptions] = useState<{
    muscles: Array<{ value: string; label: string }>;
    submuscles: Array<{ value: string; label: string }>;
    types: Array<{ value: string; label: string }>;
  }>({ muscles: [], submuscles: [], types: [] });
  const [showDrawer, setShowDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<AiRecommendationResponse | null>(null);
  const [techniqueExercise, setTechniqueExercise] = useState<BuilderExercise | null>(null);
  const [editingItem, setEditingItem] = useState<RoutineBuilderItem | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<BuilderExercise | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [userProfile, setUserProfile] = useState<BuilderProfile | null>(null);

  const lastDropRef = useRef<{ id: string; at: number } | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchInput), 500);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const hasSearchCriteria = Boolean(
    debouncedSearch.trim() || filters.muscle || filters.submuscle || filters.type
  );

  const fetchExercises = useCallback(async () => {
    if (!hasSearchCriteria) {
      setAllExercises([]);
      setLoadingExercises(false);
      return;
    }
    setLoadingExercises(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      params.set("limit", String(limit));
      if (filters.muscle) params.set("muscle", filters.muscle);
      if (filters.submuscle && (!filters.muscle || SUBMUSCLE_TO_MUSCLE[filters.submuscle] === filters.muscle)) {
        params.set("submuscle", filters.submuscle);
      }
      if (filters.type) params.set("equipment", filters.type);
      params.set("locale", locale);
      const list = await apiRequest<BuilderExercise[]>(`/exercises?${params.toString()}`, {}, token);
      setAllExercises(list);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "No se pudieron cargar ejercicios");
    } finally {
      setLoadingExercises(false);
    }
  }, [hasSearchCriteria, debouncedSearch, limit, filters.muscle, filters.submuscle, filters.type, locale, showToast, token]);

  useEffect(() => {
    void fetchExercises();
  }, [fetchExercises]);

  useEffect(() => {
    void apiRequest<{
      muscles: Array<{ value: string; label: string }>;
      submuscles: Array<{ value: string; label: string }>;
      types: Array<{ value: string; label: string }>;
    }>("/exercises/filter-options", {}, token)
      .then(setFilterOptions)
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    void apiRequest<unknown>("/auth/me", {}, token)
      .then((me) => setUserProfile(mapMeToBuilderProfile(me)))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!initialRoutineId) {
      return;
    }
    void apiRequest<any>(`/routines/${initialRoutineId}`, {}, token)
      .then((routine) => loadRoutine(routine))
      .catch((error) => {
        showToast(
          "error",
          error instanceof Error ? error.message : "No se pudo cargar la rutina"
        );
      });
  }, [initialRoutineId, loadRoutine, showToast, token]);

  useEffect(() => {
    setHasUnsavedChanges(internalDirty);
    return () => setHasUnsavedChanges(false);
  }, [internalDirty, setHasUnsavedChanges]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!internalDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [internalDirty]);

  const filteredExercises = allExercises;

  const addAndEdit = useCallback(
    (exercise: BuilderExercise) => {
      const created = addExerciseToActiveDay(exercise);
      setEditingItem(created);
    },
    [addExerciseToActiveDay]
  );

  const requestAddExercise = useCallback(
    (exercise: BuilderExercise) => {
      const duplicated = activeDay.items.some((item) => item.exercise_id === exercise.id);
      if (duplicated) {
        setPendingDuplicate(exercise);
        return;
      }
      addAndEdit(exercise);
    },
    [activeDay.items, addAndEdit]
  );

  const onDragEnd = (event: DragEndEvent) => {
    const activeData = event.active.data.current as { kind?: string; exercise?: BuilderExercise } | undefined;
    const overId = event.over?.id ? String(event.over.id) : "";

    if (activeData?.kind === "template" && activeData.exercise) {
      const now = Date.now();
      const templateId = event.active.id.toString();
      if (
        lastDropRef.current &&
        lastDropRef.current.id === templateId &&
        now - lastDropRef.current.at < 300
      ) {
        return;
      }
      lastDropRef.current = { id: templateId, at: now };

      if (overId === "routine-dropzone" || overId.startsWith("instance-")) {
        requestAddExercise(activeData.exercise);
      }
      return;
    }

    const activeId = String(event.active.id);
    if (activeId.startsWith("instance-") && overId.startsWith("instance-")) {
      reorderActiveDayItems(
        activeId.replace("instance-", ""),
        overId.replace("instance-", "")
      );
    }
  };

  const saveRoutine = async () => {
    if (!draft.week_title.trim()) {
      showToast("error", "Agrega un título de semana.");
      return;
    }

    const daysPayload = draft.days
      .map((day, dayIndex) => ({
        day_label: day.title || `Día ${day.label}`,
        order_index: dayIndex,
        groups: day.items.map((item, groupIndex) => ({
          type: "SINGLE" as const,
          order_index: groupIndex,
          rounds_total: 1,
          rest_between_exercises_seconds: item.rest_seconds,
          rest_after_round_seconds: item.rest_seconds,
          rest_after_set_seconds: item.rest_seconds,
          exercises: [
            {
              exercise_id: item.exercise_id,
              order_in_group: "A1" as const,
              target_sets_per_round: item.sets,
              rep_range_min: item.reps_min,
              rep_range_max: item.reps_max,
              notes: item.notes || undefined
            }
          ]
        }))
      }))
      .filter((day) => day.groups.length > 0);

    if (daysPayload.length === 0) {
      showToast("error", "Agrega ejercicios al menos en un día antes de guardar.");
      return;
    }

    const payload = {
      name: draft.week_title.trim(),
      description: `Objetivo semanal: ${draft.week_goal}`,
      days: daysPayload
    };

    setSaving(true);
    try {
      const saved = draft.routine_id
        ? await apiRequest<any>(
            `/routines/${draft.routine_id}`,
            { method: "PATCH", body: JSON.stringify(payload) },
            token
          )
        : await apiRequest<any>("/routines", { method: "POST", body: JSON.stringify(payload) }, token);
      loadRoutine(saved);
      markSaved();
      showToast("success", "Rutina guardada.");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const mapGoal = () => {
    if (draft.week_goal === "FUERZA") {
      return "STRENGTH" as const;
    }
    if (draft.week_goal === "HIPERTROFIA") {
      return "HYPERTROPHY" as const;
    }
    return "MIXED" as const;
  };

  const generateSuggestions = async () => {
    setAiLoading(true);
    try {
      const me = await apiRequest<unknown>("/auth/me", {}, token);
      const profile = mapMeToBuilderProfile(me);

      const response = await apiRequest<AiRecommendationResponse>(
        "/ai/recommendations",
        {
          method: "POST",
          body: JSON.stringify({
            profile: {
              experience_level: profile.experienceLevel ?? "INTERMEDIATE",
              goal: profile.goal ?? mapGoal(),
              days_per_week: profile.daysPerWeek ?? 4
            },
            constraints: {
              injuries: profile.injuries ?? undefined,
              equipment: profile.equipment.length > 0 ? profile.equipment : undefined,
              session_minutes: profile.sessionMinutes ?? undefined
            },
            context: { window_days: 28 }
          })
        },
        token
      );
      setAiData(response);
      showToast("success", "Sugerencias IA generadas.");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "No se pudieron generar sugerencias IA");
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = (suggestion: AiPlanSuggestion) => {
    activeDay.items.forEach((item) => {
      const nextRepsMin = Math.max(1, item.reps_min + suggestion.rep_min_delta);
      const nextRepsMax = Math.max(nextRepsMin, item.reps_max + suggestion.rep_max_delta);
      updateItem(item.instance_id, {
        sets: Math.max(1, item.sets + suggestion.set_delta),
        reps_min: nextRepsMin,
        reps_max: nextRepsMax,
        rest_seconds: suggestion.rest_after_set_seconds ?? item.rest_seconds
      });
    });
    showToast("info", `Sugerencia aplicada: ${suggestion.title}`);
  };

  return (
    <section className="axion-page">
      <section className="axion-hero">
        <h1>Creador de Rutinas</h1>
        <p>Construye tu semana arrastrando ejercicios y ajustando cada detalle de forma visual.</p>
        <button
          className="axion-button axion-button-primary"
          style={{ marginTop: 12 }}
          onClick={() => setShowGenerateModal(true)}
        >
          Generar rutina con IA
        </button>
      </section>

      <section className="axion-card" style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span className="axion-pill">
            {hasUnsavedChanges ? "Cambios sin guardar" : "Todo guardado"}
          </span>
          <button className="axion-button axion-button-secondary" onClick={discardChanges} disabled={!hasUnsavedChanges}>
            Descartar cambios
          </button>
        </div>
      </section>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <section className="axion-builder-grid">
          <ExerciseLibrary
            search={searchInput}
            onSearchChange={setSearchInput}
            filters={filters}
            filterOptions={filterOptions}
            onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            exercises={filteredExercises}
            totalCount={filteredExercises.length}
            loading={loadingExercises}
            hasMore={allExercises.length >= limit}
            onLoadMore={() => setLimit((prev) => prev + 25)}
            onOpenTechnique={setTechniqueExercise}
            onAddTemplate={requestAddExercise}
            hasSearchCriteria={hasSearchCriteria}
          />

          <div className="axion-builder-desktop-panel">
            <RoutinePanel
              draft={draft}
              activeDay={activeDay}
              onWeekTitleChange={setWeekTitle}
              onWeekGoalChange={setWeekGoal}
              onDayChange={setActiveDay}
              onDayTitleChange={updateActiveDayTitle}
              onEditItem={setEditingItem}
              onRemoveItem={(item) => removeItem(item.instance_id)}
              onSave={() => void saveRoutine()}
              onGenerateSuggestions={() => void generateSuggestions()}
              onClear={clearActiveDay}
              saving={saving}
              aiLoading={aiLoading}
            />
          </div>
        </section>
      </DndContext>

      {aiData ? (
        <section className="axion-card" style={{ marginTop: 14 }}>
          <h2>Sugerencias IA</h2>
          {aiData.safety_flags.length > 0 ? (
            <p className="axion-muted">Flags: {aiData.safety_flags.join(", ")}</p>
          ) : null}
          <p className="axion-muted" style={{ marginTop: 8 }}>{aiData.recommendation_summary}</p>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {aiData.plan_suggestions.map((suggestion) => (
              <article key={suggestion.id} className="axion-card" style={{ padding: 12, background: "rgba(255,255,255,0.02)" }}>
                <strong>{suggestion.title}</strong>
                <p className="axion-muted" style={{ marginTop: 6 }}>{suggestion.description}</p>
                <button className="axion-button axion-button-secondary" style={{ marginTop: 8 }} onClick={() => applySuggestion(suggestion)}>
                  Aplicar sugerencia
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <button className="axion-button axion-button-primary axion-builder-fab" onClick={() => setShowDrawer(true)}>
        Mi Rutina
      </button>

      <RoutineDrawer open={showDrawer} onClose={() => setShowDrawer(false)}>
        <RoutinePanel
          draft={draft}
          activeDay={activeDay}
          onWeekTitleChange={setWeekTitle}
          onWeekGoalChange={setWeekGoal}
          onDayChange={setActiveDay}
          onDayTitleChange={updateActiveDayTitle}
          onEditItem={setEditingItem}
          onRemoveItem={(item) => removeItem(item.instance_id)}
          onSave={() => void saveRoutine()}
          onGenerateSuggestions={() => void generateSuggestions()}
          onClear={clearActiveDay}
          saving={saving}
          aiLoading={aiLoading}
        />
      </RoutineDrawer>

      <TechniqueModal exercise={techniqueExercise} onClose={() => setTechniqueExercise(null)} />
      {showGenerateModal ? (
        <GenerateRoutineModal
          token={token}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={(routine) => {
            loadRoutine(routine);
            setShowGenerateModal(false);
            showToast("success", "Rutina generada. Revisa y guarda cuando estés listo.");
          }}
          defaultProfile={builderProfileToDefaultProfile(userProfile)}
        />
      ) : null}
      <MiniEditModal
        item={editingItem}
        onCancel={() => setEditingItem(null)}
        onSave={(patch) => {
          if (editingItem) {
            updateItem(editingItem.instance_id, patch);
          }
          setEditingItem(null);
        }}
      />

      {pendingDuplicate ? (
        <div className="axion-modal-overlay" onClick={() => setPendingDuplicate(null)}>
          <section
            className="axion-card axion-modal-card"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>¿Agregar duplicado?</h2>
            <p className="axion-muted" style={{ marginTop: 8 }}>
              Este ejercicio ya está en el día actual. ¿Quieres agregarlo de nuevo?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button className="axion-button axion-button-secondary" onClick={() => setPendingDuplicate(null)}>
                Cancelar
              </button>
              <button
                className="axion-button axion-button-primary"
                onClick={() => {
                  addAndEdit(pendingDuplicate);
                  setPendingDuplicate(null);
                }}
              >
                Agregar
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
