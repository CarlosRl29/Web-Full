"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useAppAuth } from "../../../lib/useAppAuth";
import { useLanguage } from "../../../components/LanguageProvider";

type Exercise = {
  id: string;
  name: string;
  primary_muscle_label?: string | null;
  primary_submuscle_label?: string | null;
  secondary_muscles_labels?: string[];
  equipment?: string | null;
  image_url?: string | null;
};

type FilterOptions = {
  muscles: Array<{ value: string; label: string }>;
  submuscles: Array<{ value: string; label: string }>;
  types: Array<{ value: string; label: string }>;
};

export default function ExercisesPage() {
  const { token, loading } = useAppAuth();
  const { locale } = useLanguage();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    muscles: [],
    submuscles: [],
    types: []
  });
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [search, setSearch] = useState("");
  const [loadingEx, setLoadingEx] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest<FilterOptions>("/exercises/filter-options", {}, token)
      .then(setFilterOptions)
      .catch(() => {});
  }, [token]);

  const fetchExercises = useCallback(() => {
    if (!token) return;
    setLoadingEx(true);
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("locale", locale);
    if (search.trim()) params.set("search", search.trim());
    if (muscle) params.set("muscle", muscle);
    if (equipment) params.set("equipment", equipment);
    apiRequest<Exercise[]>(`/exercises?${params}`, {}, token)
      .then(setExercises)
      .catch(() => setExercises([]))
      .finally(() => setLoadingEx(false));
  }, [token, locale, search, muscle, equipment]);

  useEffect(() => {
    if (!token) return;
    const hasCriteria = search.trim() || muscle || equipment;
    if (!hasCriteria) {
      setExercises([]);
      setLoadingEx(false);
      return;
    }
    fetchExercises();
  }, [token, fetchExercises, search, muscle, equipment]);

  if (loading) {
    return <p className="axion-loading">Cargando...</p>;
  }

  return (
    <section className="axion-page">
      <h1>Biblioteca de ejercicios</h1>
      <p className="axion-muted" style={{ marginBottom: 16 }}>
        Busca o filtra por músculo y equipo para ver los ejercicios.
      </p>

      <div className="axion-builder-filters" style={{ marginBottom: 16 }}>
        <input
          className="axion-input"
          placeholder="Buscar ejercicio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select
          className="axion-select"
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">Músculo (todos)</option>
          {filterOptions.muscles.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="axion-select"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        >
          <option value="">Equipo (todos)</option>
          {filterOptions.types.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {!search.trim() && !muscle && !equipment ? (
        <div className="axion-empty">
          <strong>Escribe o filtra para cargar ejercicios</strong>
          <p>Usa el buscador o elige músculo, submúsculo o equipo.</p>
        </div>
      ) : loadingEx ? (
        <p className="axion-muted">Cargando ejercicios...</p>
      ) : (
        <>
          <p className="axion-muted" style={{ marginBottom: 12 }}>
            {exercises.length} ejercicios encontrados
          </p>
          <ul className="axion-list">
            {exercises.map((ex) => (
              <li key={ex.id} className="axion-card" style={{ padding: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {ex.image_url ? (
                    <img
                      src={ex.image_url}
                      alt={ex.name}
                      style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        background: "var(--axion-muted)",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.2em"
                      }}
                    >
                      {ex.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <strong>{ex.name}</strong>
                    <div className="axion-muted" style={{ fontSize: "0.85em", marginTop: 2 }}>
                      {ex.primary_muscle_label && (
                        <span>Principal: {ex.primary_muscle_label}</span>
                      )}
                      {ex.primary_submuscle_label && (
                        <span style={{ marginLeft: 8 }}>Sub: {ex.primary_submuscle_label}</span>
                      )}
                      {ex.equipment && (
                        <span style={{ marginLeft: 8 }}>• {ex.equipment}</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
