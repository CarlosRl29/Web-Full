"use client";

import { BuilderExercise } from "../../lib/useRoutineBuilderDraft";
import { useLanguage } from "../LanguageProvider";

type Props = {
  exercise: BuilderExercise | null;
  onClose: () => void;
};

export function TechniqueModal({ exercise, onClose }: Props) {
  const { t } = useLanguage();
  const displayName = exercise?.name ?? "";
  const displayInstructions = exercise?.instructions ?? "";

  if (!exercise) {
    return null;
  }

  return (
    <div className="axion-modal-overlay" onClick={onClose}>
      <section
        className="axion-card axion-modal-card axion-technique-layout"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="axion-technique-media">
          {exercise.image_url ? (
            <img src={exercise.image_url} alt={exercise.name} className="axion-technique-image" />
          ) : exercise.video_url ? (
            <video src={exercise.video_url} controls className="axion-technique-image" />
          ) : (
            <div className="axion-builder-media-placeholder">{t("technique.no_media")}</div>
          )}
        </div>
        <div className="axion-technique-content">
          <h2>{displayName}</h2>
          {(exercise.muscle_group || exercise.submuscle) ? (
            <p className="axion-muted" style={{ marginTop: 4, fontSize: "0.9rem" }}>
              {[exercise.muscle_group, exercise.submuscle].filter(Boolean).join(" • ")}
            </p>
          ) : null}
          <div className="axion-muted" style={{ marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.5, flex: 1 }}>
            {displayInstructions || t("technique.no_instructions")}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button className="axion-button axion-button-primary" onClick={onClose}>
              {t("technique.understood")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
