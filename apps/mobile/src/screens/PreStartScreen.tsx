import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StartSessionInput } from "@gym/shared";
import { Routine, RoutineDay } from "../types";

type Props = {
  hasActiveSession: boolean;
  onResume: () => void;
  routine: Routine;
  day: RoutineDay;
  onBack: () => void;
  onStart: (payload: StartSessionInput) => Promise<void>;
};

function parseOrUndefined(value: string) {
  if (!value.trim()) {
    return undefined;
  }
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export function PreStartScreen({
  hasActiveSession,
  onResume,
  routine,
  day,
  onBack,
  onStart
}: Props) {
  const [restBetween, setRestBetween] = useState("");
  const [restAfterRound, setRestAfterRound] = useState("");
  const [restAfterSet, setRestAfterSet] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pre-Start</Text>
      <Text style={styles.caption}>
        Overrides de descanso para esta sesion (sin modificar rutina base)
      </Text>

      <View style={styles.selectionCard}>
        <Text style={styles.selectionLabel}>Rutina</Text>
        <Text style={styles.selectionValue}>{routine.name}</Text>
        <Text style={styles.selectionLabel}>Dia</Text>
        <Text style={styles.selectionValue}>{day.day_label}</Text>
      </View>

      <Text style={styles.label}>rest_between_exercises_seconds</Text>
      <TextInput
        value={restBetween}
        onChangeText={setRestBetween}
        style={styles.input}
        keyboardType="numeric"
        placeholder="ej. 20"
        placeholderTextColor="#64748b"
      />
      <Text style={styles.label}>rest_after_round_seconds</Text>
      <TextInput
        value={restAfterRound}
        onChangeText={setRestAfterRound}
        style={styles.input}
        keyboardType="numeric"
        placeholder="ej. 90"
        placeholderTextColor="#64748b"
      />
      <Text style={styles.label}>rest_after_set_seconds (single)</Text>
      <TextInput
        value={restAfterSet}
        onChangeText={setRestAfterSet}
        style={styles.input}
        keyboardType="numeric"
        placeholder="opcional"
        placeholderTextColor="#64748b"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={async () => {
          setError(null);
          setIsStarting(true);
          try {
            await onStart({
              routine_id: routine.id,
              day_id: day.id,
              overrides: {
                rest_between_exercises_seconds: parseOrUndefined(restBetween),
                rest_after_round_seconds: parseOrUndefined(restAfterRound),
                rest_after_set_seconds: parseOrUndefined(restAfterSet)
              }
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo iniciar la sesion");
          } finally {
            setIsStarting(false);
          }
        }}
        style={[styles.cta, isStarting && styles.disabled]}
        disabled={isStarting}
      >
        {isStarting ? (
          <ActivityIndicator color="#052e16" />
        ) : (
          <Text style={styles.ctaText}>Iniciar sesion</Text>
        )}
      </Pressable>

      <Pressable onPress={onBack} style={styles.ghost}>
        <Text style={styles.ghostText}>Volver a rutinas</Text>
      </Pressable>

      {hasActiveSession && (
        <Pressable onPress={onResume} style={styles.resume}>
          <Text style={styles.ghostText}>Reanudar sesion activa</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "700" },
  caption: { color: "#94a3b8", marginTop: 6, marginBottom: 16 },
  selectionCard: {
    backgroundColor: "#111827",
    borderColor: "#1f2937",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8
  },
  selectionLabel: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  selectionValue: { color: "#f8fafc", fontSize: 16, fontWeight: "700", marginTop: 2 },
  label: { color: "#cbd5e1", marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    borderRadius: 10,
    padding: 12
  },
  cta: {
    marginTop: 18,
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    borderRadius: 10
  },
  disabled: { opacity: 0.7 },
  error: { marginTop: 10, color: "#f87171", fontWeight: "600" },
  ctaText: { textAlign: "center", fontWeight: "700", color: "#052e16" },
  ghost: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 12,
    borderRadius: 10
  },
  resume: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 12,
    borderRadius: 10
  },
  ghostText: { textAlign: "center", color: "#cbd5e1", fontWeight: "600" }
});
