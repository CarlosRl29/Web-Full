"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../../../lib/api";
import { useAppAuth } from "../../../../lib/useAppAuth";

type Milestone = {
  weekIndex?: number;
  focusText?: string;
  metricTargets?: Record<string, unknown>;
};

type Plan = {
  id: string;
  goal: string;
  priority_area: string;
  start_date: string;
  weeks_total: number;
  milestones?: Milestone[];
};

const GOAL_LABELS: Record<string, string> = {
  STRENGTH: "Fuerza",
  HYPERTROPHY: "Hipertrofia",
  FAT_LOSS: "Pérdida de grasa",
  ENDURANCE: "Resistencia"
};

const PRIORITY_LABELS: Record<string, string> = {
  BALANCED: "Equilibrado",
  UPPER_BODY: "Tren superior",
  LOWER_BODY: "Tren inferior"
};

export default function TrainingPlanPage() {
  const { token, loading } = useAppAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<Plan | null>("/plans/current", {}, token)
      .then(setPlan)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token]);

  if (loading) {
    return <p className="axion-loading">Cargando plan...</p>;
  }

  return (
    <section className="axion-page">
      <div style={{ marginBottom: 16 }}>
        <Link href="/app/progress" className="axion-muted" style={{ fontSize: 14 }}>
          ← Progreso
        </Link>
      </div>

      <section className="axion-hero">
        <h1>Plan de entrenamiento</h1>
        <p>Progreso y hitos de tu plan actual.</p>
      </section>

      {error && (
        <div className="axion-card" style={{ borderColor: "var(--accent-red)" }}>
          <p>{error}</p>
        </div>
      )}

      {!plan ? (
        <section className="axion-card">
          <div className="axion-empty">
            <strong>Sin plan activo</strong>
            <p>
              Inicia un plan de entrenamiento desde la app o con tu coach para ver
              el progreso y los hitos.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="axion-card">
            <h2>Plan actual</h2>
            <div className="progress-plan-meta">
              <div>
                <span className="axion-muted">Objetivo</span>
                <span>{GOAL_LABELS[plan.goal] ?? plan.goal}</span>
              </div>
              <div>
                <span className="axion-muted">Prioridad</span>
                <span>{PRIORITY_LABELS[plan.priority_area] ?? plan.priority_area}</span>
              </div>
              <div>
                <span className="axion-muted">Inicio</span>
                <span>{new Date(plan.start_date).toLocaleDateString("es")}</span>
              </div>
              <div>
                <span className="axion-muted">Duración</span>
                <span>{plan.weeks_total} semanas</span>
              </div>
            </div>
          </section>

          <section className="axion-card">
            <h2>Progreso semanal</h2>
            <div className="progress-week-progress">
              <div
                className="progress-week-fill"
                style={{
                  width: `${Math.min(
                    100,
                    (Math.floor(
                      (Date.now() - new Date(plan.start_date).getTime()) /
                        (7 * 24 * 60 * 60 * 1000)
                    ) /
                      plan.weeks_total) *
                      100
                  )}%`
                }}
              />
              <span>
                Semana{" "}
                {Math.min(
                  Math.floor(
                    (Date.now() - new Date(plan.start_date).getTime()) /
                      (7 * 24 * 60 * 60 * 1000)
                  ) + 1,
                  plan.weeks_total
                )}{" "}
                / {plan.weeks_total}
              </span>
            </div>
          </section>

          {plan.milestones && Array.isArray(plan.milestones) && plan.milestones.length > 0 && (
            <section className="axion-card">
              <h2>Hitos</h2>
              <ul className="progress-milestones">
                {plan.milestones
                  .sort((a, b) => (a.weekIndex ?? 0) - (b.weekIndex ?? 0))
                  .map((m, i) => (
                    <li key={i} className="progress-milestone-item">
                      <span className="progress-milestone-week">
                        Semana {m.weekIndex ?? i + 1}
                      </span>
                      <span>{m.focusText ?? "—"}</span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}
