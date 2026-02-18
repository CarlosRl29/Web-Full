"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { useAppAuth } from "../../lib/useAppAuth";
import { MobileTrainInfoModal } from "../../components/MobileTrainInfoModal";

type Routine = {
  id: string;
  name: string;
  description?: string | null;
  owner_name?: string | null;
  days: Array<{ id: string; day_label: string }>;
};

export default function AppIndexPage() {
  const { token, loading } = useAppAuth();
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [assigned, setAssigned] = useState<Routine[]>([]);
  const [message, setMessage] = useState("");
  const [showTrainInfo, setShowTrainInfo] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    void Promise.all([
      apiRequest<Routine | null>("/routines/active", {}, token),
      apiRequest<Routine[]>("/routines/assigned", {}, token)
    ])
      .then(([active, assignedRoutines]) => {
        setActiveRoutine(active);
        setAssigned(assignedRoutines);
      })
      .catch((error) =>
        setMessage(
          error instanceof Error ? error.message : "No se pudo cargar tu resumen de entrenamiento"
        )
      );
  }, [token]);

  if (loading) {
    return <p className="axion-loading">Cargando inicio...</p>;
  }

  return (
    <section className="axion-page">
      <section className="axion-hero">
        <h1>Inicio</h1>
        <p>
          Consulta tu rutina activa, revisa asignaciones recientes y descubre nuevos planes en el
          marketplace.
        </p>
      </section>

      <section className="axion-card">
        <h2>Rutina activa</h2>
        {message ? <p className="axion-muted">{message}</p> : null}
        {!activeRoutine ? (
          <div className="axion-empty">
            <strong>No tienes rutina activa</strong>
            <p>Activa una desde “Mis rutinas” para iniciar rápido cada entrenamiento.</p>
            <div style={{ marginTop: 12 }}>
              <Link className="axion-button axion-button-primary" href="/app/routines">
                Ir a mis rutinas
              </Link>
            </div>
          </div>
        ) : (
          <div className="axion-list-item">
            <div>
              <strong>{activeRoutine.name}</strong>
              <p className="axion-muted">{activeRoutine.description ?? "Rutina lista para entrenar"}</p>
            </div>
            <button
              className="axion-button axion-button-primary"
              onClick={() => setShowTrainInfo(true)}
            >
              Entrenar
            </button>
          </div>
        )}
      </section>

      <section className="axion-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h2>Asignadas por coach</h2>
          <Link className="axion-button axion-button-secondary" href="/app/assignments">
            Ver todas
          </Link>
        </div>
        {assigned.length === 0 ? (
          <div className="axion-empty">
            <strong>Sin asignaciones activas</strong>
            <p>Cuando tu coach te asigne rutinas, aparecerán aquí.</p>
          </div>
        ) : (
          <ul className="axion-list">
            {assigned.slice(0, 3).map((routine) => (
              <li key={routine.id} className="axion-list-item">
                <div>
                  <strong>{routine.name}</strong>
                  <p className="axion-muted">Coach: {routine.owner_name ?? "N/A"}</p>
                </div>
                <button
                  className="axion-button axion-button-secondary"
                  onClick={() => setShowTrainInfo(true)}
                >
                  Entrenar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="axion-card">
        <h2>Marketplace</h2>
        <p className="axion-muted">Descubre rutinas públicas creadas por coaches y guárdalas en tu biblioteca.</p>
        <div style={{ marginTop: 12 }}>
          <Link className="axion-button axion-button-primary" href="/marketplace">
            Descubrir rutinas de coaches
          </Link>
        </div>
      </section>
      <MobileTrainInfoModal open={showTrainInfo} onClose={() => setShowTrainInfo(false)} />
    </section>
  );
}
