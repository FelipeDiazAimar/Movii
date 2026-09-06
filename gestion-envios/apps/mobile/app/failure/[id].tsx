import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { AuroraBackground } from "@/components/aurora-background";
import { GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { haptic } from "@/lib/haptics";
import { useMovii } from "@/lib/movii-context";

const reasons = ["Destinatario ausente", "Dirección incorrecta", "Rechazado por el cliente", "Acceso sin autorización", "Otro motivo"];

export default function FailureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findShipment, setShipmentStatus } = useMovii();
  const shipment = findShipment(id);
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [proofReady, setProofReady] = useState(false);
  if (!shipment) return null;
  const save = () => { setShipmentStatus(shipment.id, "no_entregado", { failureReason: note.trim() ? `${reason}: ${note.trim()}` : reason, hasProof: proofReady }); haptic.error(); router.replace({ pathname: "/stop/[id]", params: { id: shipment.id } }); };
  return <View style={styles.page}><AuroraBackground style={StyleSheet.absoluteFill} /><AppHeader title="Registrar incidencia" subtitle={shipment.code} /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><GlassCard><Text style={styles.introTitle}>No se pudo completar la entrega</Text><Text style={styles.introCopy}>Seleccioná el motivo y agregá información para que el equipo pueda resolver el siguiente paso.</Text></GlassCard><Text style={styles.section}>Motivo</Text><View style={styles.reasons}>{reasons.map((item) => <Pressable key={item} onPress={() => { haptic.selection(); setReason(item); }} style={[styles.reason, reason === item && styles.reasonActive]}><View style={[styles.radio, reason === item && styles.radioActive]}>{reason === item ? <View style={styles.radioInner} /> : null}</View><Text style={[styles.reasonText, reason === item && styles.reasonTextActive]}>{item}</Text></Pressable>)}</View><Text style={styles.section}>Nota adicional</Text><TextInput value={note} onChangeText={setNote} placeholder="Contanos qué ocurrió…" placeholderTextColor="#AEAEB2" multiline style={styles.note} accessibilityLabel="Nota adicional" /><GlassCard style={styles.proof}><View><Text style={styles.proofTitle}>{proofReady ? "Foto adjuntada" : "Evidencia opcional"}</Text><Text style={styles.proofCopy}>Podés registrar una foto del intento de entrega.</Text></View><PrimaryButton label={proofReady ? "Quitar" : "Simular foto"} tone="secondary" onPress={() => setProofReady((current) => !current)} /></GlassCard><PrimaryButton label="Guardar incidencia" tone="danger" onPress={save} icon="!" /></ScrollView></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#F7F7F8" }, content: { padding: 16, paddingTop: 10, paddingBottom: 34, gap: 12, maxWidth: 620, width: "100%", alignSelf: "center" }, introTitle: { color: "#1C1C1E", fontSize: 16, fontWeight: "800" }, introCopy: { color: "#6E6E73", fontSize: 13, lineHeight: 18, marginTop: 6 }, section: { color: "#6E6E73", fontSize: 12, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase", marginTop: 4 }, reasons: { gap: 8 }, reason: { minHeight: 51, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "#E5E5EA" }, reasonActive: { backgroundColor: "#FFF4CC", borderColor: "#FFD60A" }, radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: "#AEAEB2", alignItems: "center", justifyContent: "center" }, radioActive: { borderColor: "#806700" }, radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FFD60A" }, reasonText: { color: "#1C1C1E", fontSize: 14, fontWeight: "600" }, reasonTextActive: { fontWeight: "800" }, note: { minHeight: 105, borderRadius: 15, borderWidth: 1, borderColor: "#E5E5EA", backgroundColor: "rgba(255,255,255,0.8)", padding: 13, color: "#1C1C1E", textAlignVertical: "top", fontSize: 14 }, proof: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, proofTitle: { color: "#1C1C1E", fontSize: 14, fontWeight: "800" }, proofCopy: { color: "#6E6E73", fontSize: 12, maxWidth: 190, marginTop: 3 }, });
