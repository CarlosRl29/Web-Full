"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { useAppAuth } from "../../lib/useAppAuth";
import { useToast } from "../../components/ToastProvider";

type MarketplaceRoutine = {
  id: string;
  name: string;
  marketplace_title?: string | null;
  marketplace_goal?: string | null;
  marketplace_level?: string | null;
  marketplace_days_per_week?: number | null;
  marketplace_description?: string | null;
  rating_average: number;
  rating_count: number;
  owner_name?: string | null;
};

export default function MarketplacePage() {
  const { token, loading } = useAppAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<MarketplaceRoutine[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }
    void apiRequest<MarketplaceRoutine[]>("/routines/marketplace", {}, token)
      .then(setItems)
      .catch((error) => setMessage(error instanceof Error ? error.message : "No se pudo cargar marketplace"));
  }, [token]);

  const saveRoutine = async (routineId: string) => {
    if (!token) {
      return;
    }
    try {
      await apiRequest(`/routines/${routineId}/clone`, { method: "POST" }, token);
      showToast("success", "Rutina guardada en tus rutinas.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "No se pudo guardar rutina";
      setMessage(text);
      showToast("error", text);
    }
  };

  const followCoach = async (routineId: string) => {
    if (!token) {
      return;
    }
    try {
      await apiRequest(`/routines/${routineId}/follow`, { method: "POST" }, token);
      showToast("success", "Coach seguido correctamente.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "No se pudo seguir coach";
      setMessage(text);
      showToast("error", text);
    }
  };

  if (loading) {
    return <p className="axion-loading">Cargando marketplace...</p>;
  }

  return (
    <main className="axion-shell">
      <div className="axion-content">
        <div className="axion-container axion-page">
          <section className="axion-hero">
            <h1>Coach Marketplace</h1>
            <p>Explora rutinas públicas de coaches y guárdalas en tu biblioteca.</p>
            <div className="axion-actions" style={{ marginTop: 14 }}>
              <Link href="/app/routines" className="axion-button axion-button-secondary">
                Volver al portal
              </Link>
            </div>
          </section>
          <section className="axion-card">
            {message ? <p className="axion-muted">{message}</p> : null}
            {items.length === 0 ? (
              <div className="axion-empty">
                <strong>Aún no hay rutinas públicas</strong>
                <p>Vuelve más tarde para descubrir nuevas programaciones de coaches.</p>
              </div>
            ) : (
              <ul className="axion-list">
                {items.map((item) => (
                  <li className="axion-list-item" key={item.id} style={{ alignItems: "flex-start" }}>
                    <div>
                      <strong>{item.marketplace_title ?? item.name}</strong>
                      <p className="axion-muted">
                        {item.marketplace_goal ?? "General"} • {item.marketplace_level ?? "N/A"} •{" "}
                        {item.marketplace_days_per_week ?? "-"} días/sem
                      </p>
                      <p className="axion-muted">
                        Coach: {item.owner_name ?? "N/A"} • Rating: {item.rating_average.toFixed(1)} (
                        {item.rating_count})
                      </p>
                    </div>
                    <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                      <button
                        className="axion-button axion-button-primary"
                        onClick={() => void saveRoutine(item.id)}
                      >
                        Guardar en mis rutinas
                      </button>
                      <button
                        className="axion-button axion-button-secondary"
                        onClick={() => void followCoach(item.id)}
                      >
                        Seguir coach
                      </button>
                      <Link className="axion-button axion-button-secondary" href={`/marketplace/${item.id}`}>
                        Ver detalle
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
