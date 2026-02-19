"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useAppAuth } from "../../../lib/useAppAuth";

type RoutineDetail = {
  id: string;
  name: string;
  description?: string | null;
  owner_name?: string | null;
  owner?: { id: string; full_name?: string | null } | null;
  marketplace_title?: string | null;
  marketplace_description?: string | null;
  rating_average: number;
  rating_count: number;
  days: Array<{
    id: string;
    day_label: string;
    groups: Array<{
      id: string;
      type: string;
      exercises: Array<{ id: string; exercise?: { name: string } }>;
    }>;
  }>;
};

export default function MarketplaceRoutineDetailPage() {
  const params = useParams<{ routineId: string }>();
  const routineId = params?.routineId ?? "";
  const { token, loading } = useAppAuth();
  const [item, setItem] = useState<RoutineDetail | null>(null);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [message, setMessage] = useState("");

  const loadDetail = async (accessToken: string) => {
    if (!routineId) {
      return;
    }
    const data = await apiRequest<RoutineDetail>(`/routines/marketplace/${routineId}`, {}, accessToken);
    setItem(data);
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadDetail(token).catch((error) =>
      setMessage(error instanceof Error ? error.message : "No se pudo cargar detalle")
    );
  }, [token, routineId]);

  const cloneRoutine = async () => {
    if (!token || !item) {
      return;
    }
    try {
      await apiRequest(`/routines/${item.id}/clone`, { method: "POST" }, token);
      setMessage("Rutina guardada en tus rutinas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo clonar");
    }
  };

  const sendReview = async () => {
    if (!token || !item) {
      return;
    }
    try {
      const updated = await apiRequest<RoutineDetail>(
        `/routines/${item.id}/reviews`,
        { method: "POST", body: JSON.stringify({ rating, review }) },
        token
      );
      setItem(updated);
      setMessage("Review enviada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar review");
    }
  };

  const followCoach = async () => {
    if (!token || !item) {
      return;
    }
    const coachId = item.owner?.id;
    if (!coachId) {
      setMessage("No se encontró coach para seguir.");
      return;
    }
    try {
      await apiRequest(`/routines/coach/${coachId}/follow`, { method: "POST" }, token);
      setMessage("Ahora sigues a este coach.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo seguir al coach");
    }
  };

  if (loading) {
    return <p className="axion-loading">Cargando rutina...</p>;
  }

  return (
    <main className="axion-shell">
      <div className="axion-content">
        <div className="axion-container axion-page">
          <section className="axion-hero">
            <h1>{item?.marketplace_title ?? item?.name ?? "Marketplace"}</h1>
            <p>{item?.marketplace_description ?? item?.description ?? "Detalle de rutina pública."}</p>
            <div className="axion-actions" style={{ marginTop: 14 }}>
              <Link className="axion-button axion-button-secondary" href="/marketplace">
                Volver
              </Link>
              <button className="axion-button axion-button-primary" onClick={() => void cloneRoutine()}>
                Guardar a mis rutinas
              </button>
            </div>
          </section>
          <section className="axion-card">
            {message ? <p className="axion-muted">{message}</p> : null}
            <p className="axion-muted">
              Creada por: {item?.owner_name ?? "N/A"} • Rating: {(item?.rating_average ?? 0).toFixed(1)} (
              {item?.rating_count ?? 0})
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="axion-button axion-button-secondary" onClick={() => void followCoach()}>
                Seguir coach
              </button>
              {item?.owner?.id ? (
                <Link className="axion-button axion-button-secondary" href={`/marketplace/coach/${item.owner.id}`}>
                  Ver perfil coach
                </Link>
              ) : null}
            </div>
            <h3 style={{ marginTop: 14 }}>Preview</h3>
            {(item?.days ?? []).map((day) => (
              <article key={day.id} className="axion-card" style={{ padding: 12, marginBottom: 10 }}>
                <strong>{day.day_label}</strong>
                <ul>
                  {day.groups.map((group) => (
                    <li key={group.id}>
                      {group.type}:{" "}
                      {group.exercises
                        .map((exercise) => exercise.exercise?.name ?? "Ejercicio")
                        .join(" / ")}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="axion-card">
            <h2>Tu valoración</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="axion-input"
                type="number"
                min={1}
                max={5}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              />
              <input
                className="axion-input"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Reseña corta"
              />
              <button className="axion-button axion-button-secondary" onClick={() => void sendReview()}>
                Enviar
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
