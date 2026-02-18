"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BuilderDayKey,
  RoutineBuilderDay,
  RoutineBuilderDraft,
  RoutineBuilderItem
} from "../../lib/useRoutineBuilderDraft";

type Props = {
  draft: RoutineBuilderDraft;
  activeDay: RoutineBuilderDay;
  onWeekTitleChange: (value: string) => void;
  onWeekGoalChange: (value: RoutineBuilderDraft["week_goal"]) => void;
  onDayChange: (day: BuilderDayKey) => void;
  onDayTitleChange: (value: string) => void;
  onEditItem: (item: RoutineBuilderItem) => void;
  onRemoveItem: (item: RoutineBuilderItem) => void;
  onSave: () => void;
  onClear: () => void;
  saving: boolean;
};

function SortableRoutineItem({
  item,
  onEditItem,
  onRemoveItem
}: {
  item: RoutineBuilderItem;
  onEditItem: (item: RoutineBuilderItem) => void;
  onRemoveItem: (item: RoutineBuilderItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `instance-${item.instance_id}`,
    data: { kind: "routine-item", item }
  });

  return (
    <article
      ref={setNodeRef}
      className="axion-card axion-builder-item"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1
      }}
    >
      <button
        type="button"
        className="axion-builder-item-main"
        onClick={() => onEditItem(item)}
        {...listeners}
        {...attributes}
      >
        <strong>{item.exercise_name}</strong>
        <p className="axion-muted">
          {item.sets} series • {item.reps_min}-{item.reps_max} reps • {item.rest_seconds}s
        </p>
      </button>
      <button className="axion-button axion-button-secondary" onClick={() => onRemoveItem(item)}>
        Quitar
      </button>
    </article>
  );
}

export function RoutinePanel({
  draft,
  activeDay,
  onWeekTitleChange,
  onWeekGoalChange,
  onDayChange,
  onDayTitleChange,
  onEditItem,
  onRemoveItem,
  onSave,
  onClear,
  saving
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: "routine-dropzone" });

  return (
    <section className="axion-card axion-builder-panel">
      <h2>Mi Rutina</h2>
      <input
        className="axion-input"
        placeholder="Título de semana"
        value={draft.week_title}
        onChange={(event) => onWeekTitleChange(event.target.value)}
        style={{ width: "100%", marginTop: 10 }}
      />
      <select
        className="axion-select"
        value={draft.week_goal}
        onChange={(event) => onWeekGoalChange(event.target.value as RoutineBuilderDraft["week_goal"])}
        style={{ width: "100%", marginTop: 8 }}
      >
        <option value="FUERZA">Fuerza</option>
        <option value="HIPERTROFIA">Hipertrofia</option>
        <option value="RESISTENCIA">Resistencia</option>
        <option value="MIXTO">Mixto</option>
      </select>

      <div className="axion-builder-day-tabs">
        {draft.days.map((day) => (
          <button
            key={day.key}
            type="button"
            className={`axion-button ${day.key === draft.active_day ? "axion-button-primary" : "axion-button-secondary"}`}
            onClick={() => onDayChange(day.key)}
          >
            {day.label}
          </button>
        ))}
      </div>

      <input
        className="axion-input"
        placeholder="Nombre del día"
        value={activeDay.title}
        onChange={(event) => onDayTitleChange(event.target.value)}
        style={{ width: "100%", marginTop: 8 }}
      />

      <div
        ref={setNodeRef}
        className={`axion-builder-dropzone${isOver ? " is-over" : ""}`}
      >
        <p className="axion-muted">
          Arrastra ejercicios aquí o usa el botón “+ Agregar”.
        </p>
        <SortableContext
          items={activeDay.items.map((item) => `instance-${item.instance_id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="axion-builder-scroll">
            {activeDay.items.map((item) => (
              <SortableRoutineItem
                key={item.instance_id}
                item={item}
                onEditItem={onEditItem}
                onRemoveItem={onRemoveItem}
              />
            ))}
            {activeDay.items.length === 0 ? (
              <div className="axion-empty" style={{ marginTop: 8 }}>
                <strong>Día vacío</strong>
                <p>Agrega ejercicios para construir tu sesión.</p>
              </div>
            ) : null}
          </div>
        </SortableContext>
      </div>

      <div className="axion-builder-actions">
        <button className="axion-button axion-button-primary" onClick={onSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button className="axion-button axion-button-secondary" onClick={onClear}>
          Limpiar
        </button>
        <button className="axion-button axion-button-secondary" disabled>
          Generar rutina (próximamente)
        </button>
      </div>
    </section>
  );
}
