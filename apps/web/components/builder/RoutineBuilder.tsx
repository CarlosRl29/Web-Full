"use client";

import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../lib/api";
import {
  BuilderExercise,
  RoutineBuilderItem,
  useRoutineBuilderDraft
} from "../../lib/useRoutineBuilderDraft";
import { useToast } from "../ToastProvider";
import { useUnsavedChanges } from "../UnsavedChangesProvider";
import { ExerciseLibrary } from "./ExerciseLibrary";
import { MiniEditModal } from "./MiniEditModal";
import { RoutineDrawer } from "./RoutineDrawer";
import { RoutinePanel } from "./RoutinePanel";
import { TechniqueModal } from "./TechniqueModal";

type Props = {
  token: string;
  initialRoutineId?: string;
};

export function RoutineBuilder({ token, initialRoutineId }: Props) {
  const { showToast } = useToast();
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
  const [limit, setLimit] = useState(25);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [allExercises, setAllExercises] = useState<BuilderExercise[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [techniqueExercise, setTechniqueExercise] = useState<BuilderExercise | null>(null);
  const [editingItem, setEditingItem] = useState<RoutineBuilderItem | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<BuilderExercise | null>(null);

  const lastDropRef = useRef<{ id: string; at: number } | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchInput), 500);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const fetchExercises = useCallback(async () => {
    setLoadingExercises(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      params.set("limit", String(limit));
      const list = await apiRequest<BuilderExercise[]>(`/exercises?${params.toString()}`, {}, token);
      setAllExercises(list);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "No se pudieron cargar ejercicios");
    } finally {
      setLoadingExercises(false);
    }
  }, [debouncedSearch, limit, showToast, token]);

  useEffect(() => {
    void fetchExercises();
  }, [fetchExercises]);

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

  const filteredExercises = useMemo(() => {
    return allExercises.filter((exercise) => {
      const muscle = (exercise.muscle_group ?? "").toLowerCase();
      const submuscle = (exercise.submuscle ?? exercise.muscle_group ?? "").toLowerCase();
      const type = (exercise.type ?? exercise.equipment ?? "General").toLowerCase();
      if (filters.muscle && muscle !== filters.muscle.toLowerCase()) {
        return false;
      }
      if (filters.submuscle && submuscle !== filters.submuscle.toLowerCase()) {
        return false;
      }
      if (filters.type && type !== filters.type.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [allExercises, filters.muscle, filters.submuscle, filters.type]);

  const filterOptions = useMemo(() => {
    const muscles = new Set<string>();
    const submuscles = new Set<string>();
    const types = new Set<string>();
    allExercises.forEach((exercise) => {
      if (exercise.muscle_group) {
        muscles.add(exercise.muscle_group);
      }
      if (exercise.submuscle) {
        submuscles.add(exercise.submuscle);
      }
      const inferredType = exercise.type ?? exercise.equipment ?? "General";
      types.add(inferredType);
    });
    return {
      muscles: Array.from(muscles).sort((a, b) => a.localeCompare(b)),
      submuscles: Array.from(submuscles).sort((a, b) => a.localeCompare(b)),
      types: Array.from(types).sort((a, b) => a.localeCompare(b))
    };
  }, [allExercises]);

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

  return (
    <section className="axion-page">
      <section className="axion-hero">
        <h1>Creador de Rutinas</h1>
        <p>Construye tu semana arrastrando ejercicios y ajustando cada detalle de forma visual.</p>
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
              onClear={clearActiveDay}
              saving={saving}
            />
          </div>
        </section>
      </DndContext>

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
          onClear={clearActiveDay}
          saving={saving}
        />
      </RoutineDrawer>

      <TechniqueModal exercise={techniqueExercise} onClose={() => setTechniqueExercise(null)} />
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
