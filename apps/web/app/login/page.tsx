"use client";

import { useState } from "react";
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
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 560 }}>
      <h1>Coach Panel Login</h1>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        style={{ width: "100%", padding: 8, marginBottom: 8 }}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        style={{ width: "100%", padding: 8, marginBottom: 8 }}
      />
      <button onClick={() => void onLogin()}>Entrar</button>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
