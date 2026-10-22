import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import MapView, { Callout, Marker, Polyline } from "react-native-maps";

import { AppHeader } from "@/components/app-header";
import { AuroraBackground } from "@/components/aurora-background";
import { GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { obtenerMapaRuta, type MapaRutaAPI } from "@/lib/api-client";
import { colorEstado, paradasConUbicacion, paradasSinUbicacion, regionInicial } from "@/lib/mapa-ruta";
import { useMovii } from "@/lib/movii-context";
import { esNoEncontrado, mensajeDeError } from "@/lib/seguimiento";

function RouteArtwork({ full = false }: { full?: boolean }) {
  return <View style={full ? styles.mapFull : styles.mapGrid}><View style={styles.roadVertical} /><View style={styles.roadHorizontal} /><View style={styles.routeLine}><View style={styles.routeLineBend} /></View><View style={[styles.pin, styles.pinStart]}><Text style={styles.pinText}>A</Text></View><View style={[styles.pin, styles.pinMid]}><Text style={styles.pinText}>3</Text></View><View style={[styles.pin, styles.pinEnd]}><Text style={styles.pinText}>7</Text></View><View style={styles.car}><Text style={styles.carText}>▰</Text></View><View style={styles.mapLabel}><Text style={styles.mapLabelText}>MARTÍNEZ</Text></View></View>;
}

function RouteMapMock() {
  const { shipments, activeDriverId } = useMovii();
  const [expanded, setExpanded] = useState(false);
  const stops = shipments.filter((shipment) => shipment.driverId === activeDriverId && shipment.code <= "MOV-2026-000780").slice(0, 5);
  return <View style={styles.page}><AuroraBackground style={StyleSheet.absoluteFill} /><AppHeader title="Ruta Norte 02" subtitle="10 paradas · 23,4 km" /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><GlassCard style={styles.mapCard}><Pressable onPress={() => setExpanded(true)} style={({ pressed }) => [styles.mapPressable, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Ampliar mapa de ruta"><RouteArtwork /><View style={styles.expandPill}><Text style={styles.expandIcon}>⛶</Text><Text style={styles.expandText}>Ampliar mapa</Text></View></Pressable><View style={styles.legend}><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#1C1C1E" }]} /><Text style={styles.legendText}>Tu ubicación</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#FFD60A" }]} /><Text style={styles.legendText}>Próxima parada</Text></View></View></GlassCard><Text style={styles.section}>Orden de paradas</Text><GlassCard style={styles.stopsCard}>{stops.map((shipment, index) => <Pressable key={shipment.id} onPress={() => router.push({ pathname: "/stop/[id]", params: { id: shipment.id } })} style={({ pressed }) => [styles.stopRow, pressed && styles.pressed]}><View style={[styles.order, index === 0 && styles.orderActive]}><Text style={styles.orderText}>{shipment.stopOrder}</Text></View><View style={styles.stopCopy}><Text style={styles.stopName}>{shipment.recipient.name}</Text><Text style={styles.stopAddress}>{shipment.recipient.address}, {shipment.recipient.locality}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</GlassCard><PrimaryButton label="Volver a mi ruta" onPress={() => router.back()} /></ScrollView><Modal visible={expanded} animationType="fade" onRequestClose={() => setExpanded(false)}><View style={styles.modal}><RouteArtwork full /><View style={styles.modalTop}><Pressable onPress={() => setExpanded(false)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Cerrar mapa ampliado"><Text style={styles.closeText}>×</Text></Pressable><View style={styles.modalTitle}><Text style={styles.modalEyebrow}>RUTA NORTE 02</Text><Text style={styles.modalName}>Mapa de ruta</Text></View><View style={styles.modalDistance}><Text style={styles.modalDistanceText}>23,4 km</Text></View></View><View style={styles.modalBottom}><Text style={styles.modalNext}>Próxima parada</Text><Text style={styles.modalAddress}>{stops[0]?.recipient.address}, {stops[0]?.recipient.locality}</Text><PrimaryButton label="Ver detalle" onPress={() => { setExpanded(false); if (stops[0]) router.push({ pathname: "/stop/[id]", params: { id: stops[0].id } }); }} /></View></View></Modal></View>;
}

const irAParada = (envioId: string) => router.push({ pathname: "/stop/[id]", params: { id: envioId } });

type EstadoMapa = { rutaId: string; mapa: MapaRutaAPI | null; error: string | null };

function RouteMapReal({ rutas }: { rutas: { rutaId: string; rutaNombre: string }[] }) {
  const [rutaId, setRutaId] = useState(rutas[0].rutaId);
  const [resultado, setResultado] = useState<EstadoMapa | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerMapaRuta(rutaId)
      .then((mapa) => vigente && setResultado({ rutaId, mapa, error: null }))
      .catch((e) => vigente && setResultado({ rutaId, mapa: null, error: esNoEncontrado(e) ? "La ruta no existe o no es tuya." : mensajeDeError(e, "No se pudo cargar el mapa.") }));
    return () => { vigente = false; };
  }, [rutaId]);

  const actual = resultado?.rutaId === rutaId ? resultado : null;
  const mapa = actual?.mapa ?? null;
  const conUbicacion = mapa ? paradasConUbicacion(mapa) : [];
  const region = regionInicial(conUbicacion);
  const nombre = rutas.find((r) => r.rutaId === rutaId)?.rutaNombre ?? "Ruta";
  return <View style={styles.page}><AuroraBackground style={StyleSheet.absoluteFill} /><AppHeader title={mapa?.nombre ?? nombre} subtitle={mapa ? `${mapa.paradas.length} paradas` : "Mapa de ruta"} /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    {rutas.length > 1 && <View style={styles.legend}>{rutas.map((r) => <Pressable key={r.rutaId} onPress={() => setRutaId(r.rutaId)} style={[styles.order, { width: undefined, paddingHorizontal: 12 }, r.rutaId === rutaId && styles.orderActive]} accessibilityRole="button"><Text style={styles.orderText}>{r.rutaNombre}</Text></Pressable>)}</View>}
    {!actual && <ActivityIndicator />}
    {actual?.error && <GlassCard style={styles.mapCard}><Text style={styles.stopName}>{actual.error}</Text></GlassCard>}
    {mapa && <>
      <GlassCard style={styles.mapCard}>{region ? <MapView style={styles.mapGrid} initialRegion={region}>
        <Polyline coordinates={conUbicacion.map((p) => ({ latitude: p.coordenadas.lat, longitude: p.coordenadas.lng }))} strokeColor="#FFD60A" strokeWidth={4} />
        {conUbicacion.map((p) => <Marker key={p.envio_id} coordinate={{ latitude: p.coordenadas.lat, longitude: p.coordenadas.lng }} pinColor={colorEstado(p.estado)} title={`${p.orden}. ${p.destinatario_nombre}`} description={p.direccion} onCalloutPress={() => irAParada(p.envio_id)} onPress={() => irAParada(p.envio_id)}><View style={[styles.pin, { position: "relative", backgroundColor: colorEstado(p.estado) }]}><Text style={styles.pinText}>{p.orden}</Text></View><Callout tooltip={false}><Text style={styles.stopName}>{p.codigo_guia}</Text></Callout></Marker>)}
      </MapView> : <Text style={styles.stopAddress}>Ninguna parada tiene ubicación geográfica.</Text>}</GlassCard>
      <Text style={styles.section}>Orden de paradas</Text>
      <GlassCard style={styles.stopsCard}>{mapa.paradas.map((p) => <Pressable key={p.envio_id} onPress={() => irAParada(p.envio_id)} style={({ pressed }) => [styles.stopRow, pressed && styles.pressed]}><View style={[styles.order, { backgroundColor: colorEstado(p.estado) }]}><Text style={styles.orderText}>{p.orden}</Text></View><View style={styles.stopCopy}><Text style={styles.stopName}>{p.codigo_guia} · {p.destinatario_nombre}</Text><Text style={styles.stopAddress}>{p.direccion}, {p.localidad}</Text>{paradasSinUbicacion(mapa).includes(p) && <Text style={styles.stopAddress}>Sin ubicación geográfica</Text>}</View><Text style={styles.chevron}>›</Text></Pressable>)}</GlassCard>
    </>}
    <PrimaryButton label="Volver a mi ruta" onPress={() => router.back()} /></ScrollView></View>;
}

export default function RouteMapScreen() {
  const { rutasDelDia } = useMovii();
  const reales = rutasDelDia.filter((r) => r.rutaId !== "ruta-demo-local");
  // Sin backend (modo demo) se conserva la maqueta.
  return reales.length > 0 ? <RouteMapReal rutas={reales} /> : <RouteMapMock />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F7F8" }, content: { padding: 16, paddingTop: 11, gap: 18, maxWidth: 620, width: "100%", alignSelf: "center" }, mapCard: { padding: 10, gap: 12 }, mapPressable: { position: "relative" }, mapGrid: { height: 300, borderRadius: 16, overflow: "hidden", backgroundColor: "#EAEDEF", position: "relative" }, mapFull: { flex: 1, overflow: "hidden", backgroundColor: "#EAEDEF", position: "relative" }, roadVertical: { position: "absolute", top: -20, bottom: -20, left: "47%", width: 36, backgroundColor: "#FFFFFF", transform: [{ rotate: "15deg" }] }, roadHorizontal: { position: "absolute", left: -30, right: -30, top: "52%", height: 31, backgroundColor: "#FFFFFF", transform: [{ rotate: "-11deg" }] }, routeLine: { position: "absolute", width: 170, height: 150, top: 60, left: 77, borderTopWidth: 5, borderRightWidth: 5, borderColor: "#FFD60A", borderTopRightRadius: 64, transform: [{ rotate: "7deg" }] }, routeLineBend: { position: "absolute", height: 74, bottom: -76, right: -5, borderRightWidth: 5, borderColor: "#FFD60A" }, pin: { position: "absolute", width: 31, height: 31, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#FFFFFF" }, pinText: { color: "#1C1C1E", fontSize: 11, fontWeight: "800" }, pinStart: { left: 66, top: 184, backgroundColor: "#1C1C1E" }, pinMid: { left: 159, top: 81, backgroundColor: "#FFD60A" }, pinEnd: { right: 68, bottom: 53, backgroundColor: "#FFD60A" }, car: { position: "absolute", left: 135, bottom: 89, width: 28, height: 28, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#11111A", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, carText: { color: "#1C1C1E", fontSize: 12 }, mapLabel: { position: "absolute", right: 21, top: 21, backgroundColor: "rgba(255,255,255,0.78)", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 }, mapLabelText: { fontSize: 8, color: "#6E6E73", fontWeight: "800", letterSpacing: 1 }, expandPill: { position: "absolute", right: 11, bottom: 11, minHeight: 35, paddingHorizontal: 11, borderRadius: 18, backgroundColor: "rgba(28,28,30,0.9)", flexDirection: "row", alignItems: "center", gap: 6 }, expandIcon: { color: "#FFD60A", fontSize: 14 }, expandText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" }, legend: { flexDirection: "row", gap: 18, paddingHorizontal: 5 }, legendItem: { flexDirection: "row", alignItems: "center", gap: 6 }, legendDot: { width: 9, height: 9, borderRadius: 5 }, legendText: { color: "#6E6E73", fontSize: 11 }, section: { color: "#6E6E73", fontSize: 12, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase" }, stopsCard: { paddingVertical: 4 }, stopRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13 }, order: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EFEFF2", alignItems: "center", justifyContent: "center" }, orderActive: { backgroundColor: "#FFD60A" }, orderText: { color: "#1C1C1E", fontSize: 12, fontWeight: "800" }, stopCopy: { flex: 1 }, stopName: { color: "#1C1C1E", fontSize: 14, fontWeight: "800" }, stopAddress: { color: "#6E6E73", fontSize: 12, marginTop: 3 }, chevron: { color: "#6E6E73", fontSize: 25, fontWeight: "300" }, modal: { flex: 1, backgroundColor: "#EAEDEF" }, modalTop: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: 62, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 11 }, closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center", shadowColor: "#11111A", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, closeText: { color: "#1C1C1E", fontSize: 30, lineHeight: 32, fontWeight: "300", marginTop: -4 }, modalTitle: { flex: 1, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 13, paddingHorizontal: 12, paddingVertical: 7 }, modalEyebrow: { color: "#6E6E73", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 }, modalName: { color: "#1C1C1E", fontSize: 14, fontWeight: "800", marginTop: 1 }, modalDistance: { backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 13, paddingHorizontal: 10, paddingVertical: 13 }, modalDistanceText: { color: "#1C1C1E", fontSize: 11, fontWeight: "800" }, modalBottom: { position: "absolute", right: 16, bottom: 24, left: 16, gap: 4, padding: 16, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.96)", shadowColor: "#11111A", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }, modalNext: { color: "#6E6E73", fontSize: 10, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase" }, modalAddress: { color: "#1C1C1E", fontSize: 16, fontWeight: "800", marginBottom: 9 }, pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
});
