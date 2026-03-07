import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export type FinishedSessionData = {
  id: string;
  routine?: { name: string };
  routine_day?: { day_label: string };
  started_at?: string;
  ended_at?: string;
  workout_groups: Array<{
    workout_items: Array<{
      exercise_name?: string | null;
      sets: Array<{
        is_done: boolean;
        weight?: number | null;
        reps?: number | null;
      }>;
    }>;
  }>;
};

type Props = {
  session: FinishedSessionData;
  onBackToHome: () => void;
};

function formatDuration(started: string | undefined, ended: string | undefined): string {
  if (!started || !ended) return "—";
  const s = new Date(started).getTime();
  const e = new Date(ended).getTime();
  const mins = Math.round((e - s) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function WorkoutSummaryScreen({ session, onBackToHome }: Props) {
  const routineName = session.routine?.name ?? "Rutina";
  const dayLabel = session.routine_day?.day_label ?? "";
  const duration = formatDuration(session.started_at, session.ended_at);

  let exercisesCompleted = 0;
  let setsCompleted = 0;
  let totalVolume = 0;
  for (const group of session.workout_groups) {
    for (const item of group.workout_items) {
      const doneSets = item.sets.filter((s) => s.is_done);
      if (doneSets.length > 0) exercisesCompleted += 1;
      setsCompleted += doneSets.length;
      for (const s of doneSets) {
        if (s.weight != null && s.reps != null) {
          totalVolume += s.weight * s.reps;
        }
      }
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Resumen del entrenamiento</Text>

      <View style={styles.card}>
        <Text style={[styles.label, styles.labelFirst]}>Rutina</Text>
        <Text style={styles.value}>{routineName}</Text>
        {dayLabel ? (
          <>
            <Text style={styles.label}>Día</Text>
            <Text style={styles.value}>{dayLabel}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={[styles.label, styles.labelFirst]}>Ejercicios completados</Text>
        <Text style={styles.value}>{exercisesCompleted}</Text>
        <Text style={styles.label}>Series completadas</Text>
        <Text style={styles.value}>{setsCompleted}</Text>
        <Text style={styles.label}>Duración total</Text>
        <Text style={styles.value}>{duration}</Text>
        {totalVolume > 0 ? (
          <>
            <Text style={styles.label}>Volumen total</Text>
            <Text style={styles.value}>{totalVolume.toLocaleString()} kg</Text>
          </>
        ) : null}
      </View>

      <View style={styles.exerciseList}>
        <Text style={styles.sectionTitle}>Ejercicios</Text>
        {session.workout_groups.map((group, gi) =>
          group.workout_items.map((item, ii) => {
            const done = item.sets.filter((s) => s.is_done);
            if (done.length === 0) return null;
            const itemVolume = done.reduce(
              (sum, s) => sum + (s.weight != null && s.reps != null ? s.weight * s.reps : 0),
              0
            );
            return (
              <View key={`${gi}-${ii}`} style={styles.exerciseRow}>
                <View>
                  <Text style={styles.exerciseName}>
                    {item.exercise_name ?? `Ejercicio ${gi + 1}-${ii + 1}`}
                  </Text>
                  {itemVolume > 0 ? (
                    <Text style={styles.exerciseVolume}>{itemVolume.toLocaleString()} kg</Text>
                  ) : null}
                </View>
                <Text style={styles.exerciseSets}>{done.length} series</Text>
              </View>
            );
          })
        )}
      </View>

      <Pressable style={styles.cta} onPress={onBackToHome}>
        <Text style={styles.ctaText}>Volver al inicio</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 20
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 16,
    marginBottom: 16
  },
  label: { color: "#94a3b8", fontSize: 12, marginTop: 8 },
  labelFirst: { marginTop: 0 },
  value: { color: "#f8fafc", fontSize: 18, fontWeight: "700", marginTop: 2 },
  sectionTitle: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12
  },
  exerciseList: { marginBottom: 24 },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b"
  },
  exerciseName: { color: "#f8fafc", fontSize: 15, fontWeight: "600" },
  exerciseVolume: { color: "#64748b", fontSize: 12, marginTop: 2 },
  exerciseSets: { color: "#94a3b8", fontSize: 14 },
  cta: {
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    borderRadius: 10
  },
  ctaText: {
    textAlign: "center",
    color: "#052e16",
    fontWeight: "800",
    fontSize: 16
  }
});
