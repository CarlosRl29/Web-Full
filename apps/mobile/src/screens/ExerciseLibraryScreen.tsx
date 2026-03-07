import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { getExercises, getFilterOptions, type ExerciseListItem, type FilterOptions } from "../services/api";

type Props = {
  onBack: () => void;
};

const MUSCLE_OPTIONS_FALLBACK: Array<{ value: string; label: string }> = [
  { value: "CHEST", label: "Pectorales" },
  { value: "BACK", label: "Espalda" },
  { value: "SHOULDERS", label: "Hombros" },
  { value: "BICEPS", label: "Bíceps" },
  { value: "TRICEPS", label: "Tríceps" },
  { value: "QUADS", label: "Cuádriceps" },
  { value: "CORE", label: "Core" }
];

export function ExerciseLibraryScreen({ onBack }: Props) {
  const [exercises, setExercises] = useState<ExerciseListItem[]>([]);
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [techniqueExercise, setTechniqueExercise] = useState<ExerciseListItem | null>(null);

  const loadExercises = useCallback(async () => {
    if (!search.trim() && !muscle) {
      setExercises([]);
      setHasSearched(false);
      return;
    }
    setIsLoading(true);
    setHasSearched(true);
    try {
      const list = await getExercises({
        search: search.trim() || undefined,
        muscle: muscle || undefined,
        limit: 50,
        locale: "es"
      });
      setExercises(list);
    } catch {
      setExercises([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, muscle]);

  useEffect(() => {
    void getFilterOptions()
      .then(setFilterOptions)
      .catch(() => setFilterOptions(null));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadExercises();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadExercises]);

  const muscleOptions =
    filterOptions?.muscles?.length ? filterOptions.muscles : MUSCLE_OPTIONS_FALLBACK;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>Ejercicios</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Buscar ejercicio..."
        placeholderTextColor="#64748b"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {muscleOptions.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.filterChip, muscle === opt.value && styles.filterChipSelected]}
            onPress={() => setMuscle(muscle === opt.value ? "" : opt.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                muscle === opt.value && styles.filterChipTextSelected
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {!hasSearched && !search.trim() && !muscle ? (
        <Text style={styles.hint}>Busca o filtra por músculo para ver ejercicios</Text>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#22d3ee" />
        </View>
      ) : exercises.length === 0 ? (
        <Text style={styles.empty}>No hay resultados</Text>
      ) : (
        <View style={styles.list}>
          {exercises.map((ex) => (
            <Pressable
              key={ex.id}
              style={styles.exerciseCard}
              onPress={() => setTechniqueExercise(ex)}
            >
              <Text style={styles.exerciseName}>
                {ex.display_name ?? ex.name}
              </Text>
              {ex.primary_muscle_label ? (
                <Text style={styles.exerciseMuscle}>{ex.primary_muscle_label}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      <Modal
        visible={!!techniqueExercise}
        transparent
        animationType="slide"
        onRequestClose={() => setTechniqueExercise(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {techniqueExercise?.display_name ?? techniqueExercise?.name ?? ""}
              </Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setTechniqueExercise(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.modalCloseBtnText}>✕ Cerrar</Text>
              </Pressable>
            </View>
            {techniqueExercise?.image_url ? (
              <Pressable
                style={styles.techniqueImageWrap}
                onPress={() => void Linking.openURL(techniqueExercise.image_url!)}
              >
                <Image
                  source={{ uri: techniqueExercise.image_url }}
                  style={styles.techniqueImage}
                  resizeMode="contain"
                />
                <Text style={styles.techniqueImageHint}>Toca para abrir</Text>
              </Pressable>
            ) : null}
            {techniqueExercise?.primary_muscle_label ? (
              <Text style={styles.techniqueMeta}>
                Músculo: {techniqueExercise.primary_muscle_label}
                {techniqueExercise.primary_submuscle_label
                  ? ` • ${techniqueExercise.primary_submuscle_label}`
                  : ""}
              </Text>
            ) : null}
            <ScrollView style={styles.techniqueScroll} showsVerticalScrollIndicator>
              <Text style={styles.techniqueSection}>Técnica / descripción</Text>
              <Text style={styles.techniqueText}>
                {techniqueExercise?.instructions ?? "Sin descripción disponible para este ejercicio."}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1e293b",
    borderRadius: 8
  },
  backText: { color: "#22d3ee", fontWeight: "700" },
  title: { color: "#f8fafc", fontSize: 20, fontWeight: "800" },
  searchInput: {
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12
  },
  filterScroll: { marginHorizontal: -16, marginBottom: 16 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent"
  },
  filterChipSelected: { borderColor: "#22c55e" },
  filterChipText: { color: "#cbd5e1", fontWeight: "600", fontSize: 13 },
  filterChipTextSelected: { color: "#22d3ee" },
  hint: { color: "#64748b", fontSize: 14 },
  empty: { color: "#94a3b8", fontSize: 14 },
  center: { paddingVertical: 24, alignItems: "center" },
  list: { gap: 8 },
  exerciseCard: {
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 14
  },
  exerciseName: { color: "#f8fafc", fontSize: 16, fontWeight: "700" },
  exerciseMuscle: { color: "#94a3b8", fontSize: 13, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    padding: 16
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12
  },
  modalTitle: { color: "#f8fafc", fontSize: 20, fontWeight: "800", flex: 1 },
  modalCloseBtn: { padding: 8 },
  modalCloseBtnText: { color: "#22d3ee", fontWeight: "700" },
  techniqueImageWrap: { marginBottom: 12, alignItems: "center" },
  techniqueImage: { width: "100%", height: 180, borderRadius: 10 },
  techniqueImageHint: { color: "#64748b", fontSize: 12, marginTop: 4 },
  techniqueMeta: { color: "#94a3b8", fontSize: 14, marginBottom: 12 },
  techniqueSection: { color: "#cbd5e1", fontWeight: "700", marginBottom: 8 },
  techniqueScroll: { maxHeight: 200 },
  techniqueText: { color: "#cbd5e1", fontSize: 15, lineHeight: 22 }
});
