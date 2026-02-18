"use client";

import { RoutineBuilder } from "../../../../components/builder/RoutineBuilder";
import { useAppAuth } from "../../../../lib/useAppAuth";

export default function RoutineBuilderPage() {
  const { token, loading } = useAppAuth();

  if (loading) {
    return <p className="axion-loading">Cargando creador de rutinas...</p>;
  }

  if (!token) {
    return <p className="axion-loading">Validando sesión...</p>;
  }

  return <RoutineBuilder token={token} />;
}
