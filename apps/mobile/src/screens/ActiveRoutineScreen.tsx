import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Routine, RoutineDay } from "../types";

type Props = {
  routine: Routine;
  onPickDay: (day: RoutineDay) => void;
  onBack: () => void;
};

export function ActiveRoutineScreen({ routine, onPickDay, onBack }: Props) {
  const [selectedDay, setSelectedDay] = useState<RoutineDay | null>(null);

  const sortedDays = routine?.days
    ? [...routine.days].sort((a, b) => a.order_index - b.order_index)
    : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{routine.name}</Text>
      {routine.description ? (
        <Text style={styles.caption}>{routine.description}</Text>
      ) : null}

      <Text style={styles.sectionTitle}>Días</Text>
      <View style={styles.dayRow}>
        {sortedDays.map((day) => (
          <Pressable
            key={day.id}
            style={[
              styles.dayChip,
              selectedDay?.id === day.id && styles.dayChipSelected
            ]}
            onPress={() => setSelectedDay(selectedDay?.id === day.id ? null : day)}
          >
            <Text
              style={[
                styles.dayChipText,
                selectedDay?.id === day.id && styles.dayChipTextSelected
              ]}
            >
              {day.day_label}
            </Text>
          </Pressable>
        ))}
      </View>

      {selectedDay ? (
        <View style={styles.exercisesSection}>
          <Text style={styles.sectionTitle}>{selectedDay.day_label} – Ejercicios</Text>
          {selectedDay.groups
            .sort((a, b) => a.order_index - b.order_index)
            .map((group) => (
              <View key={group.id} style={styles.groupCard}>
                <Text style={styles.groupType}>
                  {group.type === "SINGLE"
                    ? "Ejercicio"
                    : group.type === "SUPERSET_2"
                      ? "Superset"
                      : "Triserie"}
                </Text>
                {group.exercises
                  .sort((a, b) => a.order_in_group.localeCompare(b.order_in_group))
                  .map((ex) => (
                    <View key={ex.id} style={styles.exerciseRow}>
                      <Text style={styles.exerciseOrder}>{ex.order_in_group}</Text>
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>{ex.exercise.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          {ex.target_sets_per_round * group.rounds_total} series × {ex.rep_range} reps
                          {group.rest_between_exercises_seconds > 0
                            ? ` • ${group.rest_between_exercises_seconds}s descanso`
                            : ""}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            ))}
          <Pressable
            style={styles.startBtn}
            onPress={() => onPickDay(selectedDay)}
          >
            <Text style={styles.startBtnText}>Iniciar este día</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.hint}>Selecciona un día para ver ejercicios</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12
  },
  headerRow: { flexDirection: "row", marginBottom: 16 },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1e293b",
    borderRadius: 8
  },
  backText: { color: "#22d3ee", fontWeight: "700" },
  title: { color: "#f8fafc", fontSize: 22, fontWeight: "800" },
  caption: { color: "#94a3b8", marginTop: 4, marginBottom: 16 },
  sectionTitle: { color: "#cbd5e1", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent"
  },
  dayChipSelected: { borderColor: "#22c55e", backgroundColor: "#164e63" },
  dayChipText: { color: "#cbd5e1", fontWeight: "700" },
  dayChipTextSelected: { color: "#22d3ee" },
  exercisesSection: { marginTop: 8 },
  groupCard: {
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 12,
    marginBottom: 12
  },
  groupType: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase"
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 10
  },
  exerciseOrder: {
    color: "#22d3ee",
    fontWeight: "800",
    fontSize: 14,
    minWidth: 28
  },
  exerciseInfo: { flex: 1 },
  exerciseName: { color: "#f8fafc", fontSize: 16, fontWeight: "700" },
  exerciseMeta: { color: "#94a3b8", fontSize: 13, marginTop: 2 },
  startBtn: {
    marginTop: 20,
    backgroundColor: "#22c55e",
    paddingVertical: 16,
    borderRadius: 12
  },
  startBtnText: {
    textAlign: "center",
    color: "#052e16",
    fontWeight: "800",
    fontSize: 18
  },
  hint: { color: "#64748b", fontSize: 14, marginTop: 20 }
});
