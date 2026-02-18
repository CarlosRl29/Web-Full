"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { MeProfile, useAppAuth } from "../../../lib/useAppAuth";
import { useToast } from "../../../components/ToastProvider";

export default function ProfilePage() {
  const { token, me, loading, setMe } = useAppAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    full_name: "",
    goal: "MIXED",
    experience_level: "INTERMEDIATE",
    days_per_week: 4,
    session_minutes: 60,
    injuries: "",
    equipment: "",
    active_mode: "USER"
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!me) {
      return;
    }
    setForm({
      full_name: me.full_name,
      goal: (me.goal ?? "MIXED") as "STRENGTH" | "HYPERTROPHY" | "MIXED",
      experience_level: (me.experience_level ?? "INTERMEDIATE") as "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
      days_per_week: me.days_per_week ?? 4,
      session_minutes: me.session_minutes ?? 60,
      injuries: me.injuries ?? "",
      equipment: (me.equipment ?? []).join(", "),
      active_mode: me.active_mode
    });
  }, [me]);

  const saveProfile = async () => {
    if (!token) {
      return;
    }
    try {
      const updated = await apiRequest<MeProfile>(
        "/auth/me/profile",
        {
          method: "PATCH",
          body: JSON.stringify({
            full_name: form.full_name,
            goal: form.goal,
            experience_level: form.experience_level,
            days_per_week: Number(form.days_per_week),
            session_minutes: Number(form.session_minutes),
            injuries: form.injuries || undefined,
            equipment: form.equipment
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          })
        },
        token
      );
      setMe(updated);
      setMessage("Perfil actualizado.");
      showToast("success", "Perfil actualizado.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "No se pudo actualizar perfil";
      setMessage(text);
      showToast("error", text);
    }
  };

  const saveMode = async () => {
    if (!token) {
      return;
    }
    try {
      const updated = await apiRequest<MeProfile>(
        "/auth/me/mode",
        {
          method: "PATCH",
          body: JSON.stringify({ active_mode: form.active_mode })
        },
        token
      );
      setMe(updated);
      setMessage("Modo actualizado.");
      showToast("success", "Modo actualizado.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "No se pudo cambiar modo";
      setMessage(text);
      showToast("error", text);
    }
  };

  if (loading) {
    return <p className="axion-loading">Cargando perfil...</p>;
  }

  return (
    <section className="axion-page">
      <section className="axion-hero">
        <h1>Perfil</h1>
        <p>Entre más información proporciones, mejores recomendaciones dará AXION.</p>
      </section>
      <section className="axion-card">
        {message ? <p className="axion-muted">{message}</p> : null}
        <div style={{ display: "grid", gap: 14 }}>
          <section className="axion-card" style={{ padding: 14, background: "rgba(255,255,255,0.02)" }}>
            <h3 style={{ marginBottom: 8 }}>Datos obligatorios</h3>
            <div style={{ display: "grid", gap: 10 }}>
              <label className="axion-muted">
                Nombre completo
                <input className="axion-input" value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} />
              </label>
              <label className="axion-muted">
                Objetivo
                <select className="axion-select" value={form.goal} onChange={(e) => setForm((prev) => ({ ...prev, goal: e.target.value as any }))}>
                  <option value="STRENGTH">Fuerza</option>
                  <option value="HYPERTROPHY">Hipertrofia</option>
                  <option value="MIXED">Mixto</option>
                </select>
              </label>
              <label className="axion-muted">
                Nivel
                <select className="axion-select" value={form.experience_level} onChange={(e) => setForm((prev) => ({ ...prev, experience_level: e.target.value as any }))}>
                  <option value="BEGINNER">Principiante</option>
                  <option value="INTERMEDIATE">Intermedio</option>
                  <option value="ADVANCED">Avanzado</option>
                </select>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label className="axion-muted">
                  Días por semana
                  <input className="axion-input" type="number" min={1} max={7} value={form.days_per_week} onChange={(e) => setForm((prev) => ({ ...prev, days_per_week: Number(e.target.value) }))} />
                </label>
                <label className="axion-muted">
                  Minutos por sesión
                  <input className="axion-input" type="number" min={15} max={240} value={form.session_minutes} onChange={(e) => setForm((prev) => ({ ...prev, session_minutes: Number(e.target.value) }))} />
                </label>
              </div>
            </div>
          </section>

          <section className="axion-card" style={{ padding: 14, background: "rgba(255,255,255,0.02)" }}>
            <h3 style={{ marginBottom: 8 }}>Datos opcionales</h3>
            <p className="axion-muted" style={{ marginBottom: 8 }}>
              Puedes completarlos después; ayudan a personalizar mejor IA y seguimiento de coach.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              <label className="axion-muted">
                Lesiones o dolor (opcional)
                <input className="axion-input" value={form.injuries} onChange={(e) => setForm((prev) => ({ ...prev, injuries: e.target.value }))} />
              </label>
              <label className="axion-muted">
                Equipo disponible (opcional, separado por coma)
                <input className="axion-input" value={form.equipment} onChange={(e) => setForm((prev) => ({ ...prev, equipment: e.target.value }))} />
              </label>
            </div>
          </section>

          <button className="axion-button axion-button-primary" onClick={() => void saveProfile()}>
            Guardar perfil
          </button>
        </div>
      </section>
      <section className="axion-card">
        <h2>Modo</h2>
        <p className="axion-muted">Cambia entre portal de usuario y panel de coach.</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select className="axion-select" value={form.active_mode} onChange={(e) => setForm((prev) => ({ ...prev, active_mode: e.target.value }))}>
            {(me?.preferred_modes ?? ["USER"]).map((mode) => (
              <option value={mode} key={mode}>
                {mode}
              </option>
            ))}
          </select>
          <button className="axion-button axion-button-secondary" onClick={() => void saveMode()}>
            Guardar modo
          </button>
        </div>
      </section>
    </section>
  );
}
