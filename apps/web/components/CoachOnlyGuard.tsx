"use client";

import { ReactNode } from "react";
import { useAppAuth } from "../lib/useAppAuth";

type Props = { children: ReactNode };

export function CoachOnlyGuard({ children }: Props) {
  const { me, loading } = useAppAuth();

  if (loading) {
    return <p className="axion-loading">Cargando...</p>;
  }

  if (me?.role === "USER") {
    return (
      <section className="axion-page">
        <section className="axion-card" style={{ maxWidth: 480, margin: "0 auto" }}>
          <h1>Esta sección es para coaches</h1>
          <p className="axion-muted" style={{ marginTop: 12 }}>
            Las pantallas de operación AI (Logs, Métricas, Alertas) están disponibles solo para
            coaches y administradores.
          </p>
          <a className="axion-button axion-button-primary" href="/app" style={{ display: "inline-block", marginTop: 16 }}>
            Volver al inicio
          </a>
        </section>
      </section>
    );
  }

  return <>{children}</>;
}
