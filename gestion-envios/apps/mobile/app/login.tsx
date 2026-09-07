import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AuroraBackground } from "@/components/aurora-background";
import { AppInput, AppMark, GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { haptic } from "@/lib/haptics";
import { useMovii } from "@/lib/movii-context";

export default function LoginScreen() {
  const [email, setEmail] = useState("repartidor@movii.demo");
  const [password, setPassword] = useState("Movii2026!");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useMovii();

  const enterDemo = async () => {
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (err) {
      setError("No se pudo iniciar sesión. Verificá el email y la contraseña.");
    } finally {
      setCargando(false);
    }
  };

  return <AuroraBackground><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}><View style={styles.content}><View style={styles.brandBlock}><AppMark size="hero" /><Text style={styles.kicker}>OPERACIÓN DE ÚLTIMA MILLA</Text><Text style={styles.title}>Tu jornada, siempre en movimiento.</Text><Text style={styles.subtitle}>Ingresá y continuá con la ruta asignada a tu perfil.</Text></View><GlassCard style={styles.card}><View style={styles.cardIntro}><Text style={styles.cardTitle}>Bienvenido de nuevo</Text><Text style={styles.cardDescription}>Accedé a tu ruta de reparto.</Text></View><View style={styles.form}><AppInput label="Correo electrónico" value={email} onChangeText={setEmail} placeholder="nombre@movii.com" keyboardType="email-address" /><AppInput label="Contraseña" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry /></View><Pressable onPress={() => { haptic.selection(); setKeepSignedIn((current) => !current); }} style={({ pressed }) => [styles.keepSession, pressed && styles.pressed]} accessibilityRole="checkbox" accessibilityState={{ checked: keepSignedIn }} accessibilityLabel="Mantener sesión iniciada"><View style={[styles.checkbox, keepSignedIn && styles.checkboxChecked]}>{keepSignedIn ? <Text style={styles.checkboxCheck}>✓</Text> : null}</View><Text style={styles.keepSessionText}>Mantener sesión iniciada</Text></Pressable><PrimaryButton label={cargando ? "Ingresando…" : "Ingresar"} onPress={enterDemo} icon="→" disabled={cargando} />{error ? <Text style={styles.errorText}>{error}</Text> : null}<Pressable onPress={() => { haptic.light(); router.push("/forgot-password"); }} style={({ pressed }) => [styles.forgotButton, pressed && styles.pressed]} accessibilityRole="link" accessibilityLabel="Recuperar contraseña"><Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text></Pressable></GlassCard><Pressable onPress={() => router.push("/tracking")} style={({ pressed }) => [styles.trackingLink, pressed && styles.pressed]} accessibilityRole="link" accessibilityLabel="Seguir mi envío sin iniciar sesión"><Text style={styles.trackingIcon}>⌁</Text><View style={styles.trackingCopy}><Text style={styles.trackingTitle}>¿Esperás un pedido?</Text><Text style={styles.trackingText}>Seguí tu envío con el código de guía</Text></View><Text style={styles.trackingChevron}>›</Text></Pressable></View></KeyboardAvoidingView></AuroraBackground>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { flex: 1, width: "100%", maxWidth: 500, alignSelf: "center", justifyContent: "center", paddingHorizontal: 22, paddingVertical: 28, gap: 22 }, brandBlock: { alignItems: "flex-start", gap: 8 }, kicker: { color: "#6E6E73", fontSize: 11, fontWeight: "800", letterSpacing: 1.05, marginTop: 9 }, title: { color: "#1C1C1E", fontSize: 29, lineHeight: 34, fontWeight: "800", letterSpacing: -0.95, maxWidth: 330 }, subtitle: { color: "#6E6E73", fontSize: 14, lineHeight: 20, maxWidth: 305 }, card: { gap: 16, padding: 20 }, cardIntro: { gap: 4 }, cardTitle: { color: "#1C1C1E", fontSize: 21, lineHeight: 25, fontWeight: "800", letterSpacing: -0.55, textAlign: "center" }, cardDescription: { color: "#6E6E73", fontSize: 14, textAlign: "center" }, form: { gap: 12 }, keepSession: { flexDirection: "row", alignItems: "center", gap: 9, alignSelf: "flex-start", minHeight: 30, marginTop: -2 }, checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: "#AEAEB2", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }, checkboxChecked: { backgroundColor: "#FFD60A", borderColor: "#D7AA00" }, checkboxCheck: { color: "#1C1C1E", fontSize: 13, fontWeight: "900", marginTop: -1 }, keepSessionText: { color: "#3A3A3C", fontSize: 13, fontWeight: "600" }, forgotButton: { minHeight: 28, justifyContent: "center", alignSelf: "center", marginTop: -7 }, forgot: { color: "#806700", fontSize: 13, fontWeight: "700", textAlign: "center" }, trackingLink: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 12, padding: 15, backgroundColor: "rgba(255,255,255,0.52)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 18 }, trackingIcon: { fontSize: 25, color: "#1C1C1E", width: 30, textAlign: "center" }, trackingCopy: { flex: 1 }, trackingTitle: { color: "#1C1C1E", fontSize: 14, fontWeight: "800" }, trackingText: { color: "#6E6E73", fontSize: 12, marginTop: 3 }, trackingChevron: { color: "#6E6E73", fontSize: 27, fontWeight: "300" }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] }, errorText: { color: "#D70015", fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: -6 }, });
