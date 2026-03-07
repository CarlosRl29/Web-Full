"use client";

import { useEffect, useState } from "react";
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
import { apiRequest } from "../../../../lib/api";
import { useAppAuth } from "../../../../lib/useAppAuth";

type BodyData = {
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  age: number | null;
};

export default function BodyMetricsPage() {
  const { token, loading } = useAppAuth();
  const [data, setData] = useState<BodyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<BodyData>("/progress/body", {}, token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token]);

  if (loading) {
    return <p className="axion-loading">Cargando métricas...</p>;
  }

  const weightChartData =
    data?.weight_kg != null
      ? [{ date: "Actual", weight: data.weight_kg }]
      : [];

  return (
    <section className="axion-page">
      <div style={{ marginBottom: 16 }}>
        <Link href="/app/progress" className="axion-muted" style={{ fontSize: 14 }}>
          ← Progreso
        </Link>
      </div>

      <section className="axion-hero">
        <h1>Métricas corporales</h1>
        <p>
          Peso, altura y composición. Actualiza tu perfil para registrar cambios.
        </p>
      </section>

      {error && (
        <div className="axion-card" style={{ borderColor: "var(--accent-red)" }}>
          <p>{error}</p>
        </div>
      )}

      <section className="axion-card">
        <h2>Peso actual</h2>
        {data?.weight_kg != null ? (
          <div className="progress-body-value">
            <span className="progress-body-number">{data.weight_kg}</span>
            <span className="axion-muted"> kg</span>
          </div>
        ) : (
          <p className="axion-muted">Sin datos. Actualiza tu perfil.</p>
        )}
      </section>

      {weightChartData.length > 0 && (
        <section className="axion-card">
          <h2>Tendencia de peso</h2>
          <p className="axion-muted" style={{ marginBottom: 12 }}>
            Registra tu peso regularmente en el perfil para ver la tendencia.
          </p>
          <div className="progress-chart-container" style={{ minHeight: 180 }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weightChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--card-border)",
                    borderRadius: 8
                  }}
                  formatter={(value) => [value != null ? `${value} kg` : "", "Peso"]}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--accent-blue)"
                  strokeWidth={2}
                  dot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="axion-card">
        <h2>Otras métricas</h2>
        <div className="progress-metrics-grid">
          <div>
            <span className="axion-muted">Altura</span>
            <span className="progress-metric-value">
              {data?.height_cm != null ? `${data.height_cm} cm` : "—"}
            </span>
          </div>
          <div>
            <span className="axion-muted">Grasa corporal</span>
            <span className="progress-metric-value">
              {data?.body_fat_pct != null ? `${data.body_fat_pct}%` : "—"}
            </span>
          </div>
          <div>
            <span className="axion-muted">Edad</span>
            <span className="progress-metric-value">
              {data?.age != null ? data.age : "—"}
            </span>
          </div>
        </div>
        <Link className="axion-button axion-button-secondary" href="/app/profile" style={{ marginTop: 16 }}>
          Editar perfil
        </Link>
      </section>
    </section>
  );
}
