import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { AuroraBackground } from "@/components/aurora-background";
import { GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { haptic } from "@/lib/haptics";
import { useMovii } from "@/lib/movii-context";

const days = ["Mañana\n27 ago", "Jueves\n28 ago", "Viernes\n29 ago"];
const slots = ["09:00–12:00", "12:00–15:00", "15:00–18:00"];

export default function RescheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findShipment, updateShipment } = useMovii();
  const shipment = findShipment(id);
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState(slots[0]);
  if (!shipment) return null;
  const save = () => { updateShipment(shipment.id, { status: "pendiente", rescheduledFor: `${day.replace("\n", " · ")} · ${slot}`, timeWindow: slot, estimatedDate: day.replace("\n", " ") }); haptic.success(); router.replace({ pathname: "/stop/[id]", params: { id: shipment.id } }); };
  return <View style={styles.page}><AuroraBackground style={StyleSheet.absoluteFill} /><AppHeader title="Reprogramar visita" subtitle={shipment.code} /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><GlassCard><Text style={styles.title}>Elegí una nueva ventana de entrega</Text><Text style={styles.copy}>El cliente recibirá una actualización de su fecha estimada en este prototipo.</Text></GlassCard><Text style={styles.section}>Día</Text><View style={styles.dayRow}>{days.map((item) => <Pressable key={item} onPress={() => { haptic.selection(); setDay(item); }} style={[styles.day, day === item && styles.dayActive]}><Text style={[styles.dayText, day === item && styles.dayTextActive]}>{item}</Text></Pressable>)}</View><Text style={styles.section}>Franja horaria</Text><View style={styles.slots}>{slots.map((item) => <Pressable key={item} onPress={() => { haptic.selection(); setSlot(item); }} style={[styles.slot, slot === item && styles.slotActive]}><Text style={[styles.slotText, slot === item && styles.slotTextActive]}>{item}</Text>{slot === item ? <Text style={styles.check}>✓</Text> : null}</Pressable>)}</View><PrimaryButton label="Confirmar nueva visita" onPress={save} icon="✓" /></ScrollView></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#F7F7F8" }, content: { padding: 16, paddingTop: 10, paddingBottom: 34, gap: 14, maxWidth: 620, width: "100%", alignSelf: "center" }, title: { color: "#1C1C1E", fontSize: 16, fontWeight: "800" }, copy: { color: "#6E6E73", fontSize: 13, lineHeight: 18, marginTop: 6 }, section: { color: "#6E6E73", fontSize: 12, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase", marginTop: 4 }, dayRow: { flexDirection: "row", gap: 8 }, day: { flex: 1, minHeight: 70, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "#E5E5EA" }, dayActive: { backgroundColor: "#FFF4CC", borderColor: "#FFD60A" }, dayText: { color: "#6E6E73", fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 18 }, dayTextActive: { color: "#1C1C1E", fontWeight: "800" }, slots: { gap: 8 }, slot: { minHeight: 51, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "#E5E5EA" }, slotActive: { backgroundColor: "#FFF4CC", borderColor: "#FFD60A" }, slotText: { color: "#1C1C1E", fontSize: 14, fontWeight: "700" }, slotTextActive: { fontWeight: "800" }, check: { color: "#806700", fontWeight: "900", fontSize: 16 }, });
