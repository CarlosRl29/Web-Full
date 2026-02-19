import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { StartSessionInput, UpdateProgressInput } from "@gym/shared";
import {
  QueueItem,
  createQueueItem,
  enqueue,
  getBackoffMs,
  getQueue,
  replaceQueue,
  shouldRetryNow,
  toShortErrorMessage
} from "../services/offline-queue";
import {
  finishWorkoutSession,
  getActiveWorkoutSession,
  patchWorkoutProgress,
  startWorkoutSession
} from "../services/api";
import { ActiveSession, Pointer, RoutineDay } from "../types";

const SESSION_KEY = "@gym/active-session";

function generateEventId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function buildExerciseMetaMap(day: RoutineDay): Record<
  string,
  { name: string; description?: string | null; media_url?: string | null }
> {
  return day.groups.reduce<Record<string, { name: string; description?: string | null; media_url?: string | null }>>((acc, group) => {
    group.exercises.forEach((exercise) => {
      acc[exercise.id] = {
        name: exercise.exercise.name,
        description: exercise.exercise.instructions ?? null,
        media_url:
          exercise.exercise.video_url ??
          exercise.exercise.image_url ??
          exercise.exercise.media_url ??
          null
      };
    });
    return acc;
  }, {});
}

function hydrateSessionExerciseMeta(
  session: ActiveSession,
  exerciseMetaBySourceId?: Record<
    string,
    { name: string; description?: string | null; media_url?: string | null }
  >
): ActiveSession {
  if (!exerciseMetaBySourceId) {
    return session;
  }
  return {
    ...session,
    workout_groups: session.workout_groups.map((group) => ({
      ...group,
      workout_items: group.workout_items.map((item) => ({
        ...item,
        exercise_name:
          exerciseMetaBySourceId[item.source_group_exercise_id]?.name ?? item.exercise_name,
        exercise_description:
          exerciseMetaBySourceId[item.source_group_exercise_id]?.description ??
          item.exercise_description,
        exercise_media_url:
          exerciseMetaBySourceId[item.source_group_exercise_id]?.media_url ??
          item.exercise_media_url
      }))
    }))
  };
}

export function useWorkoutSession() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const syncInFlightRef = useRef(false);

  const pendingCount = useMemo(
    () =>
      queueItems.filter(
        (event) => event.status === "pending" || event.status === "failed"
      ).length,
    [queueItems]
  );

  const queuePreview = useMemo(
    () => queueItems.slice(-10).reverse(),
    [queueItems]
  );

  useEffect(() => {
    (async () => {
      const initialQueue = await getQueue();
      setQueueItems(initialQueue);

      const netState = await NetInfo.fetch();
      setIsOnline(Boolean(netState.isConnected));

      const value = await AsyncStorage.getItem(SESSION_KEY);
      let localSession: ActiveSession | null = null;
      if (value) {
        localSession = JSON.parse(value) as ActiveSession;
        setActiveSession(localSession);
      }

      try {
        const remoteActive = await getActiveWorkoutSession();
        if (!localSession && remoteActive) {
          setActiveSession(remoteActive);
          await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(remoteActive));
        }
        // Conflict local vs API: prefer local while offline or while queue has pending events.
        if (
          localSession &&
          remoteActive &&
          Boolean(netState.isConnected) &&
          initialQueue.length === 0
        ) {
          setActiveSession(remoteActive);
          await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(remoteActive));
        }
      } catch {
        // Ignore boot fetch errors (offline/expired token).
      }
      setIsBooting(false);
    })();
  }, []);

  const persistSession = useCallback(async (session: ActiveSession | null) => {
    if (!session) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return;
    }
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, []);

  const startSession = useCallback(
    async (payload: StartSessionInput, selectedDay: RoutineDay) => {
      const remoteSession = await startWorkoutSession(payload);
      const nextSession = hydrateSessionExerciseMeta(
        remoteSession,
        buildExerciseMetaMap(selectedDay)
      );
      setActiveSession(nextSession);
      await persistSession(nextSession);
    },
    [persistSession]
  );

  const syncQueueState = useCallback(async () => {
    const next = await getQueue();
    setQueueItems(next);
    return next;
  }, []);

  const persistQueueState = useCallback(async (next: QueueItem[]) => {
    await replaceQueue(next);
    setQueueItems(next);
  }, []);

  const enqueueProgress = useCallback(
    async (payload: UpdateProgressInput) => {
      const item = createQueueItem(payload, payload.event_id ?? generateEventId());
      await enqueue(item);
      await syncQueueState();
    },
    [syncQueueState]
  );

  const savePointer = useCallback(
    async (pointer: Pointer) => {
      if (!activeSession) {
        return;
      }
      const next = { ...activeSession, current_pointer: pointer };
      setActiveSession(next);
      await persistSession(next);

      const payload: UpdateProgressInput = {
        event_id: generateEventId(),
        current_pointer: pointer
      };
      if (isOnline) {
        try {
          const updated = await patchWorkoutProgress(payload);
          setActiveSession(updated);
          await persistSession(updated);
        } catch {
          await enqueueProgress(payload);
        }
      } else {
        await enqueueProgress(payload);
      }
    },
    [activeSession, enqueueProgress, isOnline, persistSession]
  );

  const saveSet = useCallback(
    async (setPayload: UpdateProgressInput["set_update"]) => {
      if (!activeSession || !setPayload) {
        return;
      }

      const next = {
        ...activeSession,
        workout_groups: activeSession.workout_groups.map((group) => ({
          ...group,
          workout_items: group.workout_items.map((item) => {
            if (item.id !== setPayload.workout_exercise_item_id) {
              return item;
            }
            return {
              ...item,
              sets: item.sets.map((set) =>
                set.set_number === setPayload.set_number
                  ? {
                      ...set,
                      weight: setPayload.weight ?? set.weight,
                      reps: setPayload.reps ?? set.reps,
                      rpe: setPayload.rpe ?? set.rpe,
                      is_done: setPayload.is_done
                    }
                  : set
              )
            };
          })
        }))
      };

      setActiveSession(next);
      await persistSession(next);

      const payload: UpdateProgressInput = {
        event_id: generateEventId(),
        set_update: setPayload
      };
      if (isOnline) {
        try {
          const updated = await patchWorkoutProgress(payload);
          setActiveSession(updated);
          await persistSession(updated);
        } catch {
          await enqueueProgress(payload);
        }
      } else {
        await enqueueProgress(payload);
      }
    },
    [activeSession, enqueueProgress, isOnline, persistSession]
  );

  const finishSession = useCallback(async () => {
    if (!activeSession) {
      return;
    }
    try {
      await finishWorkoutSession(activeSession.id);
    } catch {
      // No-op: si está offline, ya queda localmente terminada.
    }
    setActiveSession(null);
    await persistSession(null);
  }, [activeSession, persistSession]);

  const resetLocalSession = useCallback(async () => {
    setActiveSession(null);
    await persistSession(null);
  }, [persistSession]);

  const flushQueue = useCallback(
    async ({
      onlyFailed = false,
      ignoreBackoff = false
    }: {
      onlyFailed?: boolean;
      ignoreBackoff?: boolean;
    } = {}) => {
      if (!isOnline || syncInFlightRef.current) {
        return;
      }
      syncInFlightRef.current = true;
      setIsSyncing(true);
      try {
        const queue = await syncQueueState();
        if (queue.length === 0) {
          return;
        }

        const working = [...queue];
        let lastSnapshot: ActiveSession | null = null;
        const now = Date.now();

        for (let i = 0; i < working.length; i += 1) {
          const item = working[i];
          if (item.type !== "PATCH_PROGRESS") {
            continue;
          }
          if (onlyFailed && item.status !== "failed") {
            continue;
          }
          if (!onlyFailed && item.status !== "pending" && item.status !== "failed") {
            continue;
          }
          if (!shouldRetryNow(item, now, ignoreBackoff)) {
            continue;
          }

          const sendingItem: QueueItem = {
            ...item,
            status: "sending",
            updated_at: new Date().toISOString(),
            last_error: undefined
          };
          working[i] = sendingItem;
          await persistQueueState(working);

          try {
            const snapshot = await patchWorkoutProgress(item.payload);
            lastSnapshot = snapshot;
            // acked -> remove from persisted queue
            working.splice(i, 1);
            i -= 1;
            await persistQueueState(working);
          } catch (error) {
            const attempts = item.attempts + 1;
            const failedItem: QueueItem = {
              ...item,
              status: "failed",
              attempts,
              last_error: toShortErrorMessage(error),
              updated_at: new Date().toISOString(),
              next_retry_at: new Date(Date.now() + getBackoffMs(attempts)).toISOString()
            };
            working[i] = failedItem;
            await persistQueueState(working);
          }
        }

        if (lastSnapshot) {
          setActiveSession(lastSnapshot);
          await persistSession(lastSnapshot);
        }
      } catch {
        // Mantener cola intacta ante fallo de red/intermitencia.
      } finally {
        syncInFlightRef.current = false;
        setIsSyncing(false);
      }
    },
    [isOnline, persistQueueState, persistSession, syncQueueState]
  );

  const reconcileWithServer = useCallback(async () => {
    if (!isOnline) {
      return;
    }
    const queue = await syncQueueState();
    if (queue.length > 0) {
      // Prefer local while pending events exist.
      return;
    }
    try {
      const remoteActive = await getActiveWorkoutSession();
      if (!remoteActive) {
        return;
      }
      setActiveSession((current) => {
        if (!current) {
          void persistSession(remoteActive);
          return remoteActive;
        }
        const currentStr = JSON.stringify(current);
        const remoteStr = JSON.stringify(remoteActive);
        if (currentStr !== remoteStr) {
          void persistSession(remoteActive);
          return remoteActive;
        }
        return current;
      });
    } catch {
      // Keep local if server unavailable.
    }
  }, [isOnline, persistSession, syncQueueState]);

  useEffect(() => {
    const subscription = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected);
      setIsOnline(online);
      if (online) {
        void (async () => {
          await flushQueue({ ignoreBackoff: true });
          await reconcileWithServer();
        })();
      }
    });
    return () => subscription();
  }, [flushQueue, reconcileWithServer]);

  useEffect(() => {
    if (!isOnline || queueItems.length === 0) {
      return;
    }
    const timer = setInterval(() => {
      void flushQueue();
    }, 1000);
    return () => clearInterval(timer);
  }, [flushQueue, isOnline, queueItems.length]);

  const forceSync = useCallback(async () => {
    await flushQueue({ ignoreBackoff: true });
    await reconcileWithServer();
  }, [flushQueue, reconcileWithServer]);

  const retryFailed = useCallback(async () => {
    await flushQueue({ onlyFailed: true, ignoreBackoff: true });
    await reconcileWithServer();
  }, [flushQueue, reconcileWithServer]);

  return {
    activeSession,
    isBooting,
    isOnline,
    isSyncing,
    pendingCount,
    queuePreview,
    startSession,
    saveSet,
    savePointer,
    finishSession,
    resetLocalSession,
    forceSync,
    retryFailed
  };
}
