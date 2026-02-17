import AsyncStorage from "@react-native-async-storage/async-storage";
import { UpdateProgressInput } from "@gym/shared";

const QUEUE_KEY = "@gym/offline-queue";
const BACKOFF_STEPS_MS = [1000, 2000, 5000, 10000, 30000];

export type QueueStatus = "pending" | "sending" | "acked" | "failed";

export type QueueItem = {
  event_id: string;
  created_at: string;
  updated_at: string;
  status: QueueStatus;
  attempts: number;
  last_error?: string;
  next_retry_at?: string;
  type: "PATCH_PROGRESS";
  payload: UpdateProgressInput;
};

function normalizeQueueItem(raw: unknown): QueueItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const item = raw as Partial<QueueItem>;
  if (!item.event_id || !item.created_at || !item.type || !item.payload) {
    return null;
  }
  return {
    event_id: item.event_id,
    created_at: item.created_at,
    updated_at: item.updated_at ?? item.created_at,
    status: item.status ?? "pending",
    attempts: Number.isFinite(item.attempts) ? Number(item.attempts) : 0,
    last_error: item.last_error,
    next_retry_at: item.next_retry_at,
    type: item.type,
    payload: item.payload
  };
}

export function createQueueItem(payload: UpdateProgressInput, eventId: string): QueueItem {
  const nowIso = new Date().toISOString();
  return {
    event_id: eventId,
    created_at: nowIso,
    updated_at: nowIso,
    status: "pending",
    attempts: 0,
    type: "PATCH_PROGRESS",
    payload
  };
}

export function getBackoffMs(attempts: number): number {
  if (attempts <= 0) {
    return BACKOFF_STEPS_MS[0];
  }
  return BACKOFF_STEPS_MS[Math.min(attempts - 1, BACKOFF_STEPS_MS.length - 1)];
}

export function shouldRetryNow(item: QueueItem, now: number, ignoreBackoff = false): boolean {
  if (item.status === "pending") {
    return true;
  }
  if (item.status !== "failed") {
    return false;
  }
  if (ignoreBackoff || !item.next_retry_at) {
    return true;
  }
  return new Date(item.next_retry_at).getTime() <= now;
}

export function toShortErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 120);
  }
  const fallback = String(error ?? "sync_error");
  return fallback.slice(0, 120);
}

export async function enqueue(item: QueueItem): Promise<void> {
  const current = await getQueue();
  current.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(current));
}

export async function getQueue(): Promise<QueueItem[]> {
  const value = await AsyncStorage.getItem(QUEUE_KEY);
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeQueueItem(item))
      .filter((item): item is QueueItem => item !== null);
  } catch {
    return [];
  }
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function replaceQueue(items: QueueItem[]): Promise<void> {
  if (items.length === 0) {
    await clearQueue();
    return;
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}
