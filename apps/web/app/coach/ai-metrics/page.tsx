"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useCoachAuth } from "../../../lib/useCoachAuth";

type AiMetrics = {
  days: number;
  total: number;
  dedup_hits: number;
  rate_limited: number;
  dedup_savings_pct: number;
};

export default function CoachAiMetricsPage() {
  const { token, loading } = useCoachAuth();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AiMetrics | null>(null);
  const [message, setMessage] = useState("");

  const loadMetrics = async (accessToken: string, value: number) => {
    try {
      const metrics = await apiRequest<AiMetrics>(`/ai/metrics?days=${value}`, {}, accessToken);
      setData(metrics);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar metricas");
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadMetrics(token, days);
  }, [token, days]);

  if (loading) {
    return <p>Cargando...</p>;
  }

  return (
    <section>
      <h1>Coach • AI Metrics</h1>
      {message ? <p>{message}</p> : null}
      <label>
        Dias:
        <input
          type="number"
          min={1}
          max={90}
          value={days}
          onChange={(event) => setDays(Number(event.target.value || 7))}
          style={{ marginLeft: 8 }}
        />
      </label>
      {data ? (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", marginTop: 14 }}>
          <article style={{ border: "1px solid #ddd", padding: 10 }}>
            <strong>Total</strong>
            <p>{data.total}</p>
          </article>
          <article style={{ border: "1px solid #ddd", padding: 10 }}>
            <strong>Dedup hits</strong>
            <p>{data.dedup_hits}</p>
          </article>
          <article style={{ border: "1px solid #ddd", padding: 10 }}>
            <strong>Rate limited</strong>
            <p>{data.rate_limited}</p>
          </article>
          <article style={{ border: "1px solid #ddd", padding: 10 }}>
            <strong>Ahorro dedup %</strong>
            <p>{data.dedup_savings_pct}%</p>
          </article>
        </div>
      ) : null}
    </section>
  );
}
