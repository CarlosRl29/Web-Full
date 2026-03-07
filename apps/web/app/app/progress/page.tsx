"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip
} from "recharts";
import { apiRequest } from "../../../lib/api";
import { useAppAuth } from "../../../lib/useAppAuth";

type Overview = {
  sessionsCount: number;
  volumeTotal: number;
  adherence: number;
  windowDays: number;
};

type MusclesResponse = {
  effective: Record<string, number>;
  targets: Record<string, { min: number; max: number }>;
};

type Plan = {
  id: string;
  goal: string;
  priority_area: string;
  start_date: string;
  weeks_total: number;
  milestones?: Array<{ weekIndex?: number; focusText?: string }>;
};

const SUBMUSCLE_LABELS: Record<string, string> = {
  BICEPS: "Bíceps",
  TRICEPS: "Tríceps",
  MID_CHEST: "Pecho",
  LATS: "Espalda",
  QUADS: "Cuádriceps",
  HAMSTRINGS: "Isquiotibiales",
  GLUTES: "Glúteos",
  LATERAL_DELTOID: "Hombros",
  CALVES: "Gemelos",
  UPPER_CHEST: "Pecho sup",
  UPPER_BACK: "Espalda sup",
  REAR_DELTOID: "Deltoides post",
  ABS: "Core"
};

function getBarColor(
  value: number,
  targets?: { min: number; max: number }
): string {
  if (!targets) return "var(--accent-blue)";
  if (value >= targets.min && value <= targets.max) return "#22c55e";
  if (value < targets.min) return "#eab308";
  return "#ef4444";
}

export default function ProgressOverviewPage() {
  const { token, loading } = useAppAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [muscles, setMuscles] = useState<MusclesResponse | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiRequest<Overview>("/progress/overview?days=28", {}, token),
      apiRequest<MusclesResponse | Record<string, number>>("/progress/muscles?days=28&includeTargets=1", {}, token),
      apiRequest<Plan | null>("/plans/current", {}, token).catch(() => null)
    ])
      .then(([ov, mus, pl]) => {
        setOverview(ov);
        const m = mus as MusclesResponse | Record<string, number>;
        setMuscles(
          m && "effective" in m
            ? (m as MusclesResponse)
            : { effective: m as Record<string, number>, targets: {} }
        );
        setPlan(pl);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"));
  }, [token]);

  if (loading) {
    return <p className="axion-loading">Cargando progreso...</p>;
  }

  const chartData =
    muscles?.effective && muscles?.targets
      ? Object.entries(muscles.effective)
          .filter(([, v]) => v > 0)
          .map(([sub, val]) => ({
            name: SUBMUSCLE_LABELS[sub] ?? sub.replace(/_/g, " "),
            value: Math.round(val * 10) / 10,
            targets: muscles.targets[sub]
          }))
          .sort((a, b) => b.value - a.value)
      : [];

  const currentWeek = plan
    ? Math.floor(
        (Date.now() - new Date(plan.start_date).getTime()) / (7 * 24 * 60 * 60 * 1000)
      ) + 1
    : 0;

  return (
    <>
      <section className="axion-hero">
        <h1>Progreso</h1>
        <p>Resumen de volumen efectivo, adherencia y plan de entrenamiento.</p>
      </section>

      {error && (
        <div className="axion-card" style={{ borderColor: "var(--accent-red)" }}>
          <p>{error}</p>
        </div>
      )}

      {plan && (
        <section className="axion-card">
          <h2>Plan actual</h2>
          <div className="progress-plan-summary">
            <div>
              <strong>{plan.goal}</strong> · {plan.priority_area}
            </div>
            <div className="progress-week-badge">
              Semana {Math.min(currentWeek, plan.weeks_total)} / {plan.weeks_total}
            </div>
          </div>
          <Link className="axion-button axion-button-secondary" href="/app/progress/plan">
            Ver plan completo
          </Link>
        </section>
      )}

      <section className="axion-card">
        <h2>Adherencia</h2>
        {overview ? (
          <div className="progress-adherence">
            <div
              className="progress-adherence-bar"
              style={{ width: `${overview.adherence * 100}%` }}
            />
            <span className="progress-adherence-text">
              {(overview.adherence * 100).toFixed(0)}% · {overview.sessionsCount} sesiones ·{" "}
              {overview.volumeTotal.toLocaleString()} kg volumen ({overview.windowDays} días)
            </span>
          </div>
        ) : (
          <p className="axion-muted">Sin datos recientes</p>
        )}
      </section>

      <section className="axion-card">
        <h2>Volumen efectivo por músculo</h2>
        <p className="axion-muted" style={{ marginBottom: 16 }}>
          Sets/semana. Verde = dentro del rango · Amarillo = bajo · Rojo = alto
        </p>
        {chartData.length > 0 ? (
          <div className="progress-chart-container">
            <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 36)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 80, bottom: 8 }}
              >
                <XAxis type="number" domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--card-border)",
                    borderRadius: 8
                  }}
                  formatter={(value, _name, item) => {
                    const payload = (item as { payload?: { targets?: { min: number; max: number } } })?.payload;
                    const targets = payload?.targets;
                    return [
                      `${value != null ? value : 0} sets`,
                      targets ? `Objetivo: ${targets.min}-${targets.max}` : ""
                    ];
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={getBarColor(entry.value, entry.targets)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="axion-empty">
            <p>Completa entrenamientos para ver el volumen efectivo por músculo.</p>
          </div>
        )}
      </section>
    </>
  );
}
