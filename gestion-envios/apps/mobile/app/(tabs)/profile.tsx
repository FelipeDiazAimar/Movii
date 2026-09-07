import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AuroraBackground } from "@/components/aurora-background";
import { GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { getDriver } from "@/mock/shipments";
import { useMovii } from "@/lib/movii-context";

export default function ProfileScreen() {
  const { activeDriverId, logout } = useMovii();
  const driver = getDriver(activeDriverId);
  return (
    <View style={styles.page}>
      <AuroraBackground style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>TU CUENTA</Text><Text style={styles.title}>Perfil</Text>
        <GlassCard style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{driver.initials}</Text></View><View style={styles.profileCopy}><Text style={styles.name}>{driver.name}</Text><Text style={styles.detail}>Repartidor · {driver.zone}</Text><View style={styles.online}><View style={styles.onlineDot} /><Text style={styles.onlineText}>En ruta</Text></View></View></GlassCard>
        <Text style={styles.section}>Rendimiento de hoy</Text>
        <View style={styles.metrics}><GlassCard style={styles.metric}><Text style={styles.metricNumber}>{driver.deliveriesToday}</Text><Text style={styles.metricLabel}>entregas</Text></GlassCard><GlassCard style={styles.metric}><Text style={styles.metricNumber}>{driver.successRate}%</Text><Text style={styles.metricLabel}>efectividad</Text></GlassCard></View>
        <Text style={styles.section}>Preferencias</Text>
        <GlassCard style={styles.settings}><Pressable onPress={() => router.push("/tracking")} style={styles.settingRow}><Text style={styles.settingIcon}>⌁</Text><View style={styles.settingCopy}><Text style={styles.settingTitle}>Seguir un envío</Text><Text style={styles.settingSub}>Acceso público de cliente</Text></View><Text style={styles.chevron}>›</Text></Pressable><View style={styles.divider} /><Pressable onPress={() => router.push("/(tabs)/design")} style={styles.settingRow}><Text style={styles.settingIcon}>◌</Text><View style={styles.settingCopy}><Text style={styles.settingTitle}>Sistema de diseño</Text><Text style={styles.settingSub}>Colores y componentes</Text></View><Text style={styles.chevron}>›</Text></Pressable></GlassCard>
        <PrimaryButton label="Cerrar sesión" tone="secondary" onPress={() => { logout(); router.replace("/login"); }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F7F8" }, content: { paddingTop: 66, paddingHorizontal: 16, paddingBottom: 28, gap: 15, maxWidth: 620, width: "100%", alignSelf: "center" }, eyebrow: { color: "#6E6E73", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 }, title: { color: "#1C1C1E", fontSize: 31, fontWeight: "800", letterSpacing: -1.1, marginTop: -8 }, profileCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 17 }, avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#FFD60A", fontWeight: "800", fontSize: 17 }, profileCopy: { gap: 3 }, name: { color: "#1C1C1E", fontSize: 18, fontWeight: "800" }, detail: { color: "#6E6E73", fontSize: 13 }, online: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }, onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#34C759" }, onlineText: { color: "#207B34", fontSize: 12, fontWeight: "700" }, section: { color: "#6E6E73", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.75, marginTop: 6 }, metrics: { flexDirection: "row", gap: 10 }, metric: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 18 }, metricNumber: { color: "#1C1C1E", fontSize: 25, fontWeight: "800", letterSpacing: -0.8 }, metricLabel: { color: "#6E6E73", fontSize: 12 }, settings: { paddingVertical: 4 }, settingRow: { minHeight: 68, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 12 }, settingIcon: { color: "#1C1C1E", fontSize: 22, width: 24, textAlign: "center" }, settingCopy: { flex: 1 }, settingTitle: { color: "#1C1C1E", fontSize: 14, fontWeight: "700" }, settingSub: { color: "#6E6E73", fontSize: 12, marginTop: 3 }, chevron: { color: "#6E6E73", fontSize: 24, fontWeight: "300" }, divider: { height: 1, backgroundColor: "#EFEFF2", marginLeft: 48 },
});
