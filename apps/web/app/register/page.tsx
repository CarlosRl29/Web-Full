"use client";

import { useState } from "react";
import Link from "next/link";
import { apiRequest, AuthTokens, saveTokens } from "../../lib/api";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [intendedMode, setIntendedMode] = useState<"USER" | "COACH" | "AMBAS">("USER");
  const [message, setMessage] = useState("");

  const onRegister = async () => {
    setMessage("");
    try {
      const tokens = await apiRequest<AuthTokens>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          intended_mode: intendedMode
        })
      });
      saveTokens(tokens);
      window.location.href = "/app/routines";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar");
    }
  };

  return (
    <main className="axion-shell">
      <section className="axion-content">
        <div className="axion-container axion-page">
          <section className="axion-hero">
            <h1>Crear cuenta</h1>
            <p>¿Para qué quieres usar AXION? Puedes cambiar tu modo activo en perfil.</p>
          </section>
          <section className="axion-card" style={{ maxWidth: 640, width: "100%", margin: "0 auto" }}>
            <input className="axion-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre completo" style={{ width: "100%", marginBottom: 10 }} />
            <input className="axion-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ width: "100%", marginBottom: 10 }} />
            <input className="axion-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" style={{ width: "100%", marginBottom: 10 }} />
            <select className="axion-select" value={intendedMode} onChange={(e) => setIntendedMode(e.target.value as any)} style={{ width: "100%", marginBottom: 10 }}>
              <option value="USER">USER</option>
              <option value="COACH">COACH</option>
              <option value="AMBAS">AMBAS</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="axion-button axion-button-primary" onClick={() => void onRegister()}>
                Registrar
              </button>
              <Link className="axion-button axion-button-secondary" href="/login">
                Volver al login
              </Link>
            </div>
            {message ? <p className="axion-error">{message}</p> : null}
          </section>
        </div>
      </section>
    </main>
  );
}
