"use client";

import { useEffect, useState } from "react";
import { apiRequest, loadTokens } from "./api";

export function useCoachAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const tokens = loadTokens();
      if (!tokens?.access_token) {
        window.location.href = "/login";
        return;
      }
      try {
        const me = await apiRequest<{ role: string }>("/auth/me", {}, tokens.access_token);
        if (me.role !== "COACH" && me.role !== "ADMIN") {
          window.location.href = "/login";
          return;
        }
        setToken(tokens.access_token);
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { token, loading };
}
