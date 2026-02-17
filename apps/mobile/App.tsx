import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { PreStartScreen } from "./src/screens/PreStartScreen";
import { GuidedWorkoutScreen } from "./src/screens/GuidedWorkoutScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RoutinesScreen } from "./src/screens/RoutinesScreen";
import { useWorkoutSession } from "./src/hooks/useWorkoutSession";
import { clearAuthTokens, getAuthTokens, login } from "./src/services/api";
import { Routine, RoutineDay } from "./src/types";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthBooting, setIsAuthBooting] = useState(true);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [selectedDay, setSelectedDay] = useState<RoutineDay | null>(null);
  const [isPreStartOpen, setIsPreStartOpen] = useState(false);
  const {
    activeSession,
    isBooting,
    isSyncing,
    isOnline,
    pendingCount,
    queuePreview,
    startSession,
    saveSet,
    savePointer,
    finishSession,
    resetLocalSession,
    forceSync,
    retryFailed
  } = useWorkoutSession();

  useEffect(() => {
    (async () => {
      const tokens = await getAuthTokens();
      setIsAuthenticated(Boolean(tokens?.access_token));
      setIsAuthBooting(false);
    })();
  }, []);

  const canShowWorkout = useMemo(
    () => !isPreStartOpen && !!activeSession,
    [activeSession, isPreStartOpen]
  );

  const canShowPreStart = useMemo(
    () => isPreStartOpen && !!selectedRoutine && !!selectedDay,
    [isPreStartOpen, selectedRoutine, selectedDay]
  );

  if (isAuthBooting || isBooting) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.boot}>
          <ActivityIndicator color="#22d3ee" />
          <Text style={styles.subtitle}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Gym Guided Mode</Text>
        <Text style={styles.subtitle}>
          {isOnline ? "Online" : "Offline"} • Pendientes: {pendingCount}{" "}
          {isSyncing ? "• sincronizando" : ""}
        </Text>
      </View>

      {!isAuthenticated ? (
        <LoginScreen
          onLogin={async (email, password) => {
            await login({ email, password });
            setIsAuthenticated(true);
            setIsPreStartOpen(false);
          }}
        />
      ) : canShowWorkout ? (
        <GuidedWorkoutScreen
          session={activeSession!}
          isOnline={isOnline}
          isSyncing={isSyncing}
          pendingCount={pendingCount}
          queuePreview={queuePreview}
          onForceSync={forceSync}
          onRetryFailed={retryFailed}
          onSetSave={saveSet}
          onPointerSave={savePointer}
          onFinish={async () => {
            await finishSession();
            setIsPreStartOpen(false);
            setSelectedRoutine(null);
            setSelectedDay(null);
          }}
        />
      ) : canShowPreStart && selectedRoutine && selectedDay ? (
        <PreStartScreen
          onStart={async (payload) => {
            await startSession(payload, selectedDay);
            setIsPreStartOpen(false);
          }}
          onResume={() => setIsPreStartOpen(false)}
          onBack={() => setIsPreStartOpen(false)}
          routine={selectedRoutine}
          day={selectedDay}
          hasActiveSession={Boolean(activeSession)}
        />
      ) : (
        <RoutinesScreen
          onPickDay={(routine, day) => {
            setSelectedRoutine(routine);
            setSelectedDay(day);
            setIsPreStartOpen(true);
          }}
          onLogout={async () => {
            await clearAuthTokens();
            await resetLocalSession();
            setIsAuthenticated(false);
            setIsPreStartOpen(false);
            setSelectedRoutine(null);
            setSelectedDay(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a"
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b"
  },
  title: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700"
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 4
  },
  boot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10
  }
});
