"use client";

import { useEffect, useState } from "react";
import { RoutineBuilderItem } from "../../lib/useRoutineBuilderDraft";

type Props = {
  item: RoutineBuilderItem | null;
  onCancel: () => void;
  onSave: (patch: Partial<RoutineBuilderItem>) => void;
};

export function MiniEditModal({ item, onCancel, onSave }: Props) {
  const [sets, setSets] = useState(3);
  const [repsMin, setRepsMin] = useState(8);
  const [repsMax, setRepsMax] = useState(12);
  const [weight, setWeight] = useState<string>("");
  const [rest, setRest] = useState(90);

  useEffect(() => {
    if (!item) {
      return;
    }
    setSets(item.sets);
    setRepsMin(item.reps_min);
    setRepsMax(item.reps_max);
    setWeight(item.weight != null ? String(item.weight) : "");
    setRest(item.rest_seconds);
  }, [item]);

  if (!item) {
    return null;
  }

  return (
    <div className="axion-modal-overlay" onClick={onCancel}>
      <section
        className="axion-card axion-modal-card"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Editar ejercicio</h2>
        <p className="axion-muted" style={{ marginTop: 6 }}>
          {item.exercise_name}
        </p>
        <div className="axion-grid-2" style={{ marginTop: 12 }}>
          <label className="axion-muted">
            Series
            <input
              className="axion-input"
              type="number"
              min={1}
              value={sets}
              onChange={(e) => setSets(Number(e.target.value))}
            />
          </label>
          <label className="axion-muted">
            Descanso (seg)
            <input
              className="axion-input"
              type="number"
              min={0}
              value={rest}
              onChange={(e) => setRest(Number(e.target.value))}
            />
          </label>
          <label className="axion-muted">
            Reps min
            <input
              className="axion-input"
              type="number"
              min={1}
              value={repsMin}
              onChange={(e) => setRepsMin(Number(e.target.value))}
            />
          </label>
          <label className="axion-muted">
            Reps max
            <input
              className="axion-input"
              type="number"
              min={1}
              value={repsMax}
              onChange={(e) => setRepsMax(Number(e.target.value))}
            />
          </label>
          <label className="axion-muted">
            Peso (opcional)
            <input
              className="axion-input"
              type="number"
              min={0}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button className="axion-button axion-button-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="axion-button axion-button-primary"
            onClick={() =>
              onSave({
                sets: Math.max(1, sets),
                reps_min: Math.max(1, repsMin),
                reps_max: Math.max(Math.max(1, repsMin), repsMax),
                weight: weight ? Number(weight) : undefined,
                rest_seconds: Math.max(0, rest)
              })
            }
          >
            Guardar
          </button>
        </div>
      </section>
    </div>
  );
}
