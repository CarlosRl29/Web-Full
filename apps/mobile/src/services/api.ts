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

export async function getActiveRoutine(): Promise<Routine | null> {
  return request<Routine | null>("/routines/active");
}

export async function getRoutineDetail(id: string): Promise<Routine> {
  return request<Routine>(`/routines/${id}`);
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

export type SwapReason =
  | "EQUIPMENT_BUSY"
  | "NOT_AVAILABLE"
  | "PAIN"
  | "PREFERENCE"
  | "TOO_HARD";

export type ReplacementOption = {
  id: string;
  display_name: string;
  equipment: string | null;
  explanation: string;
  score: number;
};

export async function getReplacements(
  workoutId: string,
  workoutExerciseId: string,
  query: {
    reason?: SwapReason;
    locale?: "es" | "en";
    available_equipment?: string;
    blocked_equipment?: string;
  } = {}
): Promise<ReplacementOption[]> {
  const params = new URLSearchParams();
  if (query.reason) params.set("reason", query.reason);
  if (query.locale) params.set("locale", query.locale);
  if (query.available_equipment) params.set("available_equipment", query.available_equipment);
  if (query.blocked_equipment) params.set("blocked_equipment", query.blocked_equipment);
  const qs = params.toString();
  return request<ReplacementOption[]>(
    `/workout-sessions/${workoutId}/exercises/${workoutExerciseId}/replacements${qs ? `?${qs}` : ""}`
  );
}

export type ProgressOverview = {
  sessionsCount: number;
  volumeTotal: number;
  adherence: number;
  windowDays: number;
};

export type MusclesResponse = {
  effective: Record<string, number>;
  targets: Record<string, { min: number; max: number }>;
};

export type ExerciseTrend = {
  exerciseId: string;
  exerciseName: string;
  e1rmBest: number | null;
  e1rmTrend: number[];
  volumeTrend: number[];
  lastSessions: Array<{ weight: number; reps: number }>;
  lastPerformedAt: string | null;
  nextSuggestion?: { type: string; value?: number };
};

export type TrainingPlan = {
  id: string;
  goal: string;
  priority_area: string;
  weeks_total: number;
  start_date: string;
  milestones?: unknown;
} | null;

export type ExerciseListItem = {
  id: string;
  name: string;
  display_name?: string;
  canonical_slug?: string | null;
  primary_muscle_label?: string | null;
  primary_submuscle_label?: string | null;
  instructions?: string | null;
  image_url?: string | null;
};

export type FilterOptions = {
  muscles: Array<{ value: string; label: string }>;
  submuscles: Array<{ value: string; label: string }>;
  types: Array<{ value: string; label: string }>;
};

export async function getFilterOptions(): Promise<FilterOptions> {
  return request<FilterOptions>("/exercises/filter-options");
}

export async function getProgressOverview(days?: number): Promise<ProgressOverview> {
  const qs = days != null ? `?days=${days}` : "";
  return request<ProgressOverview>(`/progress/overview${qs}`);
}

export async function getProgressMuscles(days?: number): Promise<MusclesResponse> {
  const params = new URLSearchParams();
  params.set("includeTargets", "true");
  if (days != null) params.set("days", String(days));
  return request<MusclesResponse>(`/progress/muscles?${params.toString()}`);
}

export async function getProgressExercise(exerciseId: string, limit?: number): Promise<ExerciseTrend | null> {
  const qs = limit != null ? `?limit=${limit}` : "";
  return request<ExerciseTrend | null>(`/progress/exercise/${exerciseId}${qs}`);
}

export async function getCurrentPlan(): Promise<TrainingPlan> {
  return request<TrainingPlan>("/plans/current");
}

export type CheckInStatus = { created_at: string } | null;

export type CheckInResult = {
  id: string;
  readinessModifier: number;
  blockVolumeIncreases: boolean;
  adjustments: string[];
};

export async function getCheckInStatus(): Promise<CheckInStatus> {
  return request<CheckInStatus>("/progress/checkin/status");
}

export async function submitCheckIn(body: {
  fatigue: number;
  pain_location: string;
  sleep_quality: string;
  difficulty: string;
}): Promise<CheckInResult> {
  return request<CheckInResult>("/progress/checkin", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function getExercises(params: {
  search?: string;
  limit?: number;
  muscle?: string;
  locale?: "es" | "en";
} = {}): Promise<ExerciseListItem[]> {
  const p = new URLSearchParams();
  if (params.search) p.set("search", params.search);
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.muscle) p.set("muscle", params.muscle);
  if (params.locale) p.set("locale", params.locale);
  const qs = p.toString();
  return request<ExerciseListItem[]>(`/exercises${qs ? `?${qs}` : ""}`);
}

export async function swapExercise(
  workoutId: string,
  workoutExerciseId: string,
  body: {
    replacement_exercise_id: string;
    reason: SwapReason;
    save_preference: boolean;
  }
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(
    `/workout-sessions/${workoutId}/exercises/${workoutExerciseId}/swap`,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
}
