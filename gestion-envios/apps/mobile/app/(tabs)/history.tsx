import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/aurora-background";
import { Aparecer, NumeroAnimado, Presionable } from "@/components/ui/efectos";
import { StatusBadge } from "@/components/ui/status-badge";
import { M, SOMBRA } from "@/constants/movii-design";
import { useMovii } from "@/lib/movii-context";
import type { ShipmentStatus } from "@/types/logistics";

const filters: { key: "todos" | ShipmentStatus; label: string }[] = [{ key: "todos", label: "Todos" }, { key: "entregado", label: "Entregados" }, { key: "no_entregado", label: "Fallidos" }];

export default function HistoryScreen() {
  // Margen superior real (notch / barra de estado), también en la PWA instalada.
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("todos");
  const { enviosDelDia } = useMovii();
  // Solo lo ya cerrado hoy (entregado / no entregado), con datos reales de la API.
  const cerrados = useMemo(() => enviosDelDia.filter((s) => s.status === "entregado" || s.status === "no_entregado"), [enviosDelDia]);
  const items = useMemo(() => cerrados.filter((s) => filter === "todos" || s.status === filter), [cerrados, filter]);
  const ok = cerrados.filter((s) => s.status === "entregado").length;
  const fallidos = cerrados.length - ok;
  return (
    <View style={styles.page}>
      <AuroraBackground barra="light" style={StyleSheet.absoluteFill} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={[styles.hero, { paddingTop: insets.top + 18 }]}>
              <View style={styles.glow} pointerEvents="none" />
              <View style={styles.eyebrowFila}><View style={styles.barra} /><Text style={styles.eyebrow}>CERRADOS HOY</Text></View>
              <Text style={styles.title}>Historial</Text>
              <Text style={styles.subtitle}>Entregas e incidencias de tu jornada.</Text>
              <View style={styles.resumen}>
                <View style={styles.resumenItem}><NumeroAnimado valor={ok} style={[styles.resumenNumero, { color: "#4ADE80" }]} /><Text style={styles.resumenEtiqueta}>entregados</Text></View>
                <View style={styles.divisor} />
                <View style={styles.resumenItem}><NumeroAnimado valor={fallidos} style={[styles.resumenNumero, { color: "#F87171" }]} /><Text style={styles.resumenEtiqueta}>fallidos</Text></View>
              </View>
            </View>
            <View style={styles.filters}>
              {filters.map((entry) => (
                <Pressable key={entry.key} onPress={() => setFilter(entry.key)} style={[styles.filter, filter === entry.key && styles.filterActive]}>
                  <Text style={[styles.filterText, filter === entry.key && styles.filterTextActive]}>{entry.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          const ok = item.status === "entregado";
          return (
            <Aparecer indice={index} style={styles.itemWrap}>
              <Presionable onPress={() => router.push({ pathname: "/stop/[id]", params: { id: item.id } })} escala={0.975} style={styles.item}>
                <View style={[styles.lateral, { backgroundColor: ok ? M.verde : M.rojo }]} />
                <View style={styles.itemHead}><Text numberOfLines={1} style={styles.itemName}>{item.recipient.name}</Text><StatusBadge status={item.status} /></View>
                <Text style={styles.itemAddress}>{item.recipient.address}, {item.recipient.locality}</Text>
                <View style={styles.itemFoot}><Text style={styles.itemCode}>{item.code}</Text><Text style={styles.itemDate}>{item.estimatedDate}</Text></View>
              </Presionable>
            </Aparecer>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcono}><Text style={styles.emptyGlifo}>◷</Text></View>
            <Text style={styles.emptyTitle}>No hay resultados</Text>
            <Text style={styles.emptyCopy}>Todavía no cerraste ninguna entrega hoy.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: M.hormigon100 },
  content: { paddingBottom: 130, maxWidth: 620, width: "100%", alignSelf: "center" },
  hero: { backgroundColor: M.asfalto, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, paddingHorizontal: 20, paddingBottom: 20, gap: 6, overflow: "hidden", ...SOMBRA.lift },
  glow: { position: "absolute", top: -90, right: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: M.amarillo, opacity: 0.16 },
  eyebrowFila: { flexDirection: "row", alignItems: "center", gap: 7 },
  barra: { width: 16, height: 4, borderRadius: 2, backgroundColor: M.amarillo },
  eyebrow: { color: M.amarillo, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.3 },
  title: { color: "#FFFFFF", fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -1.4 },
  subtitle: { color: "#9A9AA0", fontSize: 14 },
  resumen: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, paddingVertical: 13, marginTop: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  resumenItem: { flex: 1, alignItems: "center" },
  resumenNumero: { fontSize: 26, fontWeight: "900", letterSpacing: -1 },
  resumenEtiqueta: { color: "#9A9AA0", fontSize: 11, fontWeight: "700" },
  divisor: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.1)" },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
  filter: { minHeight: 36, justifyContent: "center", paddingHorizontal: 15, borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: M.hormigon200 },
  filterActive: { backgroundColor: M.asfalto, borderColor: M.asfalto },
  filterText: { color: "#4B5563", fontSize: 12.5, fontWeight: "800" },
  filterTextActive: { color: M.amarillo },
  itemWrap: { paddingHorizontal: 16, marginTop: 10 },
  item: { padding: 16, paddingLeft: 20, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: M.hormigon200, overflow: "hidden", ...SOMBRA.panel },
  lateral: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  itemHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  itemName: { flex: 1, color: M.texto, fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  itemAddress: { color: M.gris, fontSize: 13, marginTop: 6 },
  itemFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  itemCode: { color: M.grisClaro, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  itemDate: { color: M.gris, fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 50, gap: 6 },
  emptyIcono: { width: 56, height: 56, borderRadius: 20, backgroundColor: M.amarilloSuave, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  emptyGlifo: { color: M.amarilloOscuro, fontSize: 26 },
  emptyTitle: { color: M.texto, fontSize: 17, fontWeight: "900" },
  emptyCopy: { color: M.gris, fontSize: 13 },
});
