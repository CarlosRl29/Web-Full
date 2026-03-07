"use client";

import { useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useCoachAuth } from "../../../lib/useCoachAuth";
import { useAppAuth } from "../../../lib/useAppAuth";

type SyncResult = {
  inserted: number;
  updated: number;
  total: number;
};

export default function ExercisesSyncPage() {
  const { token, loading: authLoading } = useCoachAuth();
  const { me } = useAppAuth();
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string>("");

  const syncExercises = async () => {
    if (!token) return;
    setSyncing(true);
    setError("");
    setResult(null);
    setStatus("Sync in progress. Fetching and normalizing exercises...");
    try {
      const data = await apiRequest<SyncResult>("/admin/exercises/sync", { method: "POST" }, token);
      setResult(data);
      setStatus(`${data.total} exercises synced successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("");
    } finally {
      setSyncing(false);
    }
  };

  if (authLoading) return <p className="axion-loading">Cargando...</p>;
  if (me?.role !== "ADMIN") {
    return (
      <section className="axion-page">
        <section className="axion-card" style={{ maxWidth: 480, margin: "0 auto" }}>
          <h1>Acceso restringido</h1>
          <p className="axion-muted" style={{ marginTop: 12 }}>
            La sincronizacion de ejercicios esta disponible solo para administradores.
          </p>
          <a className="axion-button axion-button-primary" href="/coach" style={{ display: "inline-block", marginTop: 16 }}>
            Volver
          </a>
        </section>
      </section>
    );
  }

  return (
    <section className="axion-page">
      <h1>Sincronizar ejercicios</h1>
      <p className="axion-muted" style={{ marginBottom: 16 }}>
        Importa ejercicios desde ExerciseDB para poblar la base y habilitar pruebas de rutinas, busqueda y marketplace.
      </p>

      <button
        className="axion-button axion-button-primary"
        onClick={syncExercises}
        disabled={syncing}
        style={{ alignSelf: "flex-start" }}
      >
        {syncing ? "Sincronizando..." : "Sincronizar ejercicios"}
      </button>

      {!!status && <p style={{ marginTop: 16 }}>{status}</p>}
      {!!error && <p style={{ marginTop: 16, color: "#f87171" }}>{error}</p>}
      {result && (
        <section className="axion-card" style={{ marginTop: 20, padding: 16, maxWidth: 500 }}>
          <p>{result.total} exercises synced successfully</p>
          <p className="axion-muted" style={{ marginTop: 8 }}>
            Inserted: {result.inserted} | Updated: {result.updated}
          </p>
        </section>
      )}
    </section>
  );
}
