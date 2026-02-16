import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { RestTimer } from "../components/RestTimer";
import { ActiveSession, Pointer, WorkoutGroup } from "../types";

type Props = {
  session: ActiveSession;
  onSetSave: (payload: {
    workout_exercise_item_id: string;
    set_number: number;
    weight?: number;
    reps?: number;
    rpe?: number;
    is_done: boolean;
  }) => Promise<void>;
  onPointerSave: (pointer: Pointer) => Promise<void>;
  onFinish: () => Promise<void>;
};

function nextPointer(pointer: Pointer, groups: WorkoutGroup[]): Pointer | null {
  const group = groups[pointer.group_index];
  if (!group) {
    return null;
  }

  const isLastExerciseInGroup = pointer.exercise_index >= group.workout_items.length - 1;
  const isLastRound = pointer.round_index >= group.rounds_total - 1;

  if (!isLastExerciseInGroup) {
    return {
      ...pointer,
      exercise_index: pointer.exercise_index + 1
    };
  }

  if (!isLastRound) {
    return {
      ...pointer,
      exercise_index: 0,
      round_index: pointer.round_index + 1,
      set_index: pointer.set_index + 1
    };
  }

  if (pointer.group_index < groups.length - 1) {
    return {
      group_index: pointer.group_index + 1,
      exercise_index: 0,
      set_index: 0,
      round_index: 0
    };
  }

  return null;
}

export function GuidedWorkoutScreen({
  session,
  onSetSave,
  onPointerSave,
  onFinish
}: Props) {
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(10);
  const [rest, setRest] = useState<{ label: "Transicion" | "Descanso"; seconds: number } | null>(
    null
  );
  const pointer = session.current_pointer;
  const group = session.workout_groups[pointer.group_index];
  const item = group?.workout_items[pointer.exercise_index];

  const exerciseTotal = useMemo(
    () =>
      session.workout_groups.reduce(
        (acc, currentGroup) => acc + currentGroup.workout_items.length,
        0
      ),
    [session.workout_groups]
  );
  const exerciseCurrent = useMemo(() => {
    let count = 0;
    for (let i = 0; i < session.workout_groups.length; i += 1) {
      if (i < pointer.group_index) {
        count += session.workout_groups[i].workout_items.length;
      } else if (i === pointer.group_index) {
        count += pointer.exercise_index + 1;
      }
    }
    return count;
  }, [pointer.exercise_index, pointer.group_index, session.workout_groups]);

  if (!group || !item) {
    return (
      <View style={styles.container}>
        <Text style={styles.doneTitle}>Sesion completada</Text>
        <Pressable style={styles.finishBtn} onPress={onFinish}>
          <Text style={styles.finishBtnText}>Finalizar</Text>
        </Pressable>
      </View>
    );
  }

  const setNumber = pointer.round_index + 1;
  const shouldShowTransition =
    group.workout_items.length > 1 && pointer.exercise_index < group.workout_items.length - 1;
  const shouldShowRoundRest =
    pointer.exercise_index === group.workout_items.length - 1 &&
    pointer.round_index < group.rounds_total - 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.badgeRow}>
        <Text style={styles.badge}>
          Ejercicio {exerciseCurrent}/{exerciseTotal}
        </Text>
        <Text style={styles.badge}>
          Set {setNumber}/{item.target_sets_total}
        </Text>
      </View>

      {group.type !== "SINGLE" && (
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>
            Ronda {pointer.round_index + 1}/{group.rounds_total}
          </Text>
          <Text style={styles.badge}>{item.order_in_group}</Text>
        </View>
      )}

      <View style={styles.focusCard}>
        <Text style={styles.exerciseLabel}>Ejercicio enfocado</Text>
        <Text style={styles.exerciseName}>{item.order_in_group}</Text>
        <Text style={styles.repRange}>Objetivo reps: {item.rep_range}</Text>
      </View>

      <View style={styles.quickLog}>
        <Text style={styles.logTitle}>Registro rapido (autosave)</Text>
        <View style={styles.row}>
          <Pressable style={styles.minus} onPress={() => setWeight((prev) => Math.max(0, prev - 2.5))}>
            <Text style={styles.btnText}>-</Text>
          </Pressable>
          <Text style={styles.metric}>Peso: {weight.toFixed(1)} kg</Text>
          <Pressable style={styles.plus} onPress={() => setWeight((prev) => prev + 2.5)}>
            <Text style={styles.btnText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          <Pressable style={styles.minus} onPress={() => setReps((prev) => Math.max(1, prev - 1))}>
            <Text style={styles.btnText}>-</Text>
          </Pressable>
          <Text style={styles.metric}>Reps: {reps}</Text>
          <Pressable style={styles.plus} onPress={() => setReps((prev) => prev + 1)}>
            <Text style={styles.btnText}>+</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={styles.finishSetBtn}
        onPress={async () => {
          await onSetSave({
            workout_exercise_item_id: item.id,
            set_number: setNumber,
            weight,
            reps,
            is_done: true
          });

          const next = nextPointer(pointer, session.workout_groups);

          if (shouldShowTransition && group.rest_between_exercises_seconds > 0) {
            setRest({
              label: "Transicion",
              seconds: group.rest_between_exercises_seconds
            });
          } else if (shouldShowRoundRest && group.rest_after_round_seconds > 0) {
            setRest({
              label: "Descanso",
              seconds: group.rest_after_round_seconds
            });
          }

          if (!next) {
            await onFinish();
            return;
          }
          await onPointerSave(next);
        }}
      >
        <Text style={styles.finishSetText}>Completar set</Text>
      </Pressable>

      {rest && (
        <RestTimer
          label={rest.label}
          seconds={rest.seconds}
          onDone={() => {
            setRest(null);
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  badge: {
    backgroundColor: "#1e293b",
    color: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 30
  },
  focusCard: {
    marginTop: 8,
    backgroundColor: "#111827",
    borderColor: "#1f2937",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16
  },
  exerciseLabel: { color: "#94a3b8" },
  exerciseName: { color: "#f8fafc", fontSize: 40, fontWeight: "800", marginTop: 8 },
  repRange: { color: "#22d3ee", fontSize: 16, marginTop: 8, fontWeight: "700" },
  quickLog: {
    marginTop: 14,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14
  },
  logTitle: { color: "#f8fafc", fontWeight: "700", marginBottom: 12, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  minus: {
    width: 60,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center"
  },
  plus: {
    width: 60,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#0ea5e9",
    justifyContent: "center",
    alignItems: "center"
  },
  btnText: { fontSize: 24, color: "#f8fafc", fontWeight: "900" },
  metric: { color: "#e2e8f0", flex: 1, fontSize: 18, textAlign: "center", fontWeight: "700" },
  finishSetBtn: {
    marginTop: 8,
    backgroundColor: "#22c55e",
    borderRadius: 12,
    paddingVertical: 16
  },
  finishSetText: {
    textAlign: "center",
    color: "#052e16",
    fontWeight: "800",
    fontSize: 18
  },
  doneTitle: {
    color: "#f8fafc",
    textAlign: "center",
    marginTop: 40,
    fontSize: 24,
    fontWeight: "700"
  },
  finishBtn: {
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#22c55e",
    borderRadius: 10
  },
  finishBtnText: { color: "#052e16", textAlign: "center", fontWeight: "800" }
});
