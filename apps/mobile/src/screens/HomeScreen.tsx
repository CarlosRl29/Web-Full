import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { getActiveRoutine } from "../services/api";
import { ActiveSession, Routine } from "../types";

type Props = {
  activeSession?: ActiveSession | null;
  onContinuar?: () => void;
  onEntrenar: (routine: Routine) => void;
  onEjercicios: () => void;
  onLogout: () => Promise<void>;
};

export function HomeScreen({
  activeSession,
  onContinuar,
  onEntrenar,
  onEjercicios,
  onLogout
}: Props) {
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActiveRoutine = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const routine = await getActiveRoutine();
      setActiveRoutine(routine);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la rutina activa");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActiveRoutine();
  }, [loadActiveRoutine]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22d3ee" size="large" />
        <Text style={styles.subtitle}>Cargando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>AXION</Text>
        <Pressable onPress={() => void onLogout()} style={styles.logout}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      </View>

      <Text style={styles.greeting}>Hola</Text>
      <Text style={styles.caption}>Tu rutina activa</Text>

      {error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void loadActiveRoutine()} style={styles.retry}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : !activeRoutine ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>No tienes rutina activa</Text>
          <Text style={styles.emptyCaption}>
            Activa una rutina desde la app web para poder entrenar aqui.
          </Text>
          <Pressable style={styles.ctaDisabled} disabled>
            <Text style={styles.ctaDisabledText}>Entrenar hoy</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.routineName}>{activeRoutine.name}</Text>
          {activeRoutine.description ? (
            <Text style={styles.routineDesc}>{activeRoutine.description}</Text>
          ) : null}
          <Pressable style={styles.cta} onPress={() => onEntrenar(activeRoutine)}>
            <Text style={styles.ctaText}>Entrenar hoy</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.quickLinks}>
        <Pressable style={styles.linkCard} onPress={onEjercicios}>
          <Text style={styles.linkTitle}>Ejercicios</Text>
          <Text style={styles.linkCaption}>Explorar biblioteca</Text>
        </Pressable>
      </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24
  },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "800" },
  logout: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  logoutText: { color: "#cbd5e1", fontWeight: "700" },
  greeting: { color: "#94a3b8", fontSize: 14 },
  caption: { color: "#cbd5e1", fontSize: 16, marginTop: 4, marginBottom: 12 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 16,
    marginBottom: 16
  },
  routineName: { color: "#f8fafc", fontSize: 20, fontWeight: "700" },
  routineDesc: { color: "#94a3b8", marginTop: 4, fontSize: 14 },
  cta: {
    marginTop: 16,
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    borderRadius: 10
  },
  ctaText: { textAlign: "center", color: "#052e16", fontWeight: "800", fontSize: 16 },
  ctaContinuar: {
    marginTop: 16,
    backgroundColor: "#22d3ee",
    paddingVertical: 14,
    borderRadius: 10
  },
  continuarTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
  continuarCaption: { color: "#94a3b8", marginTop: 8, fontSize: 14 },
  ctaDisabled: {
    marginTop: 16,
    backgroundColor: "#334155",
    paddingVertical: 14,
    borderRadius: 10,
    opacity: 0.7
  },
  ctaDisabledText: { textAlign: "center", color: "#94a3b8", fontWeight: "700" },
  emptyTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
  emptyCaption: { color: "#94a3b8", marginTop: 8 },
  error: { color: "#f87171", fontWeight: "600" },
  retry: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1e293b",
    borderRadius: 8
  },
  retryText: { color: "#22d3ee", fontWeight: "700" },
  subtitle: { color: "#94a3b8", marginTop: 8 },
  quickLinks: { marginTop: 8 },
  linkCard: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 14
  },
  linkTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "700" },
  linkCaption: { color: "#94a3b8", fontSize: 13, marginTop: 2 }
});
