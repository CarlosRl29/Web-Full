import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { StartSessionInput, UpdateProgressInput } from "@gym/shared";
import { enqueue, getQueue, clearQueue } from "../services/offline-queue";
import {
  finishWorkoutSession,
  patchWorkoutProgress,
  startWorkoutSession
} from "../services/api";
import { ActiveSession, Pointer } from "../types";

const SESSION_KEY = "@gym/active-session";
const ACCESS_TOKEN = process.env.EXPO_PUBLIC_ACCESS_TOKEN ?? "demo-token";

const fallbackSession: ActiveSession = {
  id: "offline-demo",
  current_pointer: { group_index: 0, exercise_index: 0, set_index: 0, round_index: 0 },
  workout_groups: [
    {
      id: "wg-1",
      type: "SUPERSET_2",
      order_index: 0,
      rounds_total: 3,
      round_current: 1,
      rest_between_exercises_seconds: 20,
      rest_after_round_seconds: 90,
      rest_after_set_seconds: 0,
      workout_items: [
        {
          id: "we-a1",
          order_in_group: "A1",
          target_sets_total: 3,
          rep_range: "8-10",
          notes: "Tempo controlado",
          sets: [
            { id: "s1", set_number: 1, is_done: false },
            { id: "s2", set_number: 2, is_done: false },
            { id: "s3", set_number: 3, is_done: false }
          ]
        },
        {
          id: "we-a2",
          order_in_group: "A2",
          target_sets_total: 3,
          rep_range: "10-12",
          notes: "Sin balanceo",
          sets: [
            { id: "s4", set_number: 1, is_done: false },
            { id: "s5", set_number: 2, is_done: false },
            { id: "s6", set_number: 3, is_done: false }
          ]
        }
      ]
    }
  ]
};

export function useWorkoutSession() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY).then((value) => {
      if (value) {
        setActiveSession(JSON.parse(value) as ActiveSession);
      }
    });
  }, []);

  useEffect(() => {
    const subscription = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected);
      setIsOnline(online);
      if (online) {
        void flushQueue();
      }
    });
    return () => subscription();
  }, []);

  const persistSession = useCallback(async (session: ActiveSession | null) => {
    if (!session) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return;
    }
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, []);

  const startSession = useCallback(
    async (payload: StartSessionInput) => {
      let nextSession: ActiveSession;
      try {
        const remoteSession = await startWorkoutSession(payload, ACCESS_TOKEN);
        nextSession = remoteSession as ActiveSession;
      } catch {
        // Sprint 1 fallback: permite probar guided mode incluso sin API disponible.
        nextSession = fallbackSession;
      }

      setActiveSession(nextSession);
      await persistSession(nextSession);
    },
    [persistSession]
  );

  const savePointer = useCallback(
    async (pointer: Pointer) => {
      if (!activeSession) {
        return;
      }
      const next = { ...activeSession, current_pointer: pointer };
      setActiveSession(next);
      await persistSession(next);

      const payload: UpdateProgressInput = { current_pointer: pointer };
      if (isOnline) {
        try {
          await patchWorkoutProgress(payload, ACCESS_TOKEN);
        } catch {
          await enqueue({ type: "PATCH_PROGRESS", payload });
        }
      } else {
        await enqueue({ type: "PATCH_PROGRESS", payload });
      }
    },
    [activeSession, isOnline, persistSession]
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

      const payload: UpdateProgressInput = { set_update: setPayload };
      if (isOnline) {
        try {
          await patchWorkoutProgress(payload, ACCESS_TOKEN);
        } catch {
          await enqueue({ type: "PATCH_PROGRESS", payload });
        }
      } else {
        await enqueue({ type: "PATCH_PROGRESS", payload });
      }
    },
    [activeSession, isOnline, persistSession]
  );

  const finishSession = useCallback(async () => {
    if (!activeSession) {
      return;
    }
    try {
      await finishWorkoutSession(activeSession.id, ACCESS_TOKEN);
    } catch {
      // No-op: si está offline, ya queda localmente terminada.
    }
    setActiveSession(null);
    await persistSession(null);
  }, [activeSession, persistSession]);

  const flushQueue = useCallback(async () => {
    setIsSyncing(true);
    try {
      const queue = await getQueue();
      for (const item of queue) {
        if (item.type === "PATCH_PROGRESS") {
          await patchWorkoutProgress(item.payload as UpdateProgressInput, ACCESS_TOKEN);
        }
      }
      await clearQueue();
    } catch {
      // Mantener cola intacta ante fallo de red/intermitencia.
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    activeSession,
    isOnline,
    isSyncing,
    startSession,
    saveSet,
    savePointer,
    finishSession
  };
}
