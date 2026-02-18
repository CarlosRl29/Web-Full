"use client";

import { useEffect, useState } from "react";
import { apiRequest, loadTokens } from "./api";

export type MeProfile = {
  id: string;
  email: string;
  full_name: string;
  role: "USER" | "COACH" | "ADMIN";
  preferred_modes: Array<"USER" | "COACH">;
  active_mode: "USER" | "COACH";
  goal: "STRENGTH" | "HYPERTROPHY" | "MIXED" | null;
  experience_level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  days_per_week: number | null;
  session_minutes: number | null;
  injuries: string | null;
  equipment: string[];
  active_routine_id: string | null;
};

export function useAppAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const tokens = loadTokens();
      if (!tokens?.access_token) {
        window.location.href = "/login";
        return;
      }
      try {
        const profile = await apiRequest<MeProfile>("/auth/me", {}, tokens.access_token);
        setToken(tokens.access_token);
        setMe(profile);
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { token, me, loading, setMe };
}
