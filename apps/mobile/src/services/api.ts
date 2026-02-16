import { StartSessionInput, UpdateProgressInput } from "@gym/shared";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api";

type ApiResponse<T> = { success: boolean; data: T };

async function request<T>(
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

  const data = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !data.success) {
    throw new Error("API request failed");
  }
  return data.data;
}

export async function startWorkoutSession(
  input: StartSessionInput,
  token: string
): Promise<any> {
  return request("/workout-sessions/start", {
    method: "POST",
    body: JSON.stringify(input)
  }, token);
}

export async function patchWorkoutProgress(
  input: UpdateProgressInput,
  token: string
): Promise<any> {
  return request("/workout-sessions/progress", {
    method: "PATCH",
    body: JSON.stringify(input)
  }, token);
}

export async function finishWorkoutSession(sessionId: string, token: string): Promise<any> {
  return request("/workout-sessions/finish", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId })
  }, token);
}
