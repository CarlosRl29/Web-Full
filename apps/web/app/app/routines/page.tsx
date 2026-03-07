"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useAppAuth } from "../../../lib/useAppAuth";
import { useLanguage } from "../../../components/LanguageProvider";
import { useToast } from "../../../components/ToastProvider";
import { MobileTrainInfoModal } from "../../../components/MobileTrainInfoModal";

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
  const { t } = useLanguage();
  const [ownRoutines, setOwnRoutines] = useState<Routine[]>([]);
  const [assignedRoutines, setAssignedRoutines] = useState<Routine[]>([]);
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showTrainInfo, setShowTrainInfo] = useState(false);

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
            {t("btn.crear_rutina")}
          </Link>
          <Link className="axion-button axion-button-secondary" href="/marketplace">
            {t("nav.explorar_marketplace")}
          </Link>
        </div>
      </section>

      <section className="axion-card">
        <h2>Mis rutinas</h2>
        <p className="axion-muted" style={{ fontSize: "0.9rem", marginBottom: 12 }}>
          Solo puedes tener 1 rutina activa. La rutina activa es la que verás en el celular para
          comenzar entrenamiento.
        </p>
        {message ? <p className="axion-muted">{message}</p> : null}
        {ownRoutines.length === 0 ? (
          <div className="axion-empty">
            <strong>{t("empty.sin_rutinas")}</strong>
            <p>{t("empty.crear_o_guardar")}</p>
            <div style={{ marginTop: 12 }}>
              <Link className="axion-button axion-button-primary" href="/app/routines/new">
                {t("btn.crear_rutina")}
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
                    {activeRoutineId === routine.id ? t("btn.activa") : t("btn.activar")}
                  </button>
                  <Link className="axion-button axion-button-secondary" href={`/app/routines/${routine.id}`}>
                    {t("btn.editar")}
                  </Link>
                  <button
                    className="axion-button axion-button-secondary"
                    onClick={() => setShowTrainInfo(true)}
                    title="Instrucciones para entrenar en la app AXION del celular"
                  >
                    {t("btn.entrenar")}
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
            <strong>{t("empty.sin_asignadas")}</strong>
            <p>{t("empty.guia_asignadas")}</p>
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
                    {t("btn.activar")}
                  </button>
                  <button
                    className="axion-button axion-button-secondary"
                    onClick={() => setShowTrainInfo(true)}
                    title="Instrucciones para entrenar en la app AXION del celular"
                  >
                    {t("btn.entrenar")}
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
      <MobileTrainInfoModal open={showTrainInfo} onClose={() => setShowTrainInfo(false)} />
    </section>
  );
}
