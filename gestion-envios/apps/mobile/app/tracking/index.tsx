import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AuroraBackground } from "@/components/aurora-background";
import { AppInput, AppMark, GlassCard, PrimaryButton } from "@/components/ui/movii-ui";

/** HU-10: búsqueda pública por código de guía. La consulta la hace la pantalla de detalle contra la API. */
export default function TrackingScreen() {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const search = () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) { setError(true); return; }
    setError(false);
    router.push({ pathname: "/tracking/[code]", params: { code: normalized } });
  };
  return <AuroraBackground><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}><View style={styles.content}><View style={styles.top}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Volver"><Text style={styles.backText}>‹</Text></Pressable><AppMark /></View><View style={styles.hero}><Text style={styles.kicker}>TRACKING MOVII</Text><Text style={styles.title}>Seguí tu envío en tiempo real.</Text><Text style={styles.subtitle}>Ingresá el código de guía para conocer el estado de tu pedido.</Text></View><GlassCard style={styles.searchCard}><AppInput label="Código de guía" value={code} onChangeText={(value) => { setCode(value); setError(false); }} placeholder="MOV-20261022-0001" autoCapitalize="characters" /><PrimaryButton label="Ver estado del envío" onPress={search} icon="→" />{error ? <Text style={styles.error}>Ingresá el código de guía que figura en tu comprobante.</Text> : null}</GlassCard><Text style={styles.footer}>Movii · Entregas simples, información clara.</Text></View></KeyboardAvoidingView></AuroraBackground>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { flex: 1, paddingHorizontal: 22, paddingTop: 56, paddingBottom: 28, gap: 25, maxWidth: 500, width: "100%", alignSelf: "center" }, top: { flexDirection: "row", alignItems: "center", gap: 14 }, back: { width: 38, height: 38, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" }, backText: { color: "#1C1C1E", fontSize: 31, fontWeight: "300", lineHeight: 34, marginTop: -4 }, hero: { gap: 8 }, kicker: { color: "#6E6E73", fontSize: 11, fontWeight: "800", letterSpacing: 1 }, title: { color: "#1C1C1E", fontSize: 31, lineHeight: 36, fontWeight: "800", letterSpacing: -1 }, subtitle: { color: "#6E6E73", fontSize: 15, lineHeight: 21, maxWidth: 340 }, searchCard: { gap: 16, padding: 20 }, error: { color: "#B42318", fontSize: 12, lineHeight: 17, marginTop: -7 }, footer: { color: "#8E8E93", fontSize: 11, textAlign: "center", marginTop: "auto" }, pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] }, });
