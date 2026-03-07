import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { PreStartScreen } from "./src/screens/PreStartScreen";
import { GuidedWorkoutScreen } from "./src/screens/GuidedWorkoutScreen";
import { WorkoutSummaryScreen, type FinishedSessionData } from "./src/screens/WorkoutSummaryScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ActiveRoutineScreen } from "./src/screens/ActiveRoutineScreen";
import { ExerciseLibraryScreen } from "./src/screens/ExerciseLibraryScreen";
import { useWorkoutSession } from "./src/hooks/useWorkoutSession";
import { clearAuthTokens, getAuthTokens, login } from "./src/services/api";
import { Routine, RoutineDay } from "./src/types";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthBooting, setIsAuthBooting] = useState(true);
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [selectedDay, setSelectedDay] = useState<RoutineDay | null>(null);
  const [isPreStartOpen, setIsPreStartOpen] = useState(false);
  const [screen, setScreen] = useState<"home" | "workout" | "active-routine" | "exercises">("home");
  const [finishedSession, setFinishedSession] = useState<FinishedSessionData | null>(null);
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
    onSwap,
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
    () =>
      !isPreStartOpen &&
      !!activeSession &&
      screen === "workout" &&
      !finishedSession,
    [activeSession, isPreStartOpen, screen, finishedSession]
  );

  const canShowSummary = useMemo(
    () => !!finishedSession,
    [finishedSession]
  );

  useEffect(() => {
    if (!isBooting && activeSession && screen === "home") {
      setScreen("workout");
    }
  }, [activeSession, isBooting, screen]);

  const handleContinuar = useCallback(() => {
    setScreen("workout");
  }, []);

  const canShowPreStart = useMemo(
    () => isPreStartOpen && !!activeRoutine && !!selectedDay,
    [isPreStartOpen, activeRoutine, selectedDay]
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
      ) : canShowSummary && finishedSession ? (
        <WorkoutSummaryScreen
          session={finishedSession}
          onBackToHome={() => {
            setFinishedSession(null);
            setIsPreStartOpen(false);
            setSelectedDay(null);
            setScreen("home");
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
          onSwap={onSwap}
          onBackToHome={() => setScreen("home")}
          onFinish={async () => {
            const result = await finishSession();
            if (result) {
              setFinishedSession(result as FinishedSessionData);
            } else {
              setIsPreStartOpen(false);
              setSelectedDay(null);
              setScreen("home");
            }
          }}
        />
      ) : canShowPreStart && activeRoutine && selectedDay ? (
        <PreStartScreen
          activeSession={activeSession}
          onStart={async (payload) => {
            await startSession(payload, selectedDay);
            setIsPreStartOpen(false);
            setScreen("workout");
          }}
          onResume={() => {
            setIsPreStartOpen(false);
            setScreen("workout");
          }}
          onBack={() => {
            setIsPreStartOpen(false);
            setSelectedDay(null);
          }}
          routine={activeRoutine}
          day={selectedDay}
        />
      ) : screen === "exercises" ? (
        <ExerciseLibraryScreen
          onBack={() => setScreen("home")}
        />
      ) : screen === "active-routine" && activeRoutine ? (
        <ActiveRoutineScreen
          routine={activeRoutine}
          onPickDay={(day) => {
            setSelectedDay(day);
            setIsPreStartOpen(true);
          }}
          onBack={() => {
            setScreen("home");
            setActiveRoutine(null);
          }}
        />
      ) : (
        <HomeScreen
          activeSession={activeSession}
          onContinuar={handleContinuar}
          onEntrenar={(routine) => {
            setActiveRoutine(routine);
            setScreen("active-routine");
          }}
          onEjercicios={() => setScreen("exercises")}
          onLogout={async () => {
            await clearAuthTokens();
            await resetLocalSession();
            setIsAuthenticated(false);
            setIsPreStartOpen(false);
            setActiveRoutine(null);
            setSelectedDay(null);
            setScreen("home");
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
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b"
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  tabActive: { backgroundColor: "#1e3a5f" },
  tabText: { color: "#94a3b8", fontWeight: "600" },
  tabTextActive: { color: "#22d3ee" }
});
