import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Props = {
  onLogin: (email: string, password: string) => Promise<void>;
};

export function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar sesion</Text>
      <Text style={styles.caption}>Accede para cargar tus rutinas reales</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
        placeholder="tu@email.com"
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        style={styles.input}
        placeholder="********"
        placeholderTextColor="#64748b"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.cta, isLoading && styles.disabled]}
        disabled={isLoading}
        onPress={async () => {
          setError(null);
          setIsLoading(true);
          try {
            await onLogin(email.trim(), password);
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo iniciar sesion");
          } finally {
            setIsLoading(false);
          }
        }}
      >
        {isLoading ? (
          <ActivityIndicator color="#052e16" />
        ) : (
          <Text style={styles.ctaText}>Entrar</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "700" },
  caption: { color: "#94a3b8", marginTop: 6, marginBottom: 16 },
  label: { color: "#cbd5e1", marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    borderRadius: 10,
    padding: 12
  },
  error: { marginTop: 10, color: "#f87171", fontWeight: "600" },
  cta: {
    marginTop: 18,
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    borderRadius: 10
  },
  disabled: { opacity: 0.7 },
  ctaText: { textAlign: "center", fontWeight: "700", color: "#052e16" }
});
