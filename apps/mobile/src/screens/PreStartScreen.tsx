import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StartSessionInput } from "@gym/shared";

type Props = {
  hasActiveSession: boolean;
  onResume: () => void;
  onStart: (payload: StartSessionInput) => Promise<void>;
};

function parseOrUndefined(value: string) {
  if (!value.trim()) {
    return undefined;
  }
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export function PreStartScreen({ hasActiveSession, onResume, onStart }: Props) {
  const [routineId, setRoutineId] = useState("00000000-0000-0000-0000-000000000001");
  const [dayId, setDayId] = useState("00000000-0000-0000-0000-000000000002");
  const [restBetween, setRestBetween] = useState("");
  const [restAfterRound, setRestAfterRound] = useState("");
  const [restAfterSet, setRestAfterSet] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pre-Start</Text>
      <Text style={styles.caption}>
        Overrides de descanso para esta sesion (sin modificar rutina base)
      </Text>

      <Text style={styles.label}>Routine ID</Text>
      <TextInput value={routineId} onChangeText={setRoutineId} style={styles.input} />
      <Text style={styles.label}>Day ID</Text>
      <TextInput value={dayId} onChangeText={setDayId} style={styles.input} />

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

      <Pressable
        onPress={() =>
          onStart({
            routine_id: routineId,
            day_id: dayId,
            overrides: {
              rest_between_exercises_seconds: parseOrUndefined(restBetween),
              rest_after_round_seconds: parseOrUndefined(restAfterRound),
              rest_after_set_seconds: parseOrUndefined(restAfterSet)
            }
          })
        }
        style={styles.cta}
      >
        <Text style={styles.ctaText}>Iniciar sesion</Text>
      </Pressable>

      {hasActiveSession && (
        <Pressable onPress={onResume} style={styles.ghost}>
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
  ctaText: { textAlign: "center", fontWeight: "700", color: "#052e16" },
  ghost: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 12,
    borderRadius: 10
  },
  ghostText: { textAlign: "center", color: "#cbd5e1", fontWeight: "600" }
});
