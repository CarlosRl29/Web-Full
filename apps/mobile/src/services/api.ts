import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LoginInput,
  RefreshInput,
  StartSessionInput,
  UpdateProgressInput
} from "@gym/shared";
import { ActiveSession, Routine } from "../types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api";
const TOKENS_KEY = "@gym/auth-tokens";

type ApiResponse<T> = { success: boolean; data: T };

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

type RequestOptions = RequestInit & {
  requiresAuth?: boolean;
  skipRefresh?: boolean;
};

let refreshPromise: Promise<AuthTokens | null> | null = null;

function normalizeErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const maybeMessage = (payload as { message?: unknown }).message;
  if (typeof maybeMessage === "string") {
    return maybeMessage;
  }
  if (Array.isArray(maybeMessage) && maybeMessage.length > 0) {
    return String(maybeMessage[0]);
  }
  return fallback;
}

async function parseApiBody<T>(response: Response): Promise<ApiResponse<T> | null> {
  const raw = await response.text();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ApiResponse<T>;
  } catch {
    return null;
  }
}

export async function getAuthTokens(): Promise<AuthTokens | null> {
  const value = await AsyncStorage.getItem(TOKENS_KEY);
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as AuthTokens;
  } catch {
    return null;
  }
}

export async function saveAuthTokens(tokens: AuthTokens): Promise<void> {
  await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export async function clearAuthTokens(): Promise<void> {
  await AsyncStorage.removeItem(TOKENS_KEY);
}

async function refreshTokens(): Promise<AuthTokens | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const current = await getAuthTokens();
    if (!current?.refresh_token) {
      return null;
    }

    try {
      const nextTokens = await request<AuthTokens>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({
          refresh_token: current.refresh_token
        } satisfies RefreshInput),
        requiresAuth: false,
        skipRefresh: true
      });
      await saveAuthTokens(nextTokens);
      return nextTokens;
    } catch {
      await clearAuthTokens();
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { requiresAuth = true, skipRefresh = false, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string> | undefined)
  };

  if (requiresAuth) {
    const tokens = await getAuthTokens();
    if (!tokens?.access_token) {
      throw new Error("No hay sesion iniciada.");
    }
    headers.Authorization = `Bearer ${tokens.access_token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers
  });

  if (response.status === 401 && requiresAuth && !skipRefresh) {
    const refreshed = await refreshTokens();
    if (refreshed?.access_token) {
      return request<T>(path, {
        ...options,
        skipRefresh: true
      });
    }
    throw new Error("Sesion expirada. Inicia sesion nuevamente.");
  }

  const payload = await parseApiBody<T>(response);

  if (!response.ok || !payload?.success) {
    const message = normalizeErrorMessage(payload, "API request failed");
    throw new Error(message);
  }

  return payload.data;
}

export async function login(input: LoginInput): Promise<AuthTokens> {
  const tokens = await request<AuthTokens>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
    requiresAuth: false
  });
  await saveAuthTokens(tokens);
  return tokens;
}

export async function getRoutines(): Promise<Routine[]> {
  return request<Routine[]>("/routines");
}

export async function getActiveWorkoutSession(): Promise<ActiveSession | null> {
  return request<ActiveSession | null>("/workout-sessions/active");
}

export async function startWorkoutSession(input: StartSessionInput): Promise<ActiveSession> {
  return request<ActiveSession>("/workout-sessions/start", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function patchWorkoutProgress(input: UpdateProgressInput): Promise<ActiveSession> {
  return request<ActiveSession>("/workout-sessions/progress", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function finishWorkoutSession(sessionId: string): Promise<ActiveSession> {
  return request<ActiveSession>("/workout-sessions/finish", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId })
  });
}
