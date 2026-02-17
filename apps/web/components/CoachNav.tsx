"use client";

import Link from "next/link";
import { clearTokens } from "../lib/api";

export function CoachNav() {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #ddd",
        paddingBottom: 10,
        marginBottom: 16
      }}
    >
      <nav style={{ display: "flex", gap: 12 }}>
        <Link href="/coach/routines">Rutinas</Link>
        <Link href="/coach/assignments">Asignaciones</Link>
      </nav>
      <button
        onClick={() => {
          clearTokens();
          window.location.href = "/login";
        }}
      >
        Salir
      </button>
    </header>
  );
}
