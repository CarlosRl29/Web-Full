"use client";

function getApiBaseUrl(): string {
  if (typeof process.env.NEXT_PUBLIC_API_URL === "string" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001/api`;
  }
  return "http://localhost:3001/api";
}

const API_BASE_URL = getApiBaseUrl();
const TOKENS_KEY = "coach_tokens";

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok || !(payload && typeof payload === "object" && "success" in payload && (payload as { success?: boolean }).success)) {
    const p = payload as { error?: { message?: string | string[] } };
    const msg =
      p?.error && typeof p.error === "object" && "message" in p.error
        ? Array.isArray(p.error.message)
          ? p.error.message[0]
          : p.error.message
        : "API request failed";
    const err = new Error(typeof msg === "string" ? msg : "API request failed") as Error & {
      response?: { data: unknown; status: number };
    };
    err.response = { data: payload, status: response.status };
    throw err;
  }
  return (payload as unknown as { data: T }).data as T;
}

export function loadTokens(): AuthTokens | null {
  const raw = localStorage.getItem(TOKENS_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: AuthTokens): void {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem(TOKENS_KEY);
}
