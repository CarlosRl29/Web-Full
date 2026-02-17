import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from "react-native";

const REST_DONE_CHANNEL_ID = "rest-timer";

const NOTIFICATION_ID = "rest-timer-done";

// Short bell/chime - use local asset from assets/sounds/rest-done.mp3
const REST_DONE_SOUND = require("../../assets/sounds/rest-done.mp3");

function formatMmSs(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  label: "Transicion" | "Descanso";
  seconds: number;
  onDone: () => void;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.HIGH
  })
});

export function RestTimer({ label, seconds, onDone }: Props) {
  const endAtRef = useRef(Date.now() + seconds * 1000);
  const [display, setDisplay] = useState(formatMmSs(endAtRef.current - Date.now()));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const completedRef = useRef(false);

  const cancelNotification = useCallback(async () => {
    try {
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
    } catch {
      // ignore
    }
  }, []);

  const scheduleNotification = useCallback(
    async (triggerAt: number) => {
      await cancelNotification();
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync(REST_DONE_CHANNEL_ID, {
            name: "Rest Timer",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 200, 100, 200],
            sound: "default"
          });
        }
        await Notifications.scheduleNotificationAsync({
          identifier: NOTIFICATION_ID,
          content: {
            title: "Descanso terminado",
            body: `${label} completado. ¡Siguiente ejercicio!`,
            sound: true
          },
          trigger: {
            date: new Date(triggerAt),
            channelId: Platform.OS === "android" ? REST_DONE_CHANNEL_ID : undefined
          }
        });
      } catch {
        // ignore
      }
    },
    [cancelNotification, label]
  );

  const playSoundAndVibrate = useCallback(async () => {
    if (Platform.OS !== "web") {
      Vibration.vibrate([0, 200, 100, 200]);
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        REST_DONE_SOUND,
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinishAndNotJustSeek) {
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch {
      // fallback: vibration only
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        await scheduleNotification(endAtRef.current);
      }
    })();
    return () => {
      cancelNotification();
    };
  }, [scheduleNotification, cancelNotification]);

  useEffect(() => {
    const tick = () => {
      if (completedRef.current) return;
      const remaining = endAtRef.current - Date.now();
      if (remaining <= 0) {
        completedRef.current = true;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        playSoundAndVibrate();
        onDone();
        return;
      }
      setDisplay(formatMmSs(remaining));
    };

    tick();
    intervalRef.current = setInterval(tick, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      soundRef.current?.unloadAsync();
    };
  }, [onDone, playSoundAndVibrate]);

  const handleSkip = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    endAtRef.current = Date.now();
    cancelNotification();
    playSoundAndVibrate();
    onDone();
  };

  const handleAdd15s = () => {
    endAtRef.current += 15000;
    scheduleNotification(endAtRef.current);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.time}>{display}</Text>
      <View style={styles.row}>
        <Pressable onPress={handleSkip} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Skip</Text>
        </Pressable>
        <Pressable onPress={handleAdd15s} style={styles.primaryBtn}>
          <Text style={styles.primaryText}>+15s</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#1e293b",
    padding: 14,
    borderRadius: 12,
    marginTop: 12
  },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
  time: { color: "#22d3ee", fontSize: 30, fontWeight: "800", marginTop: 6 },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 12,
    borderRadius: 8
  },
  secondaryText: { textAlign: "center", color: "#cbd5e1", fontWeight: "700" },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#0ea5e9",
    paddingVertical: 12,
    borderRadius: 8
  },
  primaryText: { textAlign: "center", color: "#082f49", fontWeight: "800" }
});
