import { StyleSheet, Text, View } from "react-native";

import { statusCopy, type ShipmentStatus } from "@/types/logistics";

const tones: Record<ShipmentStatus, { background: string; color: string; dot: string }> = {
  pendiente: { background: "#EFEFF2", color: "#59595F", dot: "#8E8E93" },
  en_camino: { background: "#FFF0DB", color: "#A54B00", dot: "#FF9F0A" },
  entregado: { background: "#E9F8EC", color: "#207B34", dot: "#34C759" },
  no_entregado: { background: "#FFEAE8", color: "#B42318", dot: "#FF3B30" },
};

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const tone = tones[status];
  return <View style={[styles.badge, { backgroundColor: tone.background }]}><View style={[styles.dot, { backgroundColor: tone.dot }]} /><Text style={[styles.text, { color: tone.color }]}>{statusCopy[status]}</Text></View>;
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, borderRadius: 999, minHeight: 28, paddingHorizontal: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: "700" },
});
