"use client";

import { RoutineBuilder } from "../../../../components/builder/RoutineBuilder";
import { RoutineCreatorErrorBoundary } from "../../../../components/RoutineCreatorErrorBoundary";
import { useAppAuth } from "../../../../lib/useAppAuth";

export default function NewRoutinePage() {
  const { token, loading } = useAppAuth();

  if (loading) {
    return <p className="axion-loading">Cargando creador de rutinas...</p>;
  }
  if (!token) {
    return <p className="axion-loading">Validando sesión...</p>;
  }

  return (
    <RoutineCreatorErrorBoundary>
      <RoutineBuilder token={token} />
    </RoutineCreatorErrorBoundary>
  );
}
