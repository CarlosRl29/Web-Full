"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useCoachAuth } from "../../../lib/useCoachAuth";
import { useAppAuth } from "../../../lib/useAppAuth";
import { useLanguage } from "../../../components/LanguageProvider";

type Exercise = {
  id: string;
  name: string;
  name_en?: string;
  canonical_slug?: string | null;
  muscle_group: string;
  sub_muscle?: string | null;
  equipment?: string | null;
  primary_muscle?: string | null;
  primary_submuscle?: string | null;
  movement_pattern?: string | null;
  exercise_type?: string | null;
  difficulty?: string | null;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const MUSCLE_GROUPS = [
  "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS", "QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE"
];
const SUBMUSCLES: Record<string, string[]> = {
  CHEST: ["UPPER_CHEST", "MID_CHEST", "LOWER_CHEST"],
  BACK: ["LATS", "UPPER_BACK", "MID_BACK", "LOWER_BACK", "TRAPS"],
  SHOULDERS: ["ANTERIOR_DELTOID", "LATERAL_DELTOID", "REAR_DELTOID"],
  BICEPS: ["BICEPS"],
  TRICEPS: ["TRICEPS"],
  QUADS: ["QUADS"],
  HAMSTRINGS: ["HAMSTRINGS"],
  GLUTES: ["GLUTES"],
  CALVES: ["CALVES"],
  CORE: ["ABS", "OBLIQUES", "ERECTORS"]
};
const MOVEMENT_PATTERNS = ["PUSH", "PULL", "SQUAT", "HINGE", "LUNGE", "CARRY", "CORE", "ISOLATION"];
const EXERCISE_TYPES = ["COMPOUND", "ISOLATION"];
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

function formatLabel(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3001/api` : "http://localhost:3001/api");
}

export default function ExercisesTaxonomyPage() {
  const { token, loading: authLoading } = useCoachAuth();
  const { me } = useAppAuth();
  const { locale } = useLanguage();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 50;
  const [saveStatus, setSaveStatus] = useState<Record<string, { status: SaveStatus; message?: string }>>({});
  const [pendingOnly, setPendingOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [primaryMuscle, setPrimaryMuscle] = useState<string>("");

  const load = useCallback(
    async (accessToken: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String(page * limit));
        params.set("pending_only", pendingOnly ? "true" : "false");
        params.set("locale", locale);
        if (search.trim()) params.set("search", search.trim());
        if (primaryMuscle) params.set("primary_muscle", primaryMuscle);
        const res = await apiRequest<{ data: Exercise[]; total: number; limit: number; offset: number }>(
          `/admin/exercises?${params.toString()}`,
          {},
          accessToken
        );
        setExercises(Array.isArray(res?.data) ? res.data : []);
        setTotal(typeof res?.total === "number" ? res.total : 0);
      } catch (err) {
        console.error("Load exercises failed", err);
        setExercises([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [page, limit, pendingOnly, search, primaryMuscle, locale]
  );

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  useEffect(() => {
    setLoading(!token);
  }, [token]);

  const update = async (id: string, patch: Partial<Exercise>) => {
    if (!token) return;
    if ("primary_muscle" in patch && patch.primary_muscle !== undefined) {
      patch = { ...patch, primary_submuscle: undefined };
    }
    setSaveStatus((s) => ({ ...s, [id]: { status: "saving" } }));
    try {
      const res = await fetch(`${getApiBase()}/exercises/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(patch)
      });
      const payload = await res.json();
      if (!res.ok) {
        const msg = payload?.error?.message ?? "Error al guardar";
        setSaveStatus((s) => ({ ...s, [id]: { status: "error", message: String(msg) } }));
        return;
      }
      const data = payload?.data ?? payload;
      setExercises((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch, ...data } : e))
      );
      setSaveStatus((s) => ({ ...s, [id]: { status: "saved" } }));
      setTimeout(() => {
        setSaveStatus((s) => {
          const next = { ...s };
          delete next[id];
          return next;
        });
      }, 2000);
    } catch (err) {
      setSaveStatus((s) => ({
        ...s,
        [id]: { status: "error", message: err instanceof Error ? err.message : "Error al guardar" }
      }));
    }
  };

  const statusEl = (id: string) => {
    const st = saveStatus[id];
    if (!st) return null;
    if (st.status === "saving") return <span className="axion-muted">Guardando…</span>;
    if (st.status === "saved") return <span style={{ color: "var(--axion-success)" }}>Guardado ✅</span>;
    if (st.status === "error") return <span style={{ color: "var(--axion-error)" }}>Error ❌ {st.message}</span>;
    return null;
  };

  const totalPages = Math.ceil(total / limit);

  if (authLoading || (loading && exercises.length === 0)) {
    return <p className="axion-loading">Cargando...</p>;
  }

  if (me?.role !== "ADMIN") {
    return (
      <section className="axion-page">
        <section className="axion-card" style={{ maxWidth: 480, margin: "0 auto" }}>
          <h1>Acceso restringido</h1>
          <p className="axion-muted" style={{ marginTop: 12 }}>
            La clasificación de ejercicios está disponible solo para administradores.
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
      <h1>Clasificar ejercicios (taxonomía)</h1>
      <p className="axion-muted" style={{ marginBottom: 16 }}>
        RAW = campos de ExerciseDB. CANONICAL = taxonomía AXION. Asigna primary_muscle, movement_pattern, etc.
      </p>

      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(e) => setPendingOnly(e.target.checked)}
          />
          Solo pendientes
        </label>
        <input
          className="axion-input"
          placeholder="Buscar por nombre o slug"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          style={{ width: 220 }}
        />
        <button className="axion-button axion-button-secondary" onClick={() => setSearch(searchInput)}>
          Buscar
        </button>
        <select
          className="axion-select"
          value={primaryMuscle}
          onChange={(e) => setPrimaryMuscle(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="">Todos los músculos</option>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>{formatLabel(m)}</option>
          ))}
        </select>
        <span className="axion-muted">
          {total} ejercicios
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="axion-table" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th colSpan={4} style={{ background: "rgba(0,0,0,0.1)" }}>RAW (ExerciseDB)</th>
              <th colSpan={5} style={{ background: "rgba(0,100,0,0.1)" }}>CANONICAL (AXION)</th>
              <th>Estado</th>
            </tr>
            <tr>
              <th>name_en</th>
              <th>muscle_group</th>
              <th>sub_muscle</th>
              <th>equipment</th>
              <th>primary_muscle</th>
              <th>primary_submuscle</th>
              <th>movement_pattern</th>
              <th>exercise_type</th>
              <th>difficulty</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((ex) => (
              <tr key={ex.id}>
                <td style={{ whiteSpace: "nowrap", fontSize: "0.9em" }}>{ex.name_en ?? ex.name}</td>
                <td className="axion-muted">{ex.muscle_group}</td>
                <td className="axion-muted">{ex.sub_muscle ?? "—"}</td>
                <td className="axion-muted">{ex.equipment ?? "—"}</td>
                <td>
                  <select
                    className="axion-select"
                    value={ex.primary_muscle ?? ""}
                    onChange={(e) => {
                      const v = (e.target.value || null) as Exercise["primary_muscle"];
                      setExercises((prev) =>
                        prev.map((e) =>
                          e.id === ex.id ? { ...e, primary_muscle: v, primary_submuscle: undefined } : e
                        )
                      );
                      update(ex.id, { primary_muscle: v });
                    }}
                    disabled={saveStatus[ex.id]?.status === "saving"}
                  >
                    <option value="">—</option>
                    {MUSCLE_GROUPS.map((m) => (
                      <option key={m} value={m}>{formatLabel(m)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="axion-select"
                    value={ex.primary_submuscle ?? ""}
                    onChange={(e) =>
                      update(ex.id, {
                        primary_submuscle: (e.target.value || null) as Exercise["primary_submuscle"]
                      })
                    }
                    disabled={saveStatus[ex.id]?.status === "saving" || !ex.primary_muscle}
                  >
                    <option value="">—</option>
                    {(ex.primary_muscle ? SUBMUSCLES[ex.primary_muscle] ?? [] : []).map((s) => (
                      <option key={s} value={s}>{formatLabel(s)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="axion-select"
                    value={ex.movement_pattern ?? ""}
                    onChange={(e) =>
                      update(ex.id, {
                        movement_pattern: (e.target.value || null) as Exercise["movement_pattern"]
                      })
                    }
                    disabled={saveStatus[ex.id]?.status === "saving"}
                  >
                    <option value="">—</option>
                    {MOVEMENT_PATTERNS.map((m) => (
                      <option key={m} value={m}>{formatLabel(m)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="axion-select"
                    value={ex.exercise_type ?? ""}
                    onChange={(e) =>
                      update(ex.id, {
                        exercise_type: (e.target.value || null) as Exercise["exercise_type"]
                      })
                    }
                    disabled={saveStatus[ex.id]?.status === "saving"}
                  >
                    <option value="">—</option>
                    {EXERCISE_TYPES.map((t) => (
                      <option key={t} value={t}>{formatLabel(t)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="axion-select"
                    value={ex.difficulty ?? ""}
                    onChange={(e) =>
                      update(ex.id, {
                        difficulty: (e.target.value || null) as Exercise["difficulty"]
                      })
                    }
                    disabled={saveStatus[ex.id]?.status === "saving"}
                  >
                    <option value="">—</option>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{formatLabel(d)}</option>
                    ))}
                  </select>
                </td>
                <td style={{ whiteSpace: "nowrap", fontSize: "0.85em" }}>
                  {statusEl(ex.id)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="axion-button axion-button-secondary"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </button>
          <span className="axion-muted">
            Página {page + 1} de {totalPages}
          </span>
          <button
            className="axion-button axion-button-secondary"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Siguiente
          </button>
        </div>
      )}
    </section>
  );
}
