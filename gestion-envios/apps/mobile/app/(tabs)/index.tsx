import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AuroraBackground } from "@/components/aurora-background";
import { GlassCard, IconAction, SectionHeading } from "@/components/ui/movii-ui";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDriver } from "@/mock/shipments";
import { useMovii } from "@/lib/movii-context";
import { contadoresDelDia, filtrarPorEstado, type EstadoEnvioAPI } from "@/lib/envios-del-dia";
import { type Shipment } from "@/types/logistics";

/**
 * Filtros por estado del CA-04 de HU-05. Se usa el vocabulario de la API
 * ("asignado" y no "pendiente") porque es el estado real con el que un envío
 * entra en la ruta del día del repartidor.
 */
const FILTROS: { valor: EstadoEnvioAPI | null; etiqueta: string }[] = [
  { valor: null, etiqueta: "Todos" },
  { valor: "asignado", etiqueta: "Asignados" },
  { valor: "en_camino", etiqueta: "En camino" },
  { valor: "entregado", etiqueta: "Entregados" },
  { valor: "no_entregado", etiqueta: "No entregados" },
];

function StopCard({ shipment, onPress }: { shipment: Shipment; onPress: () => void }) {
  const meta = `${shipment.recipient.address} · ${shipment.recipient.locality}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver parada ${shipment.stopOrder}, ${shipment.recipient.name}`} onPress={onPress} style={({ pressed }) => [styles.stopCard, pressed && styles.pressed]}>
      <View style={styles.stopNumber}><Text style={styles.stopNumberText}>{shipment.stopOrder}</Text></View>
      <View style={styles.stopMain}>
        <View style={styles.stopHeadline}><Text numberOfLines={1} style={styles.stopName}>{shipment.recipient.name}</Text><Text style={styles.stopWindow}>{shipment.weight}</Text></View>
        <Text numberOfLines={1} style={styles.stopAddress}>{meta}</Text>
        <View style={styles.stopFooter}><StatusBadge status={shipment.status} /><Text style={styles.stopCode}>{shipment.code}</Text></View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function FiltroEstado({ activo, onChange }: { activo: EstadoEnvioAPI | null; onChange: (estado: EstadoEnvioAPI | null) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros}>
      {FILTROS.map((filtro) => {
        const seleccionado = filtro.valor === activo;
        return (
          <Pressable
            key={filtro.etiqueta}
            accessibilityRole="button"
            accessibilityState={{ selected: seleccionado }}
            accessibilityLabel={`Filtrar por ${filtro.etiqueta}`}
            onPress={() => onChange(filtro.valor)}
            style={({ pressed }) => [styles.chip, seleccionado && styles.chipActivo, pressed && styles.pressed]}
          >
            <Text style={[styles.chipTexto, seleccionado && styles.chipTextoActivo]}>{filtro.etiqueta}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function RouteScreen() {
  const {
    rutasDelDia,
    resumenDelDia,
    filtroEstado,
    setFiltroEstado,
    cargandoEnviosDelDia,
    errorEnviosDelDia,
    recargarEnviosDelDia,
    activeDriverId,
  } = useMovii();
  const driver = getDriver(activeDriverId);

  // CA-03: una sección por ruta. El filtro de CA-04 se aplica dentro de cada
  // ruta y las rutas que quedan sin envíos no se muestran.
  const secciones = useMemo(
    () =>
      filtrarPorEstado(rutasDelDia, filtroEstado).map((ruta) => ({
        rutaId: ruta.rutaId,
        title: ruta.rutaNombre,
        data: ruta.envios,
      })),
    [rutasDelDia, filtroEstado],
  );

  // CA-05: el resumen cuenta el día completo, no lo que quedó a la vista tras
  // aplicar un filtro.
  const { total, entregados, pendientes, noEntregados, progreso } = contadoresDelDia(resumenDelDia);

  const nombreRuta =
    rutasDelDia.length === 0
      ? "Sin rutas asignadas hoy"
      : rutasDelDia.length === 1
        ? rutasDelDia[0].rutaNombre
        : `${rutasDelDia.length} rutas asignadas`;

  // CA-03: el encabezado por ruta solo aporta cuando hay más de una; con una
  // sola, el nombre ya está en la tarjeta de resumen.
  const mostrarEncabezadosDeRuta = rutasDelDia.length > 1;

  const vacioPorFiltro = total > 0 && secciones.length === 0;

  return (
    <View style={styles.page}>
      <AuroraBackground style={StyleSheet.absoluteFill} />
      <SectionList
        sections={secciones}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={cargandoEnviosDelDia} onRefresh={recargarEnviosDelDia} />}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.topBar}><View><Text style={styles.greeting}>Buen día,</Text><Text style={styles.driverName}>{driver.name.split(" ")[0]}.</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>{driver.initials}</Text></View></View>
            {errorEnviosDelDia ? <Text style={styles.errorBanner}>{errorEnviosDelDia}</Text> : null}
            <GlassCard style={styles.summaryCard}>
              <View style={styles.summaryTop}><View style={styles.summaryTitleBox}><Text style={styles.summaryEyebrow}>MI RUTA DE HOY</Text><Text numberOfLines={2} style={styles.summaryTitle}>{nombreRuta}</Text></View><View style={styles.progressValue}><Text style={styles.progressNumber}>{progreso}%</Text><Text style={styles.progressText}>listo</Text></View></View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progreso}%` }]} /></View>
              <View style={styles.summaryStats}>
                <View style={styles.stat}><Text style={styles.statNumber}>{total}</Text><Text style={styles.statLabel}>total</Text></View>
                <View style={styles.statDivider} />
                <View style={styles.stat}><Text style={styles.statNumber}>{entregados}</Text><Text style={styles.statLabel}>entregados</Text></View>
                <View style={styles.statDivider} />
                <View style={styles.stat}><Text style={styles.statNumber}>{pendientes}</Text><Text style={styles.statLabel}>pendientes</Text></View>
                <View style={styles.statDivider} />
                <View style={styles.stat}><Text style={styles.statNumber}>{noEntregados}</Text><Text style={styles.statLabel}>no entregados</Text></View>
              </View>
              <View style={styles.mapAction}><IconAction label="Ver ruta en el mapa" icon="⌖" onPress={() => router.push("/route-map")} /><Text style={styles.mapActionChevron}>›</Text></View>
            </GlassCard>
            <SectionHeading eyebrow="PRÓXIMAS PARADAS" title="Tu recorrido" action="Mapa" onAction={() => router.push("/route-map")} />
            <FiltroEstado activo={filtroEstado} onChange={setFiltroEstado} />
          </View>
        }
        renderSectionHeader={({ section }) =>
          mostrarEncabezadosDeRuta ? (
            <View style={styles.rutaHeader}>
              <Text style={styles.rutaHeaderTitulo}>{section.title}</Text>
              <Text style={styles.rutaHeaderConteo}>{section.data.length} {section.data.length === 1 ? "envío" : "envíos"}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <StopCard shipment={item} onPress={() => router.push({ pathname: "/stop/[id]", params: { id: item.id } })} />}
        ListEmptyComponent={
          cargandoEnviosDelDia ? null : (
            <Text style={styles.emptyText}>
              {vacioPorFiltro ? "Ningún envío coincide con el filtro seleccionado." : "No tenés envíos asignados para hoy."}
            </Text>
          )
        }
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
  errorBanner: { color: "#D70015", fontSize: 12, fontWeight: "700", textAlign: "center", paddingVertical: 6 },
  emptyText: { color: "#6E6E73", fontSize: 13, textAlign: "center", paddingTop: 40 },
  summaryCard: { padding: 18, gap: 16 },
  summaryTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryTitleBox: { flex: 1 },
  summaryEyebrow: { color: "#6E6E73", fontSize: 10, fontWeight: "800", letterSpacing: 0.9 },
  summaryTitle: { color: "#1C1C1E", fontSize: 21, fontWeight: "800", letterSpacing: -0.55, marginTop: 3 },
  progressValue: { alignItems: "flex-end", justifyContent: "center" },
  progressNumber: { color: "#1C1C1E", fontSize: 20, fontWeight: "800", letterSpacing: -0.6 },
  progressText: { color: "#6E6E73", fontSize: 11, fontWeight: "600" },
  progressTrack: { height: 8, overflow: "hidden", borderRadius: 99, backgroundColor: "#EFEFF2" },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: "#FFD60A" },
  summaryStats: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stat: { flex: 1 },
  statNumber: { color: "#1C1C1E", fontSize: 18, fontWeight: "800", textAlign: "center", letterSpacing: -0.4 },
  statLabel: { color: "#6E6E73", fontSize: 10, marginTop: 2, textAlign: "center" },
  statDivider: { width: 1, height: 27, backgroundColor: "#E5E5EA" },
  filtros: { gap: 8, paddingHorizontal: 2, paddingVertical: 2 },
  chip: { minHeight: 34, justifyContent: "center", paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.83)", borderWidth: 1, borderColor: "#E5E5EA" },
  chipActivo: { backgroundColor: "#1C1C1E", borderColor: "#1C1C1E" },
  chipTexto: { color: "#59595F", fontSize: 12, fontWeight: "700" },
  chipTextoActivo: { color: "#FFD60A" },
  rutaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 14, paddingBottom: 6 },
  rutaHeaderTitulo: { flex: 1, color: "#1C1C1E", fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  rutaHeaderConteo: { color: "#6E6E73", fontSize: 11, fontWeight: "700" },
  mapAction: { minHeight: 38, borderTopWidth: 1, borderTopColor: "#EDEDEF", paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mapActionChevron: { color: "#6E6E73", fontSize: 24, fontWeight: "300" },
  stopCard: { minHeight: 111, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginTop: 11, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.83)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", shadowColor: "#11111A", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
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
