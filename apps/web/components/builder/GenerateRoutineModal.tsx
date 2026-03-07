"use client";

import { useState } from "react";
import { apiRequest } from "../../lib/api";

type Props = {
  token: string;
  onClose: () => void;
  onGenerated: (routine: { name: string; description?: string; days: unknown[] }) => void;
  defaultProfile?: {
    goal?: string;
    experience_level?: string;
    days_per_week?: number;
    equipment?: string[];
    weight_kg?: number | null;
    height_cm?: number | null;
    body_fat_pct?: number | null;
    age?: number | null;
    injuries?: string | null;
  };
};

export function GenerateRoutineModal({
  token,
  onClose,
  onGenerated,
  defaultProfile
}: Props) {
  const [goal, setGoal] = useState(defaultProfile?.goal ?? "MIXED");
  const [daysPerWeek, setDaysPerWeek] = useState(defaultProfile?.days_per_week ?? 4);
  const [level, setLevel] = useState(defaultProfile?.experience_level ?? "INTERMEDIATE");
  const [equipment, setEquipment] = useState<string[]>(defaultProfile?.equipment ?? []);
  const [useSavedProfile, setUseSavedProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBodyParams =
    defaultProfile &&
    (defaultProfile.weight_kg != null ||
      defaultProfile.height_cm != null ||
      defaultProfile.age != null ||
      defaultProfile.body_fat_pct != null);

  const equipmentOptions = [
    { id: "barbell", label: "Barra" },
    { id: "dumbbell", label: "Mancuernas" },
    { id: "kettlebell", label: "Kettlebell" },
    { id: "body weight", label: "Peso corporal" },
    { id: "cable", label: "Polea" },
    { id: "resistance band", label: "Banda elástica" }
  ];

  const toggleEquipment = (id: string) => {
    setEquipment((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{
        routineId: string;
        draft: { name: string; description?: string; days: unknown[] };
        warnings: string[];
        score: number;
        nextSteps: string[];
        requestId: string;
      }>(
        "/ai/generate-routine",
        {
          method: "POST",
          body: JSON.stringify({
            use_saved_profile: useSavedProfile,
            profile: useSavedProfile
              ? undefined
              : {
                  experience_level: level,
                  goal,
                  days_per_week: daysPerWeek
                },
            constraints: equipment.length > 0 ? { equipment } : undefined
          })
        },
        token
      );
      const { draft } = res;
      onGenerated(draft);
      onClose();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      const errObj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
      const errorCode = errObj?.errorCode as string | undefined;
      if (errorCode === "MISSING_CONTEXT" && Array.isArray(errObj?.missingFields)) {
        const fields = (errObj.missingFields as string[]).join(", ");
        setError(`Faltan datos: ${fields}`);
      } else if (
        ["RULES_FAILED", "VALIDATION_FAILED", "SAFETY_GATE"].includes(errorCode ?? "") &&
        Array.isArray(errObj?.validationErrors)
      ) {
        const msgs = (errObj.validationErrors as unknown[]).map((v) =>
          typeof v === "string" ? v : typeof v === "object" && v && "message" in v ? String((v as { message: unknown }).message) : String(v)
        );
        setError(msgs.join(". "));
      } else {
        setError("No se pudo generar la rutina");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="axion-modal-overlay" onClick={onClose}>
      <section
        className="axion-card axion-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-routine-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h2 id="generate-routine-title">Generar rutina con IA</h2>
          <button
            type="button"
            className="axion-button axion-button-secondary"
            onClick={onClose}
            style={{ padding: "6px 12px" }}
          >
            ✕ Salir
          </button>
        </div>

        <p className="axion-muted" style={{ marginBottom: 16 }}>
          La IA creará una rutina personalizada según tu perfil, objetivo, parámetros corporales y
          historial de entrenamiento.
        </p>

        {defaultProfile ? (
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={useSavedProfile}
              onChange={(e) => setUseSavedProfile(e.target.checked)}
            />
            <span>Usar mi perfil guardado (objetivo, nivel, días, equipo del perfil)</span>
          </label>
        ) : null}

        {hasBodyParams ? (
          <p className="axion-muted" style={{ marginBottom: 12, fontSize: 13 }}>
            Se considerarán tus parámetros corporales (peso, altura, edad) para la recomendación.
          </p>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: useSavedProfile ? "none" : "block" }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Objetivo</label>
            <select
              className="axion-select"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="STRENGTH">Fuerza</option>
              <option value="HYPERTROPHY">Hipertrofia</option>
              <option value="MIXED">Mixto</option>
            </select>
          </div>

          <div style={{ display: useSavedProfile ? "none" : "block" }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Días por semana
            </label>
            <select
              className="axion-select"
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(Number(e.target.value))}
              style={{ width: "100%" }}
            >
              {[2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  {d} días
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: useSavedProfile ? "none" : "block" }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Nivel</label>
            <select
              className="axion-select"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="BEGINNER">Principiante</option>
              <option value="INTERMEDIATE">Intermedio</option>
              <option value="ADVANCED">Avanzado</option>
            </select>
          </div>

          <div style={{ display: useSavedProfile ? "none" : "block" }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
              Equipo disponible (opcional)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {equipmentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`axion-button ${equipment.includes(opt.id) ? "axion-button-primary" : "axion-button-secondary"}`}
                  onClick={() => toggleEquipment(opt.id)}
                  style={{ padding: "6px 12px", fontSize: 13 }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <p style={{ color: "#f87171", marginTop: 12, fontSize: 14 }}>{error}</p>
        ) : null}

        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="axion-button axion-button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="axion-button axion-button-primary"
            onClick={() => void handleSubmit()}
            disabled={loading}
          >
            {loading ? "Generando..." : "Generar rutina"}
          </button>
        </div>
      </section>
    </div>
  );
}
