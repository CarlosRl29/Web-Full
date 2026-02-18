"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useCoachAuth } from "../../../lib/useCoachAuth";

type AiAlert = {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  metrics: Record<string, number>;
  window_hours: number;
};

export default function CoachAiAlertsPage() {
  const { token, loading } = useCoachAuth();
  const [windowHours, setWindowHours] = useState(24);
  const [alerts, setAlerts] = useState<AiAlert[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }
    void (async () => {
      try {
        const data = await apiRequest<AiAlert[]>(
          `/ai/alerts?window_hours=${windowHours}`,
          {},
          token
        );
        setAlerts(data);
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudieron cargar alertas");
      }
    })();
  }, [token, windowHours]);

  if (loading) {
    return <p>Cargando...</p>;
  }

  return (
    <section className="axion-page">
      <section className="axion-hero">
        <h1>AI Alerts</h1>
        <p>Detecta spikes operativos y señales críticas de seguridad para reaccionar rápido.</p>
      </section>
      {message ? <p className="axion-muted">{message}</p> : null}
      <section className="axion-card">
      <label className="axion-muted">
        Ventana (horas):
        <input
          className="axion-input"
          type="number"
          min={1}
          max={168}
          value={windowHours}
          onChange={(event) => setWindowHours(Number(event.target.value || 24))}
          style={{ marginLeft: 8 }}
        />
      </label>
      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {alerts.map((alert) => (
          <article
            key={alert.id}
            className="axion-card"
            style={{
              background:
                alert.severity === "high"
                  ? "rgba(239, 68, 68, 0.24)"
                  : alert.severity === "medium"
                    ? "rgba(239, 68, 68, 0.12)"
                    : "rgba(59, 130, 246, 0.12)"
            }}
          >
            <strong>
              [{alert.severity.toUpperCase()}] {alert.title}
            </strong>
            <p>{alert.description}</p>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {JSON.stringify(alert.metrics, null, 2)}
            </pre>
          </article>
        ))}
      </div>
      </section>
    </section>
  );
}
