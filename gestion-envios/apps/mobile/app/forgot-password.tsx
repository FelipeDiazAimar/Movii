import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { AuroraBackground } from "@/components/aurora-background";
import { AppInput, GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { haptic } from "@/lib/haptics";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = () => { setSent(true); haptic.success(); };
  return <AuroraBackground><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}><AppHeader title="Recuperar acceso" /><View style={styles.content}>{sent ? <GlassCard style={styles.card}><View style={styles.successIcon}><Text style={styles.successCheck}>✓</Text></View><Text style={styles.title}>Revisá tu correo</Text><Text style={styles.copy}>Si existe una cuenta asociada a <Text style={styles.strong}>{email}</Text>, enviamos las instrucciones para restablecer tu contraseña.</Text><PrimaryButton label="Volver a ingresar" onPress={() => router.replace("/login")} /></GlassCard> : <GlassCard style={styles.card}><Text style={styles.title}>¿No recordás tu contraseña?</Text><Text style={styles.copy}>Ingresá tu correo de Movii. Te enviaremos instrucciones para recuperar el acceso.</Text><AppInput label="Correo electrónico" value={email} onChangeText={setEmail} placeholder="nombre@movii.com" keyboardType="email-address" /><PrimaryButton label="Enviar instrucciones" onPress={submit} disabled={!email.includes("@") } icon="→" /><Text style={styles.disclaimer}>Este flujo es demostrativo: no se enviará ningún correo real.</Text></GlassCard>}</View></KeyboardAvoidingView></AuroraBackground>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { flex: 1, width: "100%", maxWidth: 500, alignSelf: "center", justifyContent: "center", padding: 22 }, card: { gap: 16, padding: 21, alignItems: "stretch" }, title: { color: "#1C1C1E", fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.7, textAlign: "center" }, copy: { color: "#6E6E73", fontSize: 14, lineHeight: 20, textAlign: "center" }, strong: { color: "#1C1C1E", fontWeight: "800" }, disclaimer: { color: "#8E8E93", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: -4 }, successIcon: { width: 50, height: 50, alignSelf: "center", borderRadius: 25, backgroundColor: "#E9F8EC", justifyContent: "center", alignItems: "center" }, successCheck: { color: "#207B34", fontSize: 24, fontWeight: "800" }, });
