import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
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
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) {
    return undefined;
  }
  return n;
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
  const [warning, setWarning] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const daySummary = useMemo(() => {
    let singleCount = 0;
    let supersetCount = 0;
    let trisetCount = 0;
    day.groups.forEach((group) => {
      if (group.type === "SINGLE") {
        singleCount += 1;
      } else if (group.type === "SUPERSET_2") {
        supersetCount += 1;
      } else if (group.type === "SUPERSET_3") {
        trisetCount += 1;
      }
    });
    const parts: string[] = [];
    if (singleCount > 0) {
      parts.push(`${singleCount} ejercicios individuales`);
    }
    if (supersetCount > 0) {
      parts.push(`${supersetCount} supersets`);
    }
    if (trisetCount > 0) {
      parts.push(`${trisetCount} triseries`);
    }
    return parts.length > 0 ? parts.join(" + ") : "sin grupos configurados";
  }, [day.groups]);

  const hasMultiExerciseGroups = useMemo(
    () => day.groups.some((group) => group.type !== "SINGLE"),
    [day.groups]
  );
  const hasSingleGroups = useMemo(
    () => day.groups.some((group) => group.type === "SINGLE"),
    [day.groups]
  );

  const handleStart = async () => {
    Keyboard.dismiss();
    setError(null);
    setWarning(null);

    const parsedBetween = parseOrUndefined(restBetween);
    const parsedAfterRound = parseOrUndefined(restAfterRound);
    const parsedAfterSet = parseOrUndefined(restAfterSet);

    const hasInvalidValue =
      (restBetween.trim() && parsedBetween === undefined) ||
      (restAfterRound.trim() && parsedAfterRound === undefined) ||
      (restAfterSet.trim() && parsedAfterSet === undefined);
    if (hasInvalidValue) {
      setError("Usa solo números enteros mayores o iguales a 0.");
      return;
    }

    const hasHighValue = [parsedBetween, parsedAfterRound, parsedAfterSet].some(
      (value) => typeof value === "number" && value > 600
    );
    if (hasHighValue) {
      setWarning("Parece muy alto, ¿seguro?");
    }

    setIsStarting(true);
    try {
      await onStart({
        routine_id: routine.id,
        day_id: day.id,
        overrides: {
          rest_between_exercises_seconds: hasMultiExerciseGroups ? parsedBetween : undefined,
          rest_after_round_seconds: hasMultiExerciseGroups ? parsedAfterRound : undefined,
          rest_after_set_seconds: hasSingleGroups ? parsedAfterSet : undefined
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la sesion");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={styles.title}>Pre-Start</Text>
            {keyboardVisible ? (
              <Pressable onPress={Keyboard.dismiss}>
                <Text style={styles.doneButton}>Listo</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.caption}>
              Estos cambios solo aplican a esta sesión, no cambian tu rutina base.
            </Text>

            <View style={styles.selectionCard}>
              <Text style={styles.selectionLabel}>Rutina</Text>
              <Text style={styles.selectionValue}>{routine.name}</Text>
              <Text style={styles.selectionLabel}>Dia</Text>
              <Text style={styles.selectionValue}>{day.day_label}</Text>
              <Text style={styles.selectionHint}>Este día contiene: {daySummary}</Text>
            </View>

            <Text style={styles.label}>Descanso entre ejercicios (en supersets/triseries)</Text>
            <Text style={styles.helpText}>
              Tiempo de transición cuando cambias de A1 → A2 → A3.
            </Text>
            <TextInput
              value={restBetween}
              onChangeText={setRestBetween}
              style={[styles.input, !hasMultiExerciseGroups && styles.inputDisabled]}
              keyboardType="number-pad"
              placeholder="Ej. 20"
              placeholderTextColor="#64748b"
              editable={hasMultiExerciseGroups}
            />

            <Text style={styles.label}>
              Descanso al terminar una ronda (en supersets/triseries)
            </Text>
            <Text style={styles.helpText}>
              Después de completar A1+A2 (y A3 si aplica), antes de repetir la ronda.
            </Text>
            <TextInput
              value={restAfterRound}
              onChangeText={setRestAfterRound}
              style={[styles.input, !hasMultiExerciseGroups && styles.inputDisabled]}
              keyboardType="number-pad"
              placeholder="Ej. 90"
              placeholderTextColor="#64748b"
              editable={hasMultiExerciseGroups}
            />
            {!hasMultiExerciseGroups ? (
              <Text style={styles.helpMuted}>Este día no tiene supersets/triseries.</Text>
            ) : null}

            <Text style={styles.label}>
              Descanso entre series (solo ejercicios individuales) (opcional)
            </Text>
            <Text style={styles.helpText}>
              Descanso después de cada serie cuando el grupo es SINGLE.
            </Text>
            <TextInput
              value={restAfterSet}
              onChangeText={setRestAfterSet}
              style={[styles.input, !hasSingleGroups && styles.inputDisabled]}
              keyboardType="number-pad"
              placeholder="Ej. 90 (opcional)"
              placeholderTextColor="#64748b"
              editable={hasSingleGroups}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            {!hasSingleGroups ? (
              <Text style={styles.helpMuted}>Este día no tiene ejercicios individuales.</Text>
            ) : null}

            {warning ? <Text style={styles.warning}>{warning}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={() => void handleStart()}
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
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 200 },
  topRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  doneButton: {
    color: "#38bdf8",
    fontWeight: "700",
    fontSize: 15
  },
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
  selectionHint: { color: "#93c5fd", marginTop: 8, fontSize: 12 },
  label: { color: "#cbd5e1", marginBottom: 6, marginTop: 8 },
  helpText: { color: "#94a3b8", marginBottom: 6, fontSize: 12, lineHeight: 18 },
  helpMuted: { color: "#64748b", marginTop: 4, marginBottom: 2, fontSize: 12 },
  input: {
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    borderRadius: 10,
    padding: 12
  },
  inputDisabled: {
    opacity: 0.55
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: "#0f172a",
    borderTopWidth: 1,
    borderTopColor: "#1e293b"
  },
  cta: {
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    borderRadius: 10
  },
  disabled: { opacity: 0.7 },
  warning: { marginTop: 10, color: "#facc15", fontWeight: "600" },
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
