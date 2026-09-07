import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AuroraBackground } from "@/components/aurora-background";
import { AppInput, AppMark, GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { useMovii } from "@/lib/movii-context";

export default function TrackingScreen() {
  const [code, setCode] = useState("MOV-2026-000777");
  const [notFound, setNotFound] = useState(false);
  const { findShipment } = useMovii();
  const search = () => {
    const normalized = code.trim().toUpperCase();
    if (findShipment(normalized)) { setNotFound(false); router.push({ pathname: "/tracking/[code]", params: { code: normalized } }); }
    else setNotFound(true);
  };
  return <AuroraBackground><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}><View style={styles.content}><View style={styles.top}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Volver"><Text style={styles.backText}>‹</Text></Pressable><AppMark /></View><View style={styles.hero}><Text style={styles.kicker}>TRACKING MOVII</Text><Text style={styles.title}>Seguí tu envío en tiempo real.</Text><Text style={styles.subtitle}>Ingresá el código de guía para conocer el estado de tu pedido.</Text></View><GlassCard style={styles.searchCard}><AppInput label="Código de guía" value={code} onChangeText={(value) => { setCode(value); setNotFound(false); }} placeholder="MOV-2026-000777" autoCapitalize="characters" /><PrimaryButton label="Ver estado del envío" onPress={search} icon="→" />{notFound ? <Text style={styles.error}>No encontramos ese código. Probá con MOV-2026-000777.</Text> : null}</GlassCard><Pressable onPress={() => { setCode("MOV-2026-000777"); setNotFound(false); }} style={({ pressed }) => [styles.example, pressed && styles.pressed]}><View style={styles.exampleIcon}><Text style={styles.exampleIconText}>⌁</Text></View><View style={styles.exampleCopy}><Text style={styles.exampleTitle}>Probá el tracking completo</Text><Text style={styles.exampleText}>Usá MOV-2026-000777 para ver un envío en camino.</Text></View><Text style={styles.exampleArrow}>›</Text></Pressable><Text style={styles.footer}>Movii · Entregas simples, información clara.</Text></View></KeyboardAvoidingView></AuroraBackground>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { flex: 1, paddingHorizontal: 22, paddingTop: 56, paddingBottom: 28, gap: 25, maxWidth: 500, width: "100%", alignSelf: "center" }, top: { flexDirection: "row", alignItems: "center", gap: 14 }, back: { width: 38, height: 38, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" }, backText: { color: "#1C1C1E", fontSize: 31, fontWeight: "300", lineHeight: 34, marginTop: -4 }, hero: { gap: 8 }, kicker: { color: "#6E6E73", fontSize: 11, fontWeight: "800", letterSpacing: 1 }, title: { color: "#1C1C1E", fontSize: 31, lineHeight: 36, fontWeight: "800", letterSpacing: -1 }, subtitle: { color: "#6E6E73", fontSize: 15, lineHeight: 21, maxWidth: 340 }, searchCard: { gap: 16, padding: 20 }, error: { color: "#B42318", fontSize: 12, lineHeight: 17, marginTop: -7 }, example: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.52)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)" }, exampleIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFF4CC", alignItems: "center", justifyContent: "center" }, exampleIconText: { color: "#806700", fontSize: 20 }, exampleCopy: { flex: 1 }, exampleTitle: { color: "#1C1C1E", fontSize: 14, fontWeight: "800" }, exampleText: { color: "#6E6E73", fontSize: 12, lineHeight: 17, marginTop: 3 }, exampleArrow: { color: "#6E6E73", fontSize: 25, fontWeight: "300" }, footer: { color: "#8E8E93", fontSize: 11, textAlign: "center", marginTop: "auto" }, pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] }, });
