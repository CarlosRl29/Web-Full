"use client";

import { useState } from "react";
import Link from "next/link";
import { apiRequest, AuthTokens, saveTokens } from "../../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const onLogin = async () => {
    setMessage("");
    try {
      const tokens = await apiRequest<AuthTokens>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      saveTokens(tokens);
      const me = await apiRequest<{ role: string }>("/auth/me", {}, tokens.access_token);
      if (me.role !== "COACH" && me.role !== "ADMIN") {
        setMessage("Tu usuario no tiene rol de COACH/ADMIN.");
        return;
      }
      window.location.href = "/coach/routines";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesion");
    }
  };

  return (
    <main className="axion-shell">
      <header className="axion-topbar">
        <div className="axion-container axion-topbar-inner">
          <div className="axion-logo">AXION</div>
          <nav className="axion-nav">
            <Link className="axion-nav-link is-active" href="/login">Inicio</Link>
            <Link className="axion-nav-link" href="/coach/routines">Rutinas</Link>
            <Link className="axion-nav-link" href="/coach">Coach Panel</Link>
            <Link className="axion-nav-link" href="/coach/ai-logs">AI Logs</Link>
            <Link className="axion-nav-link" href="/coach/ai-metrics">AI Metrics</Link>
            <Link className="axion-nav-link" href="/coach/ai-alerts">Alerts</Link>
          </nav>
          <div className="axion-nav-right">
            <select className="axion-select" defaultValue="es" aria-label="Idioma">
              <option value="es">ES</option>
              <option value="en">EN</option>
            </select>
          </div>
        </div>
      </header>
      <section className="axion-content">
        <div className="axion-container axion-page">
          <div className="axion-hero">
            <h1>AXION</h1>
            <p>
              Controla rutinas, recomendaciones y observabilidad AI en una experiencia dark SaaS
              moderna.
            </p>
            <div className="axion-actions" style={{ marginTop: 18 }}>
              <button className="axion-button axion-button-primary" onClick={() => void onLogin()}>
                Entrar
              </button>
              <button
                className="axion-button axion-button-secondary"
                onClick={() => (window.location.href = "/coach/routines")}
              >
                Coach Panel
              </button>
            </div>
          </div>
          <section className="axion-card" style={{ maxWidth: 600, width: "100%", margin: "0 auto" }}>
            <input
              className={`axion-input${message ? " is-error" : ""}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              style={{ width: "100%", marginBottom: 10 }}
            />
            <input
              className={`axion-input${message ? " is-error" : ""}`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              style={{ width: "100%" }}
            />
            {message ? <p className="axion-error">{message}</p> : null}
          </section>
        </div>
      </section>
    </main>
  );
}
