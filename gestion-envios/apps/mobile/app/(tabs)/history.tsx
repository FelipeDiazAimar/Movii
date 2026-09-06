import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AuroraBackground } from "@/components/aurora-background";
import { StatusBadge } from "@/components/ui/status-badge";
import { useMovii } from "@/lib/movii-context";
import type { ShipmentStatus } from "@/types/logistics";

const filters: { key: "todos" | ShipmentStatus; label: string }[] = [{ key: "todos", label: "Todos" }, { key: "entregado", label: "Entregados" }, { key: "no_entregado", label: "Fallidos" }];

export default function HistoryScreen() {
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("todos");
  const { shipments, activeDriverId } = useMovii();
  const items = useMemo(() => shipments.filter((shipment) => shipment.driverId === activeDriverId && (filter === "todos" || shipment.status === filter) && shipment.code > "MOV-2026-000800"), [shipments, activeDriverId, filter]);
  return (
    <View style={styles.page}>
      <AuroraBackground style={StyleSheet.absoluteFill} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.header}><Text style={styles.eyebrow}>JORNADAS ANTERIORES</Text><Text style={styles.title}>Historial</Text><Text style={styles.subtitle}>Tus entregas e incidencias resueltas.</Text><View style={styles.filters}>{filters.map((entry) => <Pressable key={entry.key} onPress={() => setFilter(entry.key)} style={[styles.filter, filter === entry.key && styles.filterActive]}><Text style={[styles.filterText, filter === entry.key && styles.filterTextActive]}>{entry.label}</Text></Pressable>)}</View></View>}
        renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: "/stop/[id]", params: { id: item.id } })} style={({ pressed }) => [styles.item, pressed && styles.pressed]}><View style={styles.itemHead}><Text style={styles.itemName}>{item.recipient.name}</Text><StatusBadge status={item.status} /></View><Text style={styles.itemAddress}>{item.recipient.address}, {item.recipient.locality}</Text><View style={styles.itemFoot}><Text style={styles.itemCode}>{item.code}</Text><Text style={styles.itemDate}>{item.estimatedDate}</Text></View></Pressable>}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No hay resultados</Text><Text style={styles.emptyCopy}>Probá con otro filtro para ver tus entregas.</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F7F8" },
  content: { paddingTop: 66, paddingHorizontal: 16, paddingBottom: 24, gap: 10, maxWidth: 620, width: "100%", alignSelf: "center" },
  header: { gap: 7, marginBottom: 13 },
  eyebrow: { color: "#6E6E73", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  title: { color: "#1C1C1E", fontSize: 31, fontWeight: "800", letterSpacing: -1.1 },
  subtitle: { color: "#6E6E73", fontSize: 14 },
  filters: { flexDirection: "row", gap: 8, marginTop: 13 },
  filter: { minHeight: 35, justifyContent: "center", paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.65)", borderWidth: 1, borderColor: "#E5E5EA" },
  filterActive: { backgroundColor: "#FFD60A", borderColor: "#FFD60A" },
  filterText: { color: "#6E6E73", fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: "#1C1C1E" },
  item: { padding: 15, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" },
  itemHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  itemName: { flex: 1, color: "#1C1C1E", fontSize: 15, fontWeight: "800" },
  itemAddress: { color: "#6E6E73", fontSize: 13, marginTop: 6 },
  itemFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  itemCode: { color: "#AEAEB2", fontSize: 11, fontWeight: "700" },
  itemDate: { color: "#6E6E73", fontSize: 11 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 6 },
  emptyTitle: { color: "#1C1C1E", fontSize: 16, fontWeight: "800" },
  emptyCopy: { color: "#6E6E73", fontSize: 13 },
  pressed: { opacity: 0.7 },
});
