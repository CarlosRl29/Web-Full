import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  label: "Transicion" | "Descanso";
  seconds: number;
  onDone: () => void;
};

export function RestTimer({ label, seconds, onDone }: Props) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }

    const id = setTimeout(() => setLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(id);
  }, [left, onDone]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.time}>{left}s</Text>
      <View style={styles.row}>
        <Pressable onPress={onDone} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Skip</Text>
        </Pressable>
        <Pressable onPress={() => setLeft((prev) => prev + 15)} style={styles.primaryBtn}>
          <Text style={styles.primaryText}>+15s</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#1e293b",
    padding: 14,
    borderRadius: 12,
    marginTop: 12
  },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
  time: { color: "#22d3ee", fontSize: 30, fontWeight: "800", marginTop: 6 },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 12,
    borderRadius: 8
  },
  secondaryText: { textAlign: "center", color: "#cbd5e1", fontWeight: "700" },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#0ea5e9",
    paddingVertical: 12,
    borderRadius: 8
  },
  primaryText: { textAlign: "center", color: "#082f49", fontWeight: "800" }
});
