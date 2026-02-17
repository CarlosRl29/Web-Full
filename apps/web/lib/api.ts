"use client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
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

  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? payload?.message ?? "API request failed");
  }
  return payload.data as T;
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
