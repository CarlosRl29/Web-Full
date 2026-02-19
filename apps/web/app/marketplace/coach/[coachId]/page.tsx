"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../../lib/api";
import { useAppAuth } from "../../../../lib/useAppAuth";
import { useToast } from "../../../../components/ToastProvider";

type CoachProfileResponse = {
  coach: {
    id: string;
    full_name: string;
    bio: string;
    specialty: string;
  };
  stats: {
    rating_average: number;
    rating_count: number;
    public_routines_count: number;
  };
  routines: Array<{
    id: string;
    name: string;
    marketplace_title?: string | null;
    marketplace_goal?: string | null;
    marketplace_level?: string | null;
    marketplace_days_per_week?: number | null;
    marketplace_description?: string | null;
    rating_average: number;
    rating_count: number;
  }>;
  is_following: boolean;
};

export default function MarketplaceCoachProfilePage() {
  const params = useParams<{ coachId: string }>();
  const coachId = params?.coachId ?? "";
  const { token, loading } = useAppAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<CoachProfileResponse | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !coachId) {
      return;
    }
    void apiRequest<CoachProfileResponse>(`/coach/public/${coachId}`, {}, token)
      .then(setData)
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "No se pudo cargar el perfil");
      });
  }, [coachId, token]);

  const followCoach = async () => {
    if (!token || !coachId) {
      return;
    }
    try {
      await apiRequest(`/routines/coach/${coachId}/follow`, { method: "POST" }, token);
      showToast("success", "Ahora sigues a este coach.");
      if (data) {
        setData({ ...data, is_following: true });
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "No se pudo seguir al coach";
      setMessage(text);
      showToast("error", text);
    }
  };

  if (loading) {
    return <p className="axion-loading">Cargando perfil del coach...</p>;
  }

  return (
    <main className="axion-shell">
      <div className="axion-content">
        <div className="axion-container axion-page">
          <section className="axion-hero">
            <h1>{data?.coach.full_name ?? "Perfil de coach"}</h1>
            <p>{data?.coach.bio ?? "Conoce el enfoque y rutinas públicas de este coach."}</p>
            <div className="axion-actions" style={{ marginTop: 12 }}>
              <Link href="/marketplace" className="axion-button axion-button-secondary">
                Volver a marketplace
              </Link>
              <button className="axion-button axion-button-primary" onClick={() => void followCoach()}>
                {data?.is_following ? "Siguiendo" : "Seguir coach"}
              </button>
            </div>
          </section>

          <section className="axion-card">
            {message ? <p className="axion-muted">{message}</p> : null}
            <p className="axion-muted">
              Especialidad: {data?.coach.specialty ?? "MIXED"} • Rating promedio:{" "}
              {(data?.stats.rating_average ?? 0).toFixed(1)} ({data?.stats.rating_count ?? 0} reviews)
            </p>
            <p className="axion-muted">
              Rutinas públicas: {data?.stats.public_routines_count ?? 0}
            </p>
          </section>

          <section className="axion-card">
            <h2>Rutinas públicas</h2>
            {(data?.routines ?? []).length === 0 ? (
              <div className="axion-empty">
                <strong>Este coach aún no publica rutinas.</strong>
              </div>
            ) : (
              <ul className="axion-list">
                {data?.routines.map((routine) => (
                  <li key={routine.id} className="axion-list-item" style={{ alignItems: "flex-start" }}>
                    <div>
                      <strong>{routine.marketplace_title ?? routine.name}</strong>
                      <p className="axion-muted">
                        {routine.marketplace_goal ?? "General"} • {routine.marketplace_level ?? "N/A"} •{" "}
                        {routine.marketplace_days_per_week ?? "-"} días/semana
                      </p>
                      <p className="axion-muted">
                        Rating: {routine.rating_average.toFixed(1)} ({routine.rating_count})
                      </p>
                    </div>
                    <Link className="axion-button axion-button-secondary" href={`/marketplace/${routine.id}`}>
                      Ver detalle
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
