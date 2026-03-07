"use client";

import { Component, ReactNode } from "react";

type Props = { children: ReactNode };

type State = { hasError: boolean };

export class RoutineCreatorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("RoutineCreatorErrorBoundary:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="axion-card" style={{ maxWidth: 480, margin: "0 auto" }}>
          <h2>No se pudo abrir el creador</h2>
          <p className="axion-muted">
            Hubo un error al cargar el editor de rutinas. Intenta recargar la página o contacta soporte.
          </p>
          <button
            className="axion-button axion-button-primary"
            style={{ marginTop: 12 }}
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
