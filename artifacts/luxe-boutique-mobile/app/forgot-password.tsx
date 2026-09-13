import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/lib/api";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;

  const handleSubmit = async () => {
    if (!email.trim()) { setError("Please enter your email address"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok || res.status === 200) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Pressable
        style={[styles.closeBtn, { top: insets.top + WEB_TOP + 16 }]}
        onPress={() => router.back()}
      >
        <Feather name="x" size={22} color={colors.foreground} />
      </Pressable>

      <View style={[styles.content, { paddingTop: insets.top + WEB_TOP + 80 }]}>
        {sent ? (
          <>
            <View style={[styles.sentIcon, { backgroundColor: "#f0fdf4" }]}>
              <Feather name="mail" size={32} color="#22c55e" />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Check Your Email</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              If an account exists for {email}, you'll receive a password reset link shortly.
            </Text>
            <Pressable
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.back()}
            >
              <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>Back to Sign In</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>Account Recovery</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Forgot Password?</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>

            {error && (
              <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}

            <View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Email Address</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                placeholder="your@email.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Pressable
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>Send Reset Link</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.back()}>
              <Text style={[styles.backLink, { color: colors.mutedForeground }]}>
                Remember your password?{" "}
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Sign In</Text>
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  closeBtn: { position: "absolute", right: 20, zIndex: 10, padding: 8 },
  content: { flex: 1, padding: 24, gap: 20 },
  sentIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase" },
  title: { fontSize: 32, fontWeight: "300", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20, fontWeight: "300" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderWidth: 1 },
  errorText: { fontSize: 13, fontWeight: "500", flex: 1 },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
  submitBtn: { paddingVertical: 16, alignItems: "center" },
  submitBtnText: { fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  backLink: { fontSize: 13, textAlign: "center" },
});
