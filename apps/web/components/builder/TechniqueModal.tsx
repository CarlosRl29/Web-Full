"use client";

import { BuilderExercise } from "../../lib/useRoutineBuilderDraft";

type Props = {
  exercise: BuilderExercise | null;
  onClose: () => void;
};

export function TechniqueModal({ exercise, onClose }: Props) {
  if (!exercise) {
    return null;
  }

  return (
    <div className="axion-modal-overlay" onClick={onClose}>
      <section
        className="axion-card axion-modal-card"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{exercise.name}</h2>
        <div className="axion-builder-technique-media" style={{ marginTop: 10 }}>
          {exercise.image_url ? (
            <img src={exercise.image_url} alt={exercise.name} className="axion-builder-technique-image" />
          ) : exercise.video_url ? (
            <video src={exercise.video_url} controls className="axion-builder-technique-image" />
          ) : (
            <div className="axion-builder-media-placeholder">Sin media disponible</div>
          )}
        </div>
        <p className="axion-muted" style={{ marginTop: 10 }}>
          {exercise.instructions ?? "No hay técnica detallada para este ejercicio todavía."}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="axion-button axion-button-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </section>
    </div>
  );
}
