"use client";

import { useState } from "react";

type RoutineMeta = {
  id: string;
  name: string;
  is_public?: boolean;
  marketplace_title?: string | null;
  marketplace_goal?: string | null;
  marketplace_level?: string | null;
  marketplace_days_per_week?: number | null;
  marketplace_duration_weeks?: number | null;
  marketplace_description?: string | null;
  marketplace_tags?: string[] | string;
};

type Props = {
  routine: RoutineMeta;
  onClose: () => void;
  onPublish: (meta: {
    marketplace_title: string;
    marketplace_goal: string;
    marketplace_level: string;
    marketplace_days_per_week: number;
    marketplace_duration_weeks: number;
    marketplace_description: string;
    marketplace_tags: string;
  }) => Promise<void>;
};

function MissingChecklist({
  meta
}: {
  meta: {
    marketplace_goal: string;
    marketplace_level: string;
    marketplace_days_per_week: number;
    marketplace_duration_weeks: number;
    marketplace_description: string;
  };
}) {
  const checks = [
    {
      key: "objetivo",
      ok: Boolean(meta.marketplace_goal?.trim()),
      label: "Objetivo (ej. Hipertrofia, Fuerza)"
    },
    {
      key: "nivel",
      ok: Boolean(meta.marketplace_level?.trim()),
      label: "Nivel (ej. Principiante, Intermedio)"
    },
    {
      key: "días",
      ok:
        Number.isFinite(meta.marketplace_days_per_week) &&
        Number(meta.marketplace_days_per_week) > 0,
      label: "Días por semana"
    },
    {
      key: "duración",
      ok:
        Number.isFinite(meta.marketplace_duration_weeks) &&
        Number(meta.marketplace_duration_weeks) > 0,
      label: "Duración en semanas"
    },
    {
      key: "descripción",
      ok: Boolean(meta.marketplace_description?.trim()),
      label: "Descripción"
    }
  ];
  const missing = checks.filter((c) => !c.ok);
  if (missing.length === 0) return null;
  return (
    <div className="axion-card" style={{ padding: 12, background: "rgba(180,83,9,0.15)", marginBottom: 12 }}>
      <strong>Para publicar, completa:</strong>
      <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
        {missing.map((c) => (
          <li key={c.key}>{c.label}</li>
        ))}
      </ul>
    </div>
  );
}

export function PublishRoutineModal({ routine, onClose, onPublish }: Props) {
  const [meta, setMeta] = useState({
    marketplace_title: routine.marketplace_title ?? routine.name ?? "",
    marketplace_goal: routine.marketplace_goal ?? "Hipertrofia",
    marketplace_level: routine.marketplace_level ?? "Intermedio",
    marketplace_days_per_week: routine.marketplace_days_per_week ?? 4,
    marketplace_duration_weeks: routine.marketplace_duration_weeks ?? 8,
    marketplace_description: routine.marketplace_description ?? "",
    marketplace_tags: Array.isArray(routine.marketplace_tags)
      ? (routine.marketplace_tags as string[]).join(", ")
      : ""
  });
  const [submitting, setSubmitting] = useState(false);

  const requiredMissing =
    !meta.marketplace_goal.trim() ||
    !meta.marketplace_level.trim() ||
    !meta.marketplace_description.trim() ||
    !Number.isFinite(Number(meta.marketplace_days_per_week)) ||
    Number(meta.marketplace_days_per_week) <= 0 ||
    !Number.isFinite(Number(meta.marketplace_duration_weeks)) ||
    Number(meta.marketplace_duration_weeks) <= 0;

  const handleSubmit = async () => {
    if (requiredMissing) return;
    setSubmitting(true);
    try {
      await onPublish({
        ...meta,
        marketplace_days_per_week: Number(meta.marketplace_days_per_week),
        marketplace_duration_weeks: Number(meta.marketplace_duration_weeks)
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="axion-modal-overlay" role="dialog" aria-modal="true">
      <section className="axion-card axion-modal-card" style={{ maxWidth: 480 }}>
        <h2>Publicar rutina en marketplace</h2>
        <p className="axion-muted" style={{ marginTop: 8 }}>
          Completa la información para que los usuarios puedan descubrir esta rutina.
        </p>
        <MissingChecklist meta={meta} />
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <input
            className="axion-input"
            placeholder="Título público"
            value={meta.marketplace_title}
            onChange={(e) =>
              setMeta((prev) => ({ ...prev, marketplace_title: e.target.value }))
            }
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              className="axion-input"
              placeholder="Objetivo (ej. Hipertrofia)"
              value={meta.marketplace_goal}
              onChange={(e) =>
                setMeta((prev) => ({ ...prev, marketplace_goal: e.target.value }))
              }
            />
            <input
              className="axion-input"
              placeholder="Nivel (ej. Intermedio)"
              value={meta.marketplace_level}
              onChange={(e) =>
                setMeta((prev) => ({ ...prev, marketplace_level: e.target.value }))
              }
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              className="axion-input"
              type="number"
              placeholder="Días/semana"
              min={1}
              max={7}
              value={meta.marketplace_days_per_week}
              onChange={(e) =>
                setMeta((prev) => ({
                  ...prev,
                  marketplace_days_per_week: Number(e.target.value)
                }))
              }
            />
            <input
              className="axion-input"
              type="number"
              placeholder="Duración (semanas)"
              min={1}
              value={meta.marketplace_duration_weeks}
              onChange={(e) =>
                setMeta((prev) => ({
                  ...prev,
                  marketplace_duration_weeks: Number(e.target.value)
                }))
              }
            />
          </div>
          <textarea
            className="axion-input"
            placeholder="Descripción (requerida)"
            rows={3}
            value={meta.marketplace_description}
            onChange={(e) =>
              setMeta((prev) => ({ ...prev, marketplace_description: e.target.value }))
            }
          />
          <input
            className="axion-input"
            placeholder="Tags separadas por coma (opcional)"
            value={meta.marketplace_tags}
            onChange={(e) =>
              setMeta((prev) => ({ ...prev, marketplace_tags: e.target.value }))
            }
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="axion-button axion-button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="axion-button axion-button-primary"
            onClick={() => void handleSubmit()}
            disabled={submitting || requiredMissing}
          >
            {submitting ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </section>
    </div>
  );
}
