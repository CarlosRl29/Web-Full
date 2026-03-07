import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {
  getActiveWorkoutSession,
  getCheckInStatus,
  getCurrentPlan,
  getExercises,
  getProgressExercise,
  getProgressMuscles,
  getProgressOverview,
  submitCheckIn,
  type ExerciseListItem,
  type ExerciseTrend,
  type MusclesResponse,
  type ProgressOverview,
  type TrainingPlan
} from "../services/api";
import { ActiveSession } from "../types";

const UPPER_SUBMUSCLES = new Set([
  "UPPER_CHEST", "MID_CHEST", "LOWER_CHEST", "LATS", "UPPER_BACK", "MID_BACK",
  "LOWER_BACK", "TRAPS", "ANTERIOR_DELTOID", "LATERAL_DELTOID", "REAR_DELTOID",
  "BICEPS", "TRICEPS"
]);

const LOWER_SUBMUSCLES = new Set([
  "QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "ABS", "OBLIQUES", "ERECTORS"
]);

const SUBMUSCLE_LABELS: Record<string, string> = {
  UPPER_CHEST: "Pecho alto",
  MID_CHEST: "Pecho medio",
  LOWER_CHEST: "Pecho bajo",
  LATS: "Dorsales",
  UPPER_BACK: "Espalda alta",
  MID_BACK: "Espalda media",
  LOWER_BACK: "Espalda baja",
  TRAPS: "Trapecio",
  ANTERIOR_DELTOID: "Deltoides anterior",
  LATERAL_DELTOID: "Deltoides lateral",
  REAR_DELTOID: "Deltoides posterior",
  QUADS: "Cuádriceps",
  HAMSTRINGS: "Isquiotibiales",
  GLUTES: "Glúteos",
  CALVES: "Gemelos",
  ABS: "Abdominales",
  OBLIQUES: "Oblicuos",
  ERECTORS: "Erectores",
  BICEPS: "Bíceps",
  TRICEPS: "Tríceps"
};

const ANCHOR_SEARCHES: Record<string, string[]> = {
  BALANCED: ["bench press", "sentadilla", "remo"],
  LOWER_BODY: ["sentadilla", "hip thrust", "peso muerto"],
  UPPER_BODY: ["bench press", "remo", "press militar"]
};

const SUGGESTION_LABELS: Record<string, string> = {
  ADD_REP: "+1 rep",
  INCREASE_LOAD: "+carga",
  MAINTAIN: "Mantener",
  DELOAD: "Bajar carga"
};

const PAIN_OPTIONS = [
  { value: "none", label: "Ninguno" },
  { value: "shoulder", label: "Hombro" },
  { value: "knee", label: "Rodilla" },
  { value: "back", label: "Espalda" },
  { value: "elbow", label: "Codo" },
  { value: "other", label: "Otro" }
];

const SLEEP_OPTIONS = [
  { value: "good", label: "Bueno" },
  { value: "average", label: "Regular" },
  { value: "poor", label: "Malo" }
];

const DIFFICULTY_OPTIONS = [
  { value: "very_easy", label: "Muy fácil" },
  { value: "good", label: "Bien" },
  { value: "hard", label: "Duro" },
  { value: "very_hard", label: "Muy duro" }
];

function MiniTrend({ data }: { data: number[] }) {
  if (data.length === 0) return <Text style={sparkStyles.value}>—</Text>;
  const last = data[data.length - 1] ?? 0;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pct = max > min ? ((last - min) / (max - min)) * 100 : 50;
  return (
    <View style={sparkStyles.wrap}>
      <View style={sparkStyles.barBg}>
        <View style={[sparkStyles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={sparkStyles.value}>{Math.round(last)} kg</Text>
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  barBg: { width: 50, height: 6, backgroundColor: "#1e293b", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#22d3ee", borderRadius: 3 },
  value: { color: "#94a3b8", fontSize: 12, fontWeight: "600", minWidth: 45 }
});

type Props = {
  onLogout?: () => Promise<void>;
};

export function ProgressScreen({ onLogout }: Props) {
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [muscles, setMuscles] = useState<MusclesResponse | null>(null);
  const [plan, setPlan] = useState<TrainingPlan>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [anchorExercises, setAnchorExercises] = useState<ExerciseListItem[]>([]);
  const [anchorTrends, setAnchorTrends] = useState<Record<string, ExerciseTrend>>({});
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInStatus, setCheckInStatus] = useState<{ created_at: string } | null | "never">(null);
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [checkInResult, setCheckInResult] = useState<string[] | null>(null);
  const [checkInForm, setCheckInForm] = useState({
    fatigue: 3,
    pain_location: "none",
    sleep_quality: "good",
    difficulty: "good"
  });

  const priorityArea = plan?.priority_area ?? "BALANCED";

  const showCheckInCard =
    checkInStatus === "never" ||
    (checkInStatus &&
      typeof checkInStatus === "object" &&
      (() => {
        const d = new Date(checkInStatus.created_at);
        const now = new Date();
        return (now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000) > 7;
      })());

  const loadAnchorIds = useCallback(async (area: string): Promise<string[]> => {
    const searches = ANCHOR_SEARCHES[area] ?? ANCHOR_SEARCHES.BALANCED;
    const ids: string[] = [];
    for (const term of searches) {
      try {
        const list = await getExercises({ search: term, limit: 1, locale: "es" });
        if (list.length > 0) ids.push(list[0].id);
      } catch {
        // skip
      }
    }
    return ids;
  }, []);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [ov, mus, pl, sess, status] = await Promise.all([
        getProgressOverview(7),
        getProgressMuscles(7),
        getCurrentPlan(),
        getActiveWorkoutSession(),
        getCheckInStatus().catch(() => null)
      ]);
      setOverview(ov);
      setMuscles(mus);
      setPlan(pl);
      setActiveSession(sess);
      setCheckInStatus(status === null ? "never" : status);

      const ids = await loadAnchorIds(pl?.priority_area ?? "BALANCED");
      const exercises: ExerciseListItem[] = [];
      const trends: Record<string, ExerciseTrend> = {};
      for (const id of ids) {
        try {
          const trend = await getProgressExercise(id, 6);
          if (trend) {
            exercises.push({ id: trend.exerciseId, name: trend.exerciseName });
            trends[id] = trend;
          }
        } catch {
          // skip
        }
      }
      setAnchorExercises(exercises);
      setAnchorTrends(trends);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar progreso");
    } finally {
      setIsLoading(false);
    }
  }, [loadAnchorIds]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return () => unsub();
  }, []);

  const onRefresh = useCallback(async () => {
    if (isOffline) return;
    setIsRefreshing(true);
    try {
      await loadAll();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAll, isOffline]);

  useEffect(() => {
    if (isOffline) {
      setIsLoading(false);
      return;
    }
    void loadAll();
  }, [loadAll, isOffline]);

  const handleCheckInSubmit = useCallback(async () => {
    setCheckInSubmitting(true);
    setCheckInResult(null);
    try {
      const res = await submitCheckIn(checkInForm);
      setCheckInResult(res.adjustments);
      setCheckInStatus({ created_at: new Date().toISOString() });
      setTimeout(() => {
        setCheckInModalVisible(false);
      }, 2500);
    } catch (err) {
      setCheckInResult([err instanceof Error ? err.message : "Error al enviar"]);
    } finally {
      setCheckInSubmitting(false);
    }
  }, [checkInForm]);

  const muscleEntries = useMemo(() => {
    const effective = muscles && "effective" in muscles ? muscles.effective : muscles as Record<string, number> | null;
    const targets = muscles && "targets" in muscles ? muscles.targets : undefined;
    if (!effective || typeof effective !== "object") return [];
    const area = plan?.priority_area ?? "BALANCED";
    const filter = priorityOnly
      ? area === "UPPER_BODY"
        ? UPPER_SUBMUSCLES
        : area === "LOWER_BODY"
          ? LOWER_SUBMUSCLES
          : null
      : null;

    return Object.entries(effective)
      .filter(([sub]) => !filter || filter.has(sub))
      .map(([sub, val]) => {
        const t = targets?.[sub];
        let status: "green" | "yellow" | "red" = "green";
        if (t) {
          if (val < t.min) status = "yellow";
          else if (val > t.max) status = "red";
        }
        return { sub, val, targets: t, status };
      })
      .sort((a, b) => b.val - a.val);
  }, [muscles, plan?.priority_area, priorityOnly]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22d3ee" size="large" />
        <Text style={styles.caption}>Cargando progreso...</Text>
      </View>
    );
  }

  if (isOffline) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Sin conexión. Los datos se cargarán al reconectar.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor="#22d3ee"
        />
      }
    >
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setIsLoading(true); void loadAll(); }}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Weekly Check-in */}
      {showCheckInCard && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Check-in semanal</Text>
          <Text style={styles.caption}>
            Cuéntanos cómo te sientes para ajustar tus entrenamientos.
          </Text>
          <Pressable
            style={styles.checkInBtn}
            onPress={() => {
              setCheckInResult(null);
              setCheckInModalVisible(true);
            }}
          >
            <Text style={styles.checkInBtnText}>Hacer check-in semanal</Text>
          </Pressable>
        </View>
      )}

      {/* 1) Today / Next workout */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {activeSession ? "Entrenamiento en curso" : "Próximo entrenamiento"}
        </Text>
        {plan ? (
          <>
            <Text style={styles.caption}>
              {plan.goal} • {plan.priority_area === "BALANCED" ? "Equilibrado" : plan.priority_area === "UPPER_BODY" ? "Tren superior" : "Tren inferior"}
            </Text>
            <Text style={styles.caption}>~45–60 min estimados</Text>
            {anchorExercises.length > 0 && (
              <View style={styles.anchorList}>
                {anchorExercises.slice(0, 3).map((ex) => {
                  const trend = anchorTrends[ex.id];
                  const sug = trend?.nextSuggestion;
                  return (
                    <View key={ex.id} style={styles.anchorRow}>
                      <Text style={styles.anchorName} numberOfLines={1}>{ex.name}</Text>
                      <View style={[styles.badge, sug?.type === "DELOAD" ? styles.badgeDeload : styles.badgeOk]}>
                        <Text style={styles.badgeText}>
                          {sug ? SUGGESTION_LABELS[sug.type] ?? sug.type : "—"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <Text style={styles.caption}>Sin plan activo. Crea uno en la web.</Text>
        )}
      </View>

      {/* 2) Weekly Effective Volume */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Volumen efectivo semanal</Text>
          <Pressable
            style={[styles.toggle, priorityOnly && styles.toggleActive]}
            onPress={() => setPriorityOnly((p) => !p)}
          >
            <Text style={styles.toggleText}>
              {priorityOnly ? "Solo prioridad" : "Todos"}
            </Text>
          </Pressable>
        </View>
        {muscleEntries.length === 0 ? (
          <Text style={styles.caption}>Completa entrenamientos para ver volumen.</Text>
        ) : (
          muscleEntries.map(({ sub, val, targets, status }) => (
            <View key={sub} style={styles.muscleRow}>
              <Text style={styles.muscleName}>{SUBMUSCLE_LABELS[sub] ?? sub}</Text>
              <View style={styles.barWrap}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, (val / (targets?.max ?? 20)) * 100)}%` },
                    status === "green" && styles.barGreen,
                    status === "yellow" && styles.barYellow,
                    status === "red" && styles.barRed
                  ]}
                />
              </View>
              <Text style={styles.muscleVal}>
                {val} {targets ? `(${targets.min}-${targets.max})` : ""} sets
              </Text>
            </View>
          ))
        )}
      </View>

      {/* 3) Strength mini-trends */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tendencias de fuerza</Text>
        {anchorExercises.length === 0 ? (
          <Text style={styles.caption}>Sin datos de ejercicios ancla.</Text>
        ) : (
          anchorExercises.slice(0, 3).map((ex) => {
            const trend = anchorTrends[ex.id];
            const e1rm = trend?.e1rmTrend ?? [];
            const last = trend?.lastSessions?.[0];
            return (
              <View key={ex.id} style={styles.trendRow}>
                <Text style={styles.trendName} numberOfLines={1}>{ex.name}</Text>
                <MiniTrend data={e1rm} />
                {last ? (
                  <Text style={styles.lastSession}>{last.weight} kg × {last.reps}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* 4) Adherence */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Adherencia</Text>
        {overview ? (
          <>
            <View style={styles.adherenceRow}>
              <Text style={styles.adherenceLabel}>Entrenamientos esta semana</Text>
              <Text style={styles.adherenceValue}>{overview.sessionsCount}</Text>
            </View>
            <View style={styles.adherenceRow}>
              <Text style={styles.adherenceLabel}>Adherencia</Text>
              <Text style={styles.adherenceValue}>{Math.round(overview.adherence * 100)}%</Text>
            </View>
            <View style={styles.adherenceRow}>
              <Text style={styles.adherenceLabel}>Volumen total</Text>
              <Text style={styles.adherenceValue}>{Math.round(overview.volumeTotal)} kg</Text>
            </View>
          </>
        ) : (
          <Text style={styles.caption}>Sin datos.</Text>
        )}
      </View>

      {onLogout ? (
        <Pressable style={styles.logout} onPress={onLogout}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      ) : null}

      <Modal
        visible={checkInModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCheckInModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Check-in semanal</Text>

            {checkInResult ? (
              <View style={styles.resultBox}>
                <Text style={styles.resultTitle}>AXION ajustó tu entrenamiento esta semana</Text>
                {checkInResult.map((adj, i) => (
                  <Text key={i} style={styles.resultItem}>✔ {adj}</Text>
                ))}
              </View>
            ) : (
              <>
                <Text style={styles.modalLabel}>Fatiga (1–5)</Text>
                <View style={styles.fatigueRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      style={[
                        styles.fatigueBtn,
                        checkInForm.fatigue === n && styles.fatigueBtnActive
                      ]}
                      onPress={() => setCheckInForm((f) => ({ ...f, fatigue: n }))}
                    >
                      <Text style={styles.fatigueBtnText}>{n}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.modalLabel}>Dolor</Text>
                <View style={styles.optionsRow}>
                  {PAIN_OPTIONS.map((o) => (
                    <Pressable
                      key={o.value}
                      style={[
                        styles.optionBtn,
                        checkInForm.pain_location === o.value && styles.optionBtnActive
                      ]}
                      onPress={() => setCheckInForm((f) => ({ ...f, pain_location: o.value }))}
                    >
                      <Text style={styles.optionBtnText}>{o.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.modalLabel}>Dormir</Text>
                <View style={styles.optionsRow}>
                  {SLEEP_OPTIONS.map((o) => (
                    <Pressable
                      key={o.value}
                      style={[
                        styles.optionBtn,
                        checkInForm.sleep_quality === o.value && styles.optionBtnActive
                      ]}
                      onPress={() => setCheckInForm((f) => ({ ...f, sleep_quality: o.value }))}
                    >
                      <Text style={styles.optionBtnText}>{o.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.modalLabel}>Dificultad</Text>
                <View style={styles.optionsRow}>
                  {DIFFICULTY_OPTIONS.map((o) => (
                    <Pressable
                      key={o.value}
                      style={[
                        styles.optionBtn,
                        checkInForm.difficulty === o.value && styles.optionBtnActive
                      ]}
                      onPress={() => setCheckInForm((f) => ({ ...f, difficulty: o.value }))}
                    >
                      <Text style={styles.optionBtnText}>{o.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.modalCancel}
                    onPress={() => setCheckInModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalSubmit, checkInSubmitting && styles.modalSubmitDisabled]}
                    onPress={() => void handleCheckInSubmit()}
                    disabled={checkInSubmitting}
                  >
                    <Text style={styles.modalSubmitText}>
                      {checkInSubmitting ? "Enviando..." : "Enviar"}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 14,
    gap: 8
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
  caption: { color: "#94a3b8", fontSize: 14 },
  errorBox: { backgroundColor: "#7f1d1d", borderRadius: 8, padding: 12, gap: 8 },
  error: { color: "#fca5a5", fontWeight: "600" },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#991b1b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  retryText: { color: "#fef2f2", fontWeight: "700" },
  anchorList: { gap: 8, marginTop: 8 },
  anchorRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  anchorName: { color: "#e2e8f0", flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeOk: { backgroundColor: "#065f46" },
  badgeDeload: { backgroundColor: "#7c2d12" },
  badgeText: { color: "#d1fae5", fontSize: 12, fontWeight: "600" },
  toggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155"
  },
  toggleActive: { backgroundColor: "#1e3a5f", borderColor: "#22d3ee" },
  toggleText: { color: "#94a3b8", fontSize: 13 },
  muscleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  muscleName: { color: "#e2e8f0", width: 100, fontSize: 13 },
  barWrap: { flex: 1, height: 8, backgroundColor: "#1e293b", borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  barGreen: { backgroundColor: "#22c55e" },
  barYellow: { backgroundColor: "#eab308" },
  barRed: { backgroundColor: "#ef4444" },
  muscleVal: { color: "#94a3b8", fontSize: 12, width: 70, textAlign: "right" },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b"
  },
  trendName: { color: "#e2e8f0", flex: 1 },
  lastSession: { color: "#94a3b8", fontSize: 12 },
  adherenceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  adherenceLabel: { color: "#94a3b8" },
  adherenceValue: { color: "#f8fafc", fontWeight: "700" },
  logout: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  logoutText: { color: "#cbd5e1", fontWeight: "700" },
  checkInBtn: {
    backgroundColor: "#1e3a5f",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 8
  },
  checkInBtnText: { color: "#22d3ee", fontWeight: "700", textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20
  },
  modalContent: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 20,
    maxHeight: "85%"
  },
  modalTitle: { color: "#f8fafc", fontSize: 20, fontWeight: "700", marginBottom: 16 },
  modalLabel: { color: "#94a3b8", fontSize: 14, marginTop: 12, marginBottom: 6 },
  fatigueRow: { flexDirection: "row", gap: 8 },
  fatigueBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    alignItems: "center"
  },
  fatigueBtnActive: { backgroundColor: "#1e3a5f", borderWidth: 2, borderColor: "#22d3ee" },
  fatigueBtnText: { color: "#e2e8f0", fontWeight: "700" },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#1e293b"
  },
  optionBtnActive: { backgroundColor: "#1e3a5f", borderWidth: 2, borderColor: "#22d3ee" },
  optionBtnText: { color: "#e2e8f0", fontSize: 13 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 24 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    alignItems: "center"
  },
  modalCancelText: { color: "#94a3b8", fontWeight: "600" },
  modalSubmit: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#22d3ee",
    alignItems: "center"
  },
  modalSubmitDisabled: { opacity: 0.6 },
  modalSubmitText: { color: "#0f172a", fontWeight: "700" },
  resultBox: { paddingVertical: 16, gap: 8 },
  resultTitle: { color: "#22d3ee", fontWeight: "700", marginBottom: 8 },
  resultItem: { color: "#86efac", fontSize: 14 }
});
