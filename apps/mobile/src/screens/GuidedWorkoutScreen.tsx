import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { RestTimer } from "../components/RestTimer";
import { ActiveSession, Pointer, WorkoutGroup } from "../types";
import { getReplacements, type ReplacementOption, type SwapReason } from "../services/api";

const SWAP_REASONS: { value: SwapReason; label: string }[] = [
  { value: "EQUIPMENT_BUSY", label: "Equipo ocupado" },
  { value: "NOT_AVAILABLE", label: "No disponible" },
  { value: "PAIN", label: "Dolor" },
  { value: "PREFERENCE", label: "Preferencia" },
  { value: "TOO_HARD", label: "Muy difícil" }
];

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
  onSetSave: (
    payload: {
      workout_exercise_item_id: string;
      set_number: number;
      weight?: number;
      reps?: number;
      rpe?: number;
      is_done: boolean;
    },
    pointerUpdate?: Pointer
  ) => Promise<void>;
  onPointerSave: (pointer: Pointer) => Promise<void>;
  onSwap: (
    workoutExerciseId: string,
    body: {
      replacement_exercise_id: string;
      reason: SwapReason;
      save_preference: boolean;
    }
  ) => Promise<{ savedPreference: boolean }>;
  onBackToHome?: () => void;
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
  onSwap,
  onBackToHome,
  onFinish
}: Props) {
  const pointer = session.current_pointer;
  const group = session.workout_groups[pointer.group_index];
  const item = group?.workout_items[pointer.exercise_index];
  const setNumber = pointer.round_index + 1;
  const currentSet = item?.sets.find((s) => s.set_number === setNumber);
  const previousSet =
    item?.sets.find((s) => s.set_number === setNumber - 1 && s.is_done) ?? null;

  const [weight, setWeight] = useState(() =>
    currentSet?.weight != null ? currentSet.weight : 20
  );
  const [reps, setReps] = useState(() =>
    currentSet?.reps != null ? currentSet.reps : 10
  );

  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showTechniqueModal, setShowTechniqueModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapReason, setSwapReason] = useState<SwapReason>("PREFERENCE");
  const [replacements, setReplacements] = useState<ReplacementOption[]>([]);
  const [replacementsLoading, setReplacementsLoading] = useState(false);
  const [selectedReplacementId, setSelectedReplacementId] = useState<string | null>(null);
  const [savePreference, setSavePreference] = useState(false);
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [swapToast, setSwapToast] = useState<string | null>(null);
  const [restBanner, setRestBanner] = useState<string | null>(null);
  const [setCompletedBanner, setSetCompletedBanner] = useState(false);
  const [rest, setRest] = useState<{ label: "Transicion" | "Descanso"; seconds: number } | null>(
    null
  );
  const [editingSetNumber, setEditingSetNumber] = useState<number | null>(null);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    if (editingSetNumber != null) {
      const setToEdit = item?.sets.find((s) => s.set_number === editingSetNumber);
      if (setToEdit) {
        setWeight(setToEdit.weight ?? 20);
        setReps(setToEdit.reps ?? 10);
      }
    } else if (currentSet) {
      if (currentSet.weight != null) setWeight(currentSet.weight);
      if (currentSet.reps != null) setReps(currentSet.reps);
    }
  }, [item?.id, item?.sets, setNumber, editingSetNumber, currentSet?.weight, currentSet?.reps]);

  const completedSetsForExercise = useMemo(
    () => item?.sets.filter((s) => s.is_done) ?? [],
    [item?.sets]
  );

  const { totalSetsInSession, completedSetsInSession } = useMemo(() => {
    let total = 0;
    let completed = 0;
    for (const g of session.workout_groups) {
      for (const it of g.workout_items) {
        total += it.target_sets_total;
        completed += it.sets.filter((s) => s.is_done).length;
      }
    }
    return { totalSetsInSession: total, completedSetsInSession: completed };
  }, [session.workout_groups]);

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

  const fetchReplacements = useCallback(async () => {
    if (!item || !isOnline) return;
    setReplacementsLoading(true);
    try {
      const list = await getReplacements(session.id, item.id, {
        reason: swapReason,
        locale: "es"
      });
      setReplacements(list);
      setSelectedReplacementId(null);
    } catch {
      setReplacements([]);
    } finally {
      setReplacementsLoading(false);
    }
  }, [session.id, item?.id, swapReason, isOnline]);

  useEffect(() => {
    if (showSwapModal && item) {
      void fetchReplacements();
    }
  }, [showSwapModal, swapReason, fetchReplacements, item]);

  const handleSwapConfirm = useCallback(async () => {
    if (!item || !selectedReplacementId || swapSubmitting) return;
    setSwapSubmitting(true);
    try {
      const { savedPreference } = await onSwap(item.id, {
        replacement_exercise_id: selectedReplacementId,
        reason: swapReason,
        save_preference: savePreference
      });
      setShowSwapModal(false);
      setSwapToast(
        savedPreference ? "Ejercicio cambiado. Preferencia guardada." : "Ejercicio cambiado"
      );
      setTimeout(() => setSwapToast(null), 3000);
    } catch (err) {
      setSwapToast(err instanceof Error ? err.message : "Error al cambiar ejercicio");
      setTimeout(() => setSwapToast(null), 3000);
    } finally {
      setSwapSubmitting(false);
    }
  }, [item, selectedReplacementId, swapSubmitting, onSwap, swapReason, savePreference]);

  const [isFinishing, setIsFinishing] = useState(false);
  const handleFinish = useCallback(async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await onFinish();
    } finally {
      setIsFinishing(false);
    }
  }, [isFinishing, onFinish]);

  if (!group || !item) {
    return (
      <View style={[styles.container, styles.doneContainer]}>
        <Text style={styles.doneTitle}>Sesión completada</Text>
        <Pressable
          style={[styles.finishBtn, isFinishing && styles.disabled]}
          onPress={() => void handleFinish()}
          disabled={isFinishing}
        >
          <Text style={styles.finishBtnText}>
            {isFinishing ? "Finalizando..." : "Finalizar"}
          </Text>
        </Pressable>
        {onBackToHome ? (
          <Pressable style={styles.backBtn} onPress={onBackToHome}>
            <Text style={styles.backBtnText}>Volver al inicio</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const exerciseName = item.exercise_name ?? item.order_in_group;
  const shouldShowTransition =
    group.workout_items.length > 1 && pointer.exercise_index < group.workout_items.length - 1;
  const shouldShowRoundRest =
    pointer.exercise_index === group.workout_items.length - 1 &&
    pointer.round_index < group.rounds_total - 1;
  const shouldShowSetRest =
    group.type === "SINGLE" &&
    pointer.round_index < group.rounds_total - 1 &&
    (group.rest_after_set_seconds ?? 0) > 0;

  const next = nextPointer(pointer, session.workout_groups);
  const nextStepLabel = useMemo(() => {
    if (!next) return "¡Entrenamiento completado! Pulsa Finalizar.";
    const restSeconds =
      shouldShowTransition && group.rest_between_exercises_seconds > 0
        ? group.rest_between_exercises_seconds
        : shouldShowRoundRest && group.rest_after_round_seconds > 0
          ? group.rest_after_round_seconds
          : shouldShowSetRest
            ? group.rest_after_set_seconds ?? 0
            : 0;
    if (restSeconds > 0) return `Descanso ${restSeconds}s, luego siguiente`;
    const nextGroup = session.workout_groups[next.group_index];
    const nextItem = nextGroup?.workout_items[next.exercise_index];
    const nextExName = nextItem?.exercise_name ?? nextItem?.order_in_group ?? "siguiente";
    if (next.group_index !== pointer.group_index || next.exercise_index !== pointer.exercise_index) {
      return `Siguiente ejercicio: ${nextExName}`;
    }
    return `Siguiente: Set ${next.round_index + 1}`;
  }, [
    next,
    pointer,
    session.workout_groups,
    group.rest_between_exercises_seconds,
    group.rest_after_round_seconds,
    group.rest_after_set_seconds,
    shouldShowTransition,
    shouldShowRoundRest,
    shouldShowSetRest
  ]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {onBackToHome ? (
        <View style={styles.badgeRow}>
          <Pressable onPress={onBackToHome} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Volver al inicio</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.sessionProgress}>
        <Text style={styles.sessionProgressText}>
          Series: {completedSetsInSession} / {totalSetsInSession}
          {totalSetsInSession > 0
            ? ` (${Math.round((completedSetsInSession / totalSetsInSession) * 100)}%)`
            : ""}
        </Text>
      </View>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${
                totalSetsInSession > 0
                  ? (completedSetsInSession / totalSetsInSession) * 100
                  : 0
              }%`
            }
          ]}
        />
      </View>

      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseHeaderName}>{exerciseName}</Text>
        <Text style={styles.exerciseHeaderMeta}>
          {exerciseCurrent} / {exerciseTotal}
          {item.primary_muscle_label ? ` • ${item.primary_muscle_label}` : ""}
        </Text>
      </View>

      <View style={styles.badgeRow}>
        <Text style={styles.badge}>
          Set {setNumber}/{item.target_sets_total}
        </Text>
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

      {completedSetsForExercise.length > 0 ? (
        <View style={styles.completedSetsSection}>
          <Text style={styles.completedSetsTitle}>Sets completados (toca para editar)</Text>
          <View style={styles.completedSetsRow}>
            {completedSetsForExercise.map((s) => (
              <Pressable
                key={s.id}
                style={[
                  styles.completedSetChip,
                  editingSetNumber === s.set_number && styles.completedSetChipEditing
                ]}
                onPress={() =>
                  setEditingSetNumber(editingSetNumber === s.set_number ? null : s.set_number)
                }
              >
                <Text style={styles.completedSetChipText}>
                  Set {s.set_number}:{" "}
                  {s.weight != null && s.reps != null
                    ? `${s.weight}kg x ${s.reps}`
                    : s.weight != null
                      ? `${s.weight}kg`
                      : s.reps != null
                        ? `${s.reps} reps`
                        : "✓"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {previousSet != null &&
      (previousSet.weight != null || previousSet.reps != null) &&
      editingSetNumber == null ? (
        <View style={styles.previousSet}>
          <Text style={styles.previousSetLabel}>
            Anterior:{" "}
            {previousSet.weight != null && previousSet.reps != null
              ? `${previousSet.weight}kg x ${previousSet.reps}`
              : previousSet.weight != null
                ? `${previousSet.weight}kg`
                : `${previousSet.reps} reps`}
          </Text>
        </View>
      ) : null}

      <View style={styles.focusCard}>
        <Text style={styles.repRange}>Objetivo reps: {item.rep_range}</Text>
        <View style={styles.focusCardActions}>
          <Pressable
            style={styles.techniqueBtn}
            onPress={() => setShowTechniqueModal(true)}
          >
            <Text style={styles.techniqueBtnText}>Ver técnica</Text>
          </Pressable>
          <Pressable
            style={[styles.techniqueBtn, styles.cambiarBtn, !isOnline && styles.debugBtnDisabled]}
            onPress={() => {
              setShowSwapModal(true);
              setSelectedReplacementId(null);
              setSavePreference(false);
            }}
            disabled={!isOnline}
          >
            <Text style={styles.techniqueBtnText}>Cambiar</Text>
          </Pressable>
        </View>
      </View>

      {swapToast ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{swapToast}</Text>
        </View>
      ) : null}

      <View style={styles.quickLog}>
        <Text style={styles.logTitle}>
          {editingSetNumber != null
            ? `Editando set ${editingSetNumber}`
            : "Registro rápido (autosave)"}
        </Text>
        <View style={styles.row}>
          <Pressable style={styles.minus} onPress={() => setWeight((prev) => Math.max(0, prev - 2.5))}>
            <Text style={styles.btnText}>-</Text>
          </Pressable>
          <Text style={styles.metric}>Peso: {weight.toFixed(1)} kg</Text>
          <Pressable style={styles.plus} onPress={() => setWeight((prev) => prev + 2.5)}>
            <Text style={styles.btnText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.quickWeightRow}>
          <Pressable
            style={styles.quickWeightBtn}
            onPress={() => setWeight((prev) => prev + 2.5)}
          >
            <Text style={styles.quickWeightText}>+2.5</Text>
          </Pressable>
          <Pressable
            style={styles.quickWeightBtn}
            onPress={() => setWeight((prev) => prev + 5)}
          >
            <Text style={styles.quickWeightText}>+5</Text>
          </Pressable>
          <Pressable
            style={styles.quickWeightBtn}
            onPress={() => setWeight((prev) => prev + 10)}
          >
            <Text style={styles.quickWeightText}>+10</Text>
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

      {editingSetNumber != null ? (
        <View style={styles.editActions}>
          <Pressable
            style={styles.cancelEditBtn}
            onPress={() => setEditingSetNumber(null)}
          >
            <Text style={styles.cancelEditText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={styles.saveEditBtn}
            onPress={async () => {
              try {
                await onSetSave(
                  {
                    workout_exercise_item_id: item.id,
                    set_number: editingSetNumber,
                    weight,
                    reps,
                    is_done: true
                  }
                );
                setEditingSetNumber(null);
                setSwapToast("Set actualizado");
                setTimeout(() => setSwapToast(null), 2000);
              } catch (err) {
                setSwapToast(err instanceof Error ? err.message : "Error al guardar.");
                setTimeout(() => setSwapToast(null), 4000);
              }
            }}
          >
            <Text style={styles.saveEditText}>Guardar cambios</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable
            style={[styles.finishSetBtn, setCompletedBanner && styles.finishSetBtnDone]}
            onPress={async () => {
              const nextPtr = nextPointer(pointer, session.workout_groups);
              const setPayload = {
                workout_exercise_item_id: item.id,
                set_number: setNumber,
                weight,
                reps,
                is_done: true
              };

              try {
                if (nextPtr) {
                  await onSetSave(setPayload, nextPtr);
                } else {
                  await onSetSave(setPayload);
                }
              } catch (err) {
                setSwapToast(err instanceof Error ? err.message : "Error al guardar. Reintenta.");
                setTimeout(() => setSwapToast(null), 4000);
                return;
              }

              setSetCompletedBanner(true);
              setTimeout(() => setSetCompletedBanner(false), 1500);

              let restSeconds = 0;
              let restLabel: "Transicion" | "Descanso" = "Descanso";
              if (shouldShowTransition && group.rest_between_exercises_seconds > 0) {
                restSeconds = group.rest_between_exercises_seconds;
                restLabel = "Transicion";
              } else if (shouldShowRoundRest && group.rest_after_round_seconds > 0) {
                restSeconds = group.rest_after_round_seconds;
                restLabel = "Descanso";
              } else if (shouldShowSetRest) {
                restSeconds = group.rest_after_set_seconds ?? 0;
                restLabel = "Descanso";
              }

              if (restSeconds > 0) {
                setRest({ label: restLabel, seconds: restSeconds });
              }

              if (!nextPtr) {
                await onFinish();
                return;
              }
            }}
          >
            <Text style={styles.finishSetText}>
              {setCompletedBanner ? "✓ Set completado" : "Completar set"}
            </Text>
          </Pressable>
          <Text style={styles.nextStepHint}>{nextStepLabel}</Text>
        </>
      )}

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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {exerciseName}
              </Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setShowTechniqueModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.modalCloseBtnText}>✕ Salir</Text>
              </Pressable>
            </View>
            <ScrollView
              style={[styles.techniqueScroll, { maxHeight: windowHeight * 0.45 }]}
              showsVerticalScrollIndicator
              contentContainerStyle={styles.techniqueScrollContent}
            >
              {item.exercise_media_url?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                <View style={styles.techniqueImageWrap}>
                  <Image
                    source={{ uri: item.exercise_media_url }}
                    style={styles.techniqueImage}
                    resizeMode="contain"
                  />
                </View>
              ) : item.exercise_media_url ? (
                <Pressable
                  style={styles.modalAction}
                  onPress={() => void Linking.openURL(item.exercise_media_url!)}
                >
                  <Text style={styles.modalActionText}>Abrir imagen / video</Text>
                </Pressable>
              ) : null}
              <Text style={styles.techniqueSectionTitle}>Descripción</Text>
              <Text style={styles.modalItem}>
                {item.exercise_description ?? "Sin descripción disponible para este ejercicio."}
              </Text>
              <Text style={styles.techniqueSectionTitle}>Técnica / recomendaciones</Text>
              <Text style={styles.modalItem}>{item.notes ?? "Sin recomendaciones específicas."}</Text>
            </ScrollView>
            <Pressable style={styles.modalClose} onPress={() => setShowTechniqueModal(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSwapModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSwapModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cambiar ejercicio</Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setShowSwapModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.modalCloseBtnText}>✕ Cerrar</Text>
              </Pressable>
            </View>
            <Text style={styles.swapSubtitle}>Motivo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reasonRow}>
              {SWAP_REASONS.map((r) => (
                <Pressable
                  key={r.value}
                  style={[
                    styles.reasonChip,
                    swapReason === r.value && styles.reasonChipSelected
                  ]}
                  onPress={() => setSwapReason(r.value)}
                >
                  <Text
                    style={[
                      styles.reasonChipText,
                      swapReason === r.value && styles.reasonChipTextSelected
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.swapSubtitle}>Reemplazos sugeridos</Text>
            {replacementsLoading ? (
              <View style={styles.swapLoading}>
                <ActivityIndicator color="#22d3ee" />
                <Text style={styles.modalItem}>Cargando...</Text>
              </View>
            ) : replacements.length === 0 ? (
              <Text style={styles.modalItem}>No hay reemplazos disponibles.</Text>
            ) : (
              <ScrollView
                style={[styles.techniqueScroll, { maxHeight: windowHeight * 0.3 }]}
                showsVerticalScrollIndicator
              >
                {replacements.map((r) => (
                  <Pressable
                    key={r.id}
                    style={[
                      styles.replacementCard,
                      selectedReplacementId === r.id && styles.replacementCardSelected
                    ]}
                    onPress={() => setSelectedReplacementId(r.id)}
                  >
                    <Text style={styles.replacementName}>{r.display_name}</Text>
                    {r.equipment ? (
                      <Text style={styles.replacementEquipment}>{r.equipment}</Text>
                    ) : null}
                    <Text style={styles.replacementExplanation}>{r.explanation}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable
              style={[styles.savePrefToggle, savePreference && styles.savePrefToggleOn]}
              onPress={() => setSavePreference((p) => !p)}
            >
              <Text style={styles.savePrefText}>Guardar preferencia</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalClose,
                (!selectedReplacementId || swapSubmitting) && styles.modalCloseDisabled
              ]}
              onPress={() => void handleSwapConfirm()}
              disabled={!selectedReplacementId || swapSubmitting}
            >
              <Text style={styles.modalCloseText}>
                {swapSubmitting ? "Cambiando..." : "Confirmar"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  doneContainer: { padding: 16, justifyContent: "center", alignItems: "center", gap: 16 },
  backBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10
  },
  backBtnText: { color: "#94a3b8", fontWeight: "700" },
  backLink: { paddingVertical: 8, paddingHorizontal: 12 },
  backLinkText: { color: "#22d3ee", fontWeight: "700", fontSize: 14 },
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
  exerciseHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b"
  },
  exerciseHeaderName: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4
  },
  exerciseHeaderMeta: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600"
  },
  previousSet: {
    backgroundColor: "#1e3a5f",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8
  },
  previousSetLabel: {
    color: "#93c5fd",
    fontSize: 15,
    fontWeight: "700"
  },
  completedSetsSection: { marginBottom: 12 },
  completedSetsTitle: { color: "#94a3b8", fontSize: 12, marginBottom: 8, fontWeight: "600" },
  completedSetsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  completedSetChip: {
    backgroundColor: "#1e3a5f",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent"
  },
  completedSetChipEditing: { borderColor: "#22d3ee" },
  completedSetChipText: { color: "#cbd5e1", fontSize: 13, fontWeight: "600" },
  editActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelEditBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center"
  },
  cancelEditText: { color: "#94a3b8", fontWeight: "700" },
  saveEditBtn: {
    flex: 1,
    backgroundColor: "#22d3ee",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center"
  },
  saveEditText: { color: "#0f172a", fontWeight: "800" },
  nextStepHint: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic"
  },
  sessionProgress: { marginBottom: 6 },
  sessionProgressText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
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
  focusCardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12
  },
  techniqueBtn: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  cambiarBtn: { backgroundColor: "#1e3a5f" },
  techniqueBtnText: { color: "#bae6fd", fontWeight: "700" },
  quickLog: {
    marginTop: 14,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14
  },
  logTitle: { color: "#f8fafc", fontWeight: "700", marginBottom: 12, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  quickWeightRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 4
  },
  quickWeightBtn: {
    flex: 1,
    backgroundColor: "#334155",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center"
  },
  quickWeightText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 14
  },
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
  progressBar: {
    height: 6,
    backgroundColor: "#1e293b",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#22c55e",
    borderRadius: 3
  },
  finishSetBtnDone: {
    backgroundColor: "#22c55e",
    opacity: 0.9
  },
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
  disabled: { opacity: 0.7 },
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
    maxHeight: "85%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8
  },
  modalTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "700", flex: 1 },
  modalCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#334155",
    borderRadius: 8
  },
  modalCloseBtnText: { color: "#f8fafc", fontWeight: "700", fontSize: 14 },
  techniqueScroll: {},
  techniqueScrollContent: { paddingBottom: 16 },
  techniqueImageWrap: { marginBottom: 12 },
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
  modalCloseDisabled: { opacity: 0.5 },
  modalCloseText: { color: "#052e16", textAlign: "center", fontWeight: "800" },
  swapSubtitle: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6
  },
  reasonRow: { marginBottom: 8 },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    marginRight: 8
  },
  reasonChipSelected: { backgroundColor: "#0ea5e9" },
  reasonChipText: { color: "#cbd5e1", fontWeight: "600" },
  reasonChipTextSelected: { color: "#fff" },
  swapLoading: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16 },
  replacementCard: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent"
  },
  replacementCardSelected: { borderColor: "#0ea5e9" },
  replacementName: { color: "#f8fafc", fontWeight: "700", fontSize: 16 },
  replacementEquipment: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  replacementExplanation: { color: "#94a3b8", fontSize: 13, marginTop: 6 },
  savePrefToggle: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155"
  },
  savePrefToggleOn: { backgroundColor: "#164e63", borderColor: "#22d3ee" },
  savePrefText: { color: "#cbd5e1", fontWeight: "600" }
});
