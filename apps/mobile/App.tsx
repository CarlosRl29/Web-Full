import React, { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { PreStartScreen } from "./src/screens/PreStartScreen";
import { GuidedWorkoutScreen } from "./src/screens/GuidedWorkoutScreen";
import { useWorkoutSession } from "./src/hooks/useWorkoutSession";

export default function App() {
  const [isPreStartOpen, setIsPreStartOpen] = useState(true);
  const {
    activeSession,
    isSyncing,
    isOnline,
    startSession,
    saveSet,
    savePointer,
    finishSession
  } = useWorkoutSession();

  const canShowWorkout = useMemo(
    () => !isPreStartOpen && !!activeSession,
    [activeSession, isPreStartOpen]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Gym Guided Mode</Text>
        <Text style={styles.subtitle}>
          {isOnline ? "Online" : "Offline"} {isSyncing ? "• sincronizando" : ""}
        </Text>
      </View>

      {canShowWorkout ? (
        <GuidedWorkoutScreen
          session={activeSession}
          onSetSave={saveSet}
          onPointerSave={savePointer}
          onFinish={finishSession}
        />
      ) : (
        <PreStartScreen
          onStart={async (payload) => {
            await startSession(payload);
            setIsPreStartOpen(false);
          }}
          onResume={() => setIsPreStartOpen(false)}
          hasActiveSession={Boolean(activeSession)}
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
  }
});
