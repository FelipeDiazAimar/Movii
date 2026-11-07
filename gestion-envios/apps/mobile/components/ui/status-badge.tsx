import { StyleSheet, Text, View } from "react-native";

import { statusCopy, type ShipmentStatus } from "@/types/logistics";

const tones: Record<ShipmentStatus, { background: string; color: string; dot: string }> = {
  pendiente: { background: "#E8EBEF", color: "#3F4650", dot: "#6B7280" },
  en_camino: { background: "#FFF1D6", color: "#92400E", dot: "#D97706" },
  entregado: { background: "#DCFCE7", color: "#166534", dot: "#16A34A" },
  no_entregado: { background: "#FEE2E2", color: "#991B1B", dot: "#DC2626" },
};

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const tone = tones[status];
  return <View style={[styles.badge, { backgroundColor: tone.background }]}><View style={[styles.dot, { backgroundColor: tone.dot }]} /><Text style={[styles.text, { color: tone.color }]}>{statusCopy[status]}</Text></View>;
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, borderRadius: 999, minHeight: 28, paddingHorizontal: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 11.5, fontWeight: "900", letterSpacing: 0.1 },
});
