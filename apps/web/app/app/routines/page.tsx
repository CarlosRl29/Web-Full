"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useAppAuth } from "../../../lib/useAppAuth";
import { useToast } from "../../../components/ToastProvider";

type Routine = {
  id: string;
  name: string;
  description?: string | null;
  day_label?: string;
  days: Array<{ id: string; day_label: string }>;
};

export default function UserRoutinesPage() {
  const { token, me, loading } = useAppAuth();
  const { showToast } = useToast();
  const [ownRoutines, setOwnRoutines] = useState<Routine[]>([]);
  const [assignedRoutines, setAssignedRoutines] = useState<Routine[]>([]);
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadData = async (accessToken: string) => {
    const [owned, assigned, active] = await Promise.all([
      apiRequest<Routine[]>("/routines/owned", {}, accessToken),
      apiRequest<Routine[]>("/routines/assigned", {}, accessToken),
      apiRequest<Routine | null>("/routines/active", {}, accessToken)
    ]);
    setOwnRoutines(owned);
    setAssignedRoutines(assigned);
    setActiveRoutineId(active?.id ?? null);
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadData(token);
  }, [token]);

  const setActive = async (routineId: string) => {
    if (!token) {
      return;
    }
    try {
      await apiRequest("/routines/active", {
        method: "PATCH",
        body: JSON.stringify({ routine_id: routineId })
      }, token);
      setActiveRoutineId(routineId);
      showToast("success", "Rutina activa actualizada.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "No se pudo actualizar rutina activa";
      setMessage(text);
      showToast("error", text);
    }
  };

  const startFromRoutine = async (routine: Routine) => {
    if (!token) {
      return;
    }
    const firstDay = routine.days?.[0];
    if (!firstDay) {
      showToast("error", "La rutina no tiene días.");
      return;
    }
    try {
      await apiRequest("/workout-sessions/start", {
        method: "POST",
        body: JSON.stringify({ routine_id: routine.id, day_id: firstDay.id })
      }, token);
      showToast("success", "Sesión iniciada.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "No se pudo iniciar la sesión";
      setMessage(text);
      showToast("error", text);
    }
  };

  if (loading) {
    return <p className="axion-loading">Cargando portal de usuario...</p>;
  }

  return (
    <section className="axion-page">
      <section className="axion-hero">
        <h1>Portal de Usuario</h1>
        <p>
          Gestiona tus rutinas propias y las asignadas por coach. Activa una sola rutina para
          entrenar.
        </p>
        <div className="axion-actions" style={{ marginTop: 14 }}>
          <Link className="axion-button axion-button-primary" href="/app/routines/new">
            Crear rutina
          </Link>
          <Link className="axion-button axion-button-secondary" href="/marketplace">
            Explorar marketplace
          </Link>
        </div>
      </section>

      <section className="axion-card">
        <h2>Mis rutinas</h2>
        {message ? <p className="axion-muted">{message}</p> : null}
        {ownRoutines.length === 0 ? (
          <div className="axion-empty">
            <strong>Aún no tienes rutinas propias</strong>
            <p>Crea una rutina o guarda una desde marketplace para comenzar.</p>
            <div style={{ marginTop: 12 }}>
              <Link className="axion-button axion-button-primary" href="/app/routines/new">
                Crear rutina
              </Link>
            </div>
          </div>
        ) : (
          <ul className="axion-list">
            {ownRoutines.map((routine) => (
              <li className="axion-list-item" key={routine.id}>
                <div>
                  <strong>{routine.name}</strong>
                  <p className="axion-muted">{routine.description ?? "Sin descripción"}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className={`axion-button ${activeRoutineId === routine.id ? "axion-button-primary" : "axion-button-secondary"}`}
                    onClick={() => void setActive(routine.id)}
                  >
                    {activeRoutineId === routine.id ? "Activa" : "Activar"}
                  </button>
                  <Link className="axion-button axion-button-secondary" href={`/app/routines/${routine.id}`}>
                    Editar
                  </Link>
                  <button className="axion-button axion-button-secondary" onClick={() => void startFromRoutine(routine)}>
                    Entrenar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="axion-card">
        <h2>Asignadas por coach</h2>
        {assignedRoutines.length === 0 ? (
          <div className="axion-empty">
            <strong>No tienes rutinas asignadas</strong>
            <p>Cuando un coach te asigne una rutina aparecerá aquí en modo solo lectura.</p>
          </div>
        ) : (
          <ul className="axion-list">
            {assignedRoutines.map((routine) => (
              <li className="axion-list-item" key={routine.id}>
                <div>
                  <strong>{routine.name}</strong>
                  <p className="axion-muted">{routine.description ?? "Asignada por coach"}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="axion-button axion-button-secondary" onClick={() => void setActive(routine.id)}>
                    Activar
                  </button>
                  <button className="axion-button axion-button-secondary" onClick={() => void startFromRoutine(routine)}>
                    Entrenar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {me ? (
        <section className="axion-card">
          <span className="axion-pill">
            Modo activo: {me.active_mode} • Rol: {me.role}
          </span>
        </section>
      ) : null}
    </section>
  );
}
