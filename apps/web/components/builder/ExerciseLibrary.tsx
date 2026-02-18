"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { BuilderExercise } from "../../lib/useRoutineBuilderDraft";

type Filters = {
  muscle: string;
  submuscle: string;
  type: string;
};

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Filters;
  filterOptions: {
    muscles: string[];
    submuscles: string[];
    types: string[];
  };
  onFilterChange: (patch: Partial<Filters>) => void;
  exercises: BuilderExercise[];
  totalCount: number;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpenTechnique: (exercise: BuilderExercise) => void;
  onAddTemplate: (exercise: BuilderExercise) => void;
};

function LibraryCard({
  exercise,
  onOpenTechnique,
  onAddTemplate
}: {
  exercise: BuilderExercise;
  onOpenTechnique: (exercise: BuilderExercise) => void;
  onAddTemplate: (exercise: BuilderExercise) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `template-${exercise.id}`,
    data: { kind: "template", exercise }
  });

  return (
    <article
      ref={setNodeRef}
      className="axion-card"
      style={{
        padding: 12,
        marginBottom: 8,
        opacity: isDragging ? 0.6 : 1,
        transform: CSS.Translate.toString(transform)
      }}
      {...listeners}
      {...attributes}
    >
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr auto", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          className="axion-builder-thumb"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onOpenTechnique(exercise)}
        >
          {exercise.image_url ? (
            <img src={exercise.image_url} alt={exercise.name} className="axion-builder-thumb-image" />
          ) : (
            <span>{exercise.name.slice(0, 2).toUpperCase()}</span>
          )}
        </button>
        <div>
          <strong>{exercise.name}</strong>
          <p className="axion-muted">
            {(exercise.instructions ?? exercise.muscle_group ?? "Sin descripción").slice(0, 70)}
          </p>
        </div>
        <button
          type="button"
          className="axion-button axion-button-secondary"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onAddTemplate(exercise)}
        >
          + Agregar
        </button>
      </div>
    </article>
  );
}

export function ExerciseLibrary({
  search,
  onSearchChange,
  filters,
  filterOptions,
  onFilterChange,
  exercises,
  totalCount,
  loading,
  hasMore,
  onLoadMore,
  onOpenTechnique,
  onAddTemplate
}: Props) {
  return (
    <section className="axion-card axion-builder-column">
      <h2>Biblioteca de ejercicios</h2>
      <input
        className="axion-input"
        placeholder="Buscar ejercicio..."
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        style={{ marginTop: 10, width: "100%" }}
      />
      <div className="axion-builder-filters">
        <select
          className="axion-select"
          value={filters.muscle}
          onChange={(event) => onFilterChange({ muscle: event.target.value })}
        >
          <option value="">Músculo (todos)</option>
          {filterOptions.muscles.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          className="axion-select"
          value={filters.submuscle}
          onChange={(event) => onFilterChange({ submuscle: event.target.value })}
        >
          <option value="">Submúsculo (todos)</option>
          {filterOptions.submuscles.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          className="axion-select"
          value={filters.type}
          onChange={(event) => onFilterChange({ type: event.target.value })}
        >
          <option value="">Tipo (todos)</option>
          {filterOptions.types.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <p className="axion-muted" style={{ marginTop: 10 }}>
        {totalCount} ejercicios encontrados
      </p>

      <div
        className="axion-builder-scroll"
        onScroll={(event) => {
          const target = event.currentTarget;
          if (loading || !hasMore) {
            return;
          }
          const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 64;
          if (nearBottom) {
            onLoadMore();
          }
        }}
      >
        {exercises.map((exercise) => (
          <LibraryCard
            key={exercise.id}
            exercise={exercise}
            onOpenTechnique={onOpenTechnique}
            onAddTemplate={onAddTemplate}
          />
        ))}
        {loading ? <p className="axion-muted">Cargando ejercicios...</p> : null}
        {!loading && exercises.length === 0 ? (
          <div className="axion-empty">
            <strong>No hay resultados</strong>
            <p>Prueba otro término o ajusta los filtros.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
