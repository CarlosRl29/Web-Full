import React, { useMemo, useState } from "react";
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { RestTimer } from "../components/RestTimer";
import { ActiveSession, Pointer, WorkoutGroup } from "../types";

type Props = {
  session: ActiveSession;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  queuePreview: Array<{
    event_id: string;
    created_at: string;
    updated_at: string;
    status: "pending" | "sending" | "acked" | "failed";
    attempts: number;
    last_error?: string;
    type: "PATCH_PROGRESS";
  }>;
  onForceSync: () => Promise<void>;
  onRetryFailed: () => Promise<void>;
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
  isOnline,
  isSyncing,
  pendingCount,
  queuePreview,
  onForceSync,
  onRetryFailed,
  onSetSave,
  onPointerSave,
  onFinish
}: Props) {
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(10);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showTechniqueModal, setShowTechniqueModal] = useState(false);
  const [restBanner, setRestBanner] = useState<string | null>(null);
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
  const exerciseName = item.exercise_name ?? item.order_in_group;
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

      <View style={styles.badgeRow}>
        <Text style={styles.badge}>
          Ronda {pointer.round_index + 1}/{group.rounds_total}
        </Text>
        <Text style={styles.badge}>{item.order_in_group}</Text>
      </View>
      <View style={styles.badgeRow}>
        <Text style={styles.badge}>{isOnline ? "Online" : "Offline"}</Text>
        <Text style={[styles.badge, pendingCount > 0 && styles.pendingBadge]}>
          Pendientes: {pendingCount}
        </Text>
      </View>

      {__DEV__ && (
        <View style={styles.badgeRow}>
          <Pressable
            style={[styles.debugBtn, !isOnline && styles.debugBtnDisabled]}
            onPress={() => void onForceSync()}
            disabled={!isOnline || isSyncing}
          >
            <Text style={styles.debugText}>{isSyncing ? "Sincronizando..." : "Forzar sync"}</Text>
          </Pressable>
          <Pressable
            style={[styles.debugBtn, !isOnline && styles.debugBtnDisabled]}
            onPress={() => void onRetryFailed()}
            disabled={!isOnline || isSyncing}
          >
            <Text style={styles.debugText}>Reintentar failed</Text>
          </Pressable>
          <Pressable style={styles.debugBtn} onPress={() => setShowQueueModal(true)}>
            <Text style={styles.debugText}>Ver cola</Text>
          </Pressable>
        </View>
      )}

      {restBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{restBanner}</Text>
        </View>
      ) : null}

      <View style={styles.focusCard}>
        <Text style={styles.exerciseLabel}>Ejercicio enfocado</Text>
        <Text style={styles.exerciseName}>{exerciseName}</Text>
        <Text style={styles.repRange}>Objetivo reps: {item.rep_range}</Text>
        <Pressable
          style={styles.techniqueBtn}
          onPress={() => setShowTechniqueModal(true)}
        >
          <Text style={styles.techniqueBtnText}>Ver técnica</Text>
        </Pressable>
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
            setRestBanner("Descanso terminado");
            setTimeout(() => {
              setRestBanner(null);
            }, 2000);
          }}
        />
      )}

      <Modal visible={showQueueModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ultimos eventos en cola</Text>
            <ScrollView style={styles.modalList}>
              {queuePreview.length === 0 ? (
                <Text style={styles.modalItem}>Sin eventos pendientes.</Text>
              ) : (
                queuePreview.map((event) => (
                  <Text key={event.event_id} style={styles.modalItem}>
                    {event.status.toUpperCase()} • at:{event.attempts} •{" "}
                    {new Date(event.updated_at).toLocaleTimeString()}
                    {event.last_error ? ` • ${event.last_error}` : ""}
                  </Text>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.modalClose} onPress={() => setShowQueueModal(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTechniqueModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTechniqueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{exerciseName}</Text>
            <Text style={styles.techniqueSectionTitle}>Descripción</Text>
            <Text style={styles.modalItem}>
              {item.exercise_description ?? "Sin descripción disponible para este ejercicio."}
            </Text>
            <Text style={styles.techniqueSectionTitle}>Técnica / recomendaciones</Text>
            <Text style={styles.modalItem}>{item.notes ?? "Sin recomendaciones específicas."}</Text>
            {item.exercise_media_url ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                {item.exercise_media_url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                  <Image
                    source={{ uri: item.exercise_media_url }}
                    style={styles.techniqueImage}
                    resizeMode="cover"
                  />
                ) : null}
                <Pressable
                  style={styles.modalAction}
                  onPress={() => {
                    void Linking.openURL(item.exercise_media_url!);
                  }}
                >
                  <Text style={styles.modalActionText}>Abrir media</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={styles.modalClose} onPress={() => setShowTechniqueModal(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  pendingBadge: {
    backgroundColor: "#7f1d1d",
    color: "#fecaca"
  },
  debugBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 10,
    borderRadius: 8
  },
  debugBtnDisabled: { opacity: 0.5 },
  debugText: { color: "#cbd5e1", textAlign: "center", fontWeight: "700" },
  banner: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#164e63"
  },
  bannerText: { color: "#cffafe", fontWeight: "700", textAlign: "center" },
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
  techniqueBtn: {
    marginTop: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: "flex-start"
  },
  techniqueBtnText: { color: "#bae6fd", fontWeight: "700" },
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
  finishBtnText: { color: "#052e16", textAlign: "center", fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.75)",
    justifyContent: "center",
    padding: 16
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14,
    maxHeight: "70%"
  },
  modalTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  modalList: { marginTop: 4 },
  modalItem: { color: "#cbd5e1", marginBottom: 8 },
  techniqueSectionTitle: {
    color: "#e2e8f0",
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4
  },
  techniqueImage: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "#0b1220"
  },
  modalAction: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10
  },
  modalActionText: { color: "#dbeafe", textAlign: "center", fontWeight: "700" },
  modalClose: {
    marginTop: 8,
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 12
  },
  modalCloseText: { color: "#052e16", textAlign: "center", fontWeight: "800" }
});
