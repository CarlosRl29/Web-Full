"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid
} from "recharts";
import { apiRequest } from "../../../../../lib/api";
import { useAppAuth } from "../../../../../lib/useAppAuth";

type ExerciseTrend = {
  exerciseId: string;
  exerciseName: string;
  e1rmBest: number | null;
  e1rmTrend: number[];
  volumeTrend: number[];
  lastSessions: Array<{ weight: number; reps: number }>;
  lastPerformedAt: string | null;
  nextSuggestion?: { type: string; value?: number };
};

const SUGGESTION_LABELS: Record<string, string> = {
  ADD_REP: "Añade 1 rep por serie",
  INCREASE_LOAD: "Aumenta la carga",
  MAINTAIN: "Mantén carga y reps",
  DELOAD: "Reduce carga para recuperar"
};

export default function ExerciseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { token, loading } = useAppAuth();
  const [data, setData] = useState<ExerciseTrend | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    apiRequest<ExerciseTrend>(`/progress/exercise/${id}?limit=12`, {}, token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token, id]);

  if (loading) return <p className="axion-loading">Cargando ejercicio...</p>;

  if (error || !data) {
    return (
      <section className="axion-page">
        <div className="axion-card">
          <p>{error ?? "Ejercicio no encontrado"}</p>
          <button className="axion-button axion-button-secondary" onClick={() => router.back()} style={{ marginTop: 12 }}>
            Volver
          </button>
        </div>
      </section>
    );
  }

  const e1rmChartData = data.e1rmTrend.map((val, i) => ({ session: i + 1, e1rm: Math.round(val) }));
  const volumeChartData = data.volumeTrend.map((val, i) => ({ session: i + 1, volume: Math.round(val) }));

  return (
    <section className="axion-page">
      <div style={{ marginBottom: 16 }}>
        <Link href="/app/progress" className="axion-muted" style={{ fontSize: 14 }}>← Progreso</Link>
      </div>

      <section className="axion-hero">
        <h1>{data.exerciseName}</h1>
        {data.e1rmBest && <p className="axion-muted">Mejor e1RM: <strong>{Math.round(data.e1rmBest)} kg</strong></p>}
      </section>

      {data.nextSuggestion && (
        <section className="axion-card progress-suggestion">
          <h3>Próxima sesión</h3>
          <p>
            {SUGGESTION_LABELS[data.nextSuggestion.type] ?? data.nextSuggestion.type}
            {data.nextSuggestion.value != null && data.nextSuggestion.type === "INCREASE_LOAD" && ` (+${data.nextSuggestion.value} kg)`}
          </p>
        </section>
      )}

      {data.lastSessions.length > 0 && (
        <section className="axion-card">
          <h2>Última sesión (peso × reps)</h2>
          <div className="progress-sets-grid">
            {data.lastSessions.map((s, i) => (
              <span key={i} className="progress-set-badge">{s.weight} kg × {s.reps}</span>
            ))}
          </div>
        </section>
      )}

      {e1rmChartData.length > 0 && (
        <section className="axion-card">
          <h2>Tendencia e1RM</h2>
          <div className="progress-chart-container" style={{ minHeight: 220 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={e1rmChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="session" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 }} formatter={(v) => [v != null ? `${v} kg` : "", "e1RM"]} />
                <Line type="monotone" dataKey="e1rm" stroke="var(--accent-blue)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {volumeChartData.length > 0 && (
        <section className="axion-card">
          <h2>Volumen por sesión (kg)</h2>
          <div className="progress-chart-container" style={{ minHeight: 220 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={volumeChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="session" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 }} formatter={(v) => [v != null ? `${v} kg` : "", "Volumen"]} />
                <Line type="monotone" dataKey="volume" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {e1rmChartData.length === 0 && volumeChartData.length === 0 && data.lastSessions.length === 0 && (
        <section className="axion-card">
          <div className="axion-empty"><p>Completa series con peso y reps para ver tendencias.</p></div>
        </section>
      )}
    </section>
  );
}
