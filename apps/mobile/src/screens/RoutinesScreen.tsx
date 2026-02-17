import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getRoutines } from "../services/api";
import { Routine, RoutineDay } from "../types";

type Props = {
  onPickDay: (routine: Routine, day: RoutineDay) => void;
  onLogout: () => Promise<void>;
};

export function RoutinesScreen({ onPickDay, onLogout }: Props) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedRoutines = useMemo(
    () =>
      routines.map((routine) => ({
        ...routine,
        days: [...routine.days].sort((a, b) => a.order_index - b.order_index)
      })),
    [routines]
  );

  const loadRoutines = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const remote = await getRoutines();
      setRoutines(remote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar rutinas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRoutines();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Rutinas</Text>
        <Pressable
          onPress={async () => {
            setIsLoggingOut(true);
            try {
              await onLogout();
            } finally {
              setIsLoggingOut(false);
            }
          }}
          style={styles.logout}
          disabled={isLoggingOut}
        >
          <Text style={styles.logoutText}>{isLoggingOut ? "..." : "Salir"}</Text>
        </Pressable>
      </View>
      <Text style={styles.caption}>Selecciona una rutina y un dia para iniciar</Text>

      <View style={styles.actions}>
        <Pressable onPress={() => void loadRoutines()} style={styles.refresh}>
          <Text style={styles.refreshText}>Recargar</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#22d3ee" />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : sortedRoutines.length === 0 ? (
        <Text style={styles.caption}>No hay rutinas disponibles para este usuario.</Text>
      ) : (
        sortedRoutines.map((routine) => (
          <View key={routine.id} style={styles.card}>
            <Text style={styles.routineName}>{routine.name}</Text>
            {routine.description ? (
              <Text style={styles.routineDescription}>{routine.description}</Text>
            ) : null}

            {routine.days.map((day) => (
              <Pressable
                key={day.id}
                style={styles.dayBtn}
                onPress={() => onPickDay(routine, day)}
              >
                <Text style={styles.dayBtnText}>{day.day_label}</Text>
              </Pressable>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "700" },
  caption: { color: "#94a3b8" },
  actions: { marginTop: 8, marginBottom: 10 },
  refresh: {
    alignSelf: "flex-start",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  refreshText: { color: "#cbd5e1", fontWeight: "700" },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 12,
    gap: 8
  },
  routineName: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
  routineDescription: { color: "#94a3b8" },
  dayBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  dayBtnText: { color: "#e2e8f0", fontWeight: "700" },
  error: { color: "#f87171", fontWeight: "600" },
  logout: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  logoutText: { color: "#cbd5e1", fontWeight: "700" }
});
