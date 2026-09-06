import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AuroraBackground } from "@/components/aurora-background";
import { GlassCard, IconAction, SectionHeading } from "@/components/ui/movii-ui";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDriver } from "@/mock/shipments";
import { useMovii } from "@/lib/movii-context";
import { type Shipment } from "@/types/logistics";

function StopCard({ shipment, onPress }: { shipment: Shipment; onPress: () => void }) {
  const meta = `${shipment.recipient.address} · ${shipment.recipient.locality}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver parada ${shipment.stopOrder}, ${shipment.recipient.name}`} onPress={onPress} style={({ pressed }) => [styles.stopCard, pressed && styles.pressed]}>
      <View style={styles.stopNumber}><Text style={styles.stopNumberText}>{shipment.stopOrder}</Text></View>
      <View style={styles.stopMain}>
        <View style={styles.stopHeadline}><Text numberOfLines={1} style={styles.stopName}>{shipment.recipient.name}</Text><Text style={styles.stopWindow}>{shipment.timeWindow}</Text></View>
        <Text numberOfLines={1} style={styles.stopAddress}>{meta}</Text>
        <View style={styles.stopFooter}><StatusBadge status={shipment.status} /><Text style={styles.stopCode}>{shipment.code.slice(-6)}</Text></View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function RouteScreen() {
  const { shipments, activeDriverId } = useMovii();
  const driver = getDriver(activeDriverId);
  const stops = useMemo(() => shipments.filter((shipment) => shipment.driverId === activeDriverId && shipment.code <= "MOV-2026-000780").sort((a, b) => a.stopOrder - b.stopOrder), [shipments, activeDriverId]);
  const inProgress = stops.filter((shipment) => shipment.status === "en_camino").length;
  const progress = Math.min(100, Math.round((driver.deliveriesToday / (driver.deliveriesToday + stops.length)) * 100));

  return (
    <View style={styles.page}>
      <AuroraBackground style={StyleSheet.absoluteFill} />
      <FlatList
        data={stops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.topBar}><View><Text style={styles.greeting}>Buen día,</Text><Text style={styles.driverName}>{driver.name.split(" ")[0]}.</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>{driver.initials}</Text></View></View>
            <GlassCard style={styles.summaryCard}>
              <View style={styles.summaryTop}><View><Text style={styles.summaryEyebrow}>MI RUTA DE HOY</Text><Text style={styles.summaryTitle}>Ruta Norte 02</Text><Text style={styles.summarySubtitle}>Olivos · Martínez · San Isidro</Text></View><View style={styles.progressValue}><Text style={styles.progressNumber}>{progress}%</Text><Text style={styles.progressText}>listo</Text></View></View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
              <View style={styles.summaryStats}><View><Text style={styles.statNumber}>{driver.deliveriesToday}</Text><Text style={styles.statLabel}>entregadas</Text></View><View style={styles.statDivider} /><View><Text style={styles.statNumber}>{stops.length}</Text><Text style={styles.statLabel}>por visitar</Text></View><View style={styles.statDivider} /><View><Text style={styles.statNumber}>{inProgress}</Text><Text style={styles.statLabel}>en camino</Text></View></View>
              <View style={styles.mapAction}><IconAction label="Ver ruta en el mapa" icon="⌖" onPress={() => router.push("/route-map")} /><Text style={styles.mapActionChevron}>›</Text></View>
            </GlassCard>
            <SectionHeading eyebrow="PRÓXIMAS PARADAS" title="Tu recorrido" action="Mapa" onAction={() => router.push("/route-map")} />
          </View>
        }
        renderItem={({ item }) => <StopCard shipment={item} onPress={() => router.push({ pathname: "/stop/[id]", params: { id: item.id } })} />}
        ListFooterComponent={<View style={{ height: 16 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F7F8" },
  content: { paddingHorizontal: 16, paddingTop: 62, paddingBottom: 26, gap: 11, maxWidth: 620, width: "100%", alignSelf: "center" },
  headerStack: { gap: 17, marginBottom: 12 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 },
  greeting: { color: "#6E6E73", fontSize: 15, fontWeight: "600" },
  driverName: { color: "#1C1C1E", fontSize: 30, lineHeight: 34, fontWeight: "800", letterSpacing: -1.1 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#1C1C1E", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#FFD60A", fontWeight: "800", fontSize: 13 },
  summaryCard: { padding: 18, gap: 16 },
  summaryTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryEyebrow: { color: "#6E6E73", fontSize: 10, fontWeight: "800", letterSpacing: 0.9 },
  summaryTitle: { color: "#1C1C1E", fontSize: 21, fontWeight: "800", letterSpacing: -0.55, marginTop: 3 },
  summarySubtitle: { color: "#6E6E73", fontSize: 13, marginTop: 3 },
  progressValue: { alignItems: "flex-end", justifyContent: "center" },
  progressNumber: { color: "#1C1C1E", fontSize: 20, fontWeight: "800", letterSpacing: -0.6 },
  progressText: { color: "#6E6E73", fontSize: 11, fontWeight: "600" },
  progressTrack: { height: 8, overflow: "hidden", borderRadius: 99, backgroundColor: "#EFEFF2" },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: "#FFD60A" },
  summaryStats: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  statNumber: { color: "#1C1C1E", fontSize: 18, fontWeight: "800", textAlign: "center", letterSpacing: -0.4 },
  statLabel: { color: "#6E6E73", fontSize: 11, marginTop: 2, textAlign: "center" },
  statDivider: { width: 1, height: 27, backgroundColor: "#E5E5EA" },
  mapAction: { minHeight: 38, borderTopWidth: 1, borderTopColor: "#EDEDEF", paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mapActionChevron: { color: "#6E6E73", fontSize: 24, fontWeight: "300" },
  stopCard: { minHeight: 111, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.83)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", shadowColor: "#11111A", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  stopNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFF4CC", alignItems: "center", justifyContent: "center", alignSelf: "flex-start", marginTop: 2 },
  stopNumberText: { color: "#806700", fontSize: 13, fontWeight: "800" },
  stopMain: { flex: 1, gap: 4 },
  stopHeadline: { flexDirection: "row", alignItems: "center", gap: 8 },
  stopName: { flex: 1, color: "#1C1C1E", fontSize: 15, fontWeight: "800" },
  stopWindow: { color: "#6E6E73", fontSize: 11, fontWeight: "700" },
  stopAddress: { color: "#6E6E73", fontSize: 12 },
  stopFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  stopCode: { color: "#AEAEB2", fontSize: 11, fontWeight: "700" },
  chevron: { color: "#6E6E73", fontSize: 25, fontWeight: "300" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
});
