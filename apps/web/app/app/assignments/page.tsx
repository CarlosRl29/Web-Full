"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useAppAuth } from "../../../lib/useAppAuth";
import { useToast } from "../../../components/ToastProvider";

type Routine = {
  id: string;
  name: string;
  description?: string | null;
  owner_name?: string | null;
  days: Array<{ id: string; day_label: string }>;
};

export default function UserAssignmentsPage() {
  const { token, loading } = useAppAuth();
  const { showToast } = useToast();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }
    void apiRequest<Routine[]>("/routines/assigned", {}, token)
      .then(setRoutines)
      .catch((error) => setMessage(error instanceof Error ? error.message : "No se pudieron cargar asignaciones"));
  }, [token]);

  const cloneRoutine = async (routineId: string) => {
    if (!token) {
      return;
    }
    try {
      await apiRequest(`/routines/${routineId}/clone`, { method: "POST" }, token);
      showToast("success", "Rutina clonada a tu cuenta.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "No se pudo clonar";
      setMessage(text);
      showToast("error", text);
    }
  };

  if (loading) {
    return <p className="axion-loading">Cargando asignaciones...</p>;
  }

  return (
    <section className="axion-page">
      <section className="axion-hero">
        <h1>Rutinas asignadas</h1>
        <p>Estas rutinas son de solo lectura, pero puedes clonarlas a “Mis rutinas”.</p>
      </section>
      <section className="axion-card">
        {message ? <p className="axion-muted">{message}</p> : null}
        {routines.length === 0 ? (
          <div className="axion-empty">
            <strong>Sin asignaciones activas</strong>
            <p>Tu coach puede asignarte rutinas desde el panel.</p>
          </div>
        ) : (
          <ul className="axion-list">
            {routines.map((routine) => (
              <li className="axion-list-item" key={routine.id}>
                <div>
                  <strong>{routine.name}</strong>
                  <p className="axion-muted">Coach: {routine.owner_name ?? "N/A"}</p>
                </div>
                <button className="axion-button axion-button-secondary" onClick={() => void cloneRoutine(routine.id)}>
                  Clonar a mis rutinas
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
