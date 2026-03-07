"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useCoachAuth } from "../../../lib/useCoachAuth";
import { useAppAuth } from "../../../lib/useAppAuth";

type Translation = {
  id: string;
  exercise_id: string;
  locale: "es" | "en";
  name: string;
  short_description: string | null;
  technique_steps: string[];
  cues: string[];
  common_mistakes: string[];
  exercise: { id: string; name: string; canonical_slug: string | null };
};

export default function ExercisesTranslationsPage() {
  const { token, loading: authLoading } = useCoachAuth();
  const { me } = useAppAuth();
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [localeFilter, setLocaleFilter] = useState<"all" | "es" | "en">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(
    async (accessToken: string) => {
      const params = localeFilter !== "all" ? `?locale=${localeFilter}` : "";
      const data = await apiRequest<Translation[]>(`/admin/exercises/translations${params}`, {}, accessToken);
      setTranslations(Array.isArray(data) ? data : []);
    },
    [localeFilter]
  );

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  useEffect(() => {
    setLoading(!token);
  }, [token]);

  const bulkCreateEs = async () => {
    if (!token) return;
    setBulkLoading(true);
    try {
      const result = await apiRequest<{ created: number }>(
        "/admin/exercises/translations/bulk-es",
        { method: "POST" },
        token
      );
      alert(`Se crearon ${result?.created ?? 0} traducciones ES`);
      void load(token);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear traducciones");
    } finally {
      setBulkLoading(false);
    }
  };

  const saveTranslation = async (id: string) => {
    if (!token) return;
    setSaving(id);
    try {
      await apiRequest<Translation>(
        `/admin/exercises/translations/${id}`,
        { method: "PATCH", body: JSON.stringify({ name: editName }) },
        token
      );
      setTranslations((prev) =>
        prev.map((t) => (t.id === id ? { ...t, name: editName } : t))
      );
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(null);
    }
  };

  const startEdit = (t: Translation) => {
    setEditingId(t.id);
    setEditName(t.name);
  };

  if (authLoading || loading) {
    return <p className="axion-loading">Cargando...</p>;
  }

  if (me?.role !== "ADMIN") {
    return (
      <section className="axion-page">
        <section className="axion-card" style={{ maxWidth: 480, margin: "0 auto" }}>
          <h1>Acceso restringido</h1>
          <p className="axion-muted" style={{ marginTop: 12 }}>
            Las traducciones de ejercicios están disponibles solo para administradores.
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
      <h1>Traducciones de ejercicios</h1>
      <p className="axion-muted" style={{ marginBottom: 16 }}>
        Gestiona las traducciones ES/EN. Usa &quot;Bulk ES&quot; para crear traducciones faltantes desde el archivo de mapeo.
      </p>
      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          Locale:{" "}
          <select
            className="axion-select"
            value={localeFilter}
            onChange={(e) => setLocaleFilter(e.target.value as "all" | "es" | "en")}
          >
            <option value="all">Todos</option>
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
        </label>
        <button
          className="axion-button axion-button-primary"
          onClick={bulkCreateEs}
          disabled={bulkLoading}
        >
          {bulkLoading ? "Creando…" : "Bulk ES (crear faltantes)"}
        </button>
        <span className="axion-muted">{translations.length} traducciones</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="axion-table" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <th>Ejercicio (canonical)</th>
              <th>Locale</th>
              <th>Nombre traducido</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {translations.map((t) => (
              <tr key={t.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {t.exercise.canonical_slug ?? t.exercise.name}
                </td>
                <td>{t.locale}</td>
                <td>
                  {editingId === t.id ? (
                    <input
                      className="axion-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ width: "100%", minWidth: 180 }}
                      autoFocus
                    />
                  ) : (
                    t.name
                  )}
                </td>
                <td>
                  {editingId === t.id ? (
                    <>
                      <button
                        className="axion-button axion-button-primary"
                        onClick={() => saveTranslation(t.id)}
                        disabled={!!saving}
                      >
                        Guardar
                      </button>
                      <button
                        className="axion-button axion-button-secondary"
                        onClick={() => setEditingId(null)}
                        style={{ marginLeft: 8 }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      className="axion-button axion-button-secondary"
                      onClick={() => startEdit(t)}
                      disabled={!!saving}
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
