import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AuroraBackground } from "@/components/aurora-background";
import { ShipmentTimeline } from "@/components/timeline";
import { AppMark, GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { StatusBadge } from "@/components/ui/status-badge";
import { consultarTracking } from "@/lib/api-client";
import { esNoEncontrado, formatearFecha, mensajeDeError, trackingAEventos, type TrackingInfo } from "@/lib/seguimiento";
import type { ShipmentStatus } from "@/types/logistics";

const TITULOS: Record<TrackingInfo["estado"], { titulo: string; estado: string }> = {
  pendiente: { titulo: "Tu envío fue registrado.", estado: "Esperando asignación a una ruta" },
  asignado: { titulo: "Tu envío está por salir.", estado: "Preparado para el reparto" },
  en_camino: { titulo: "Tu envío está en camino.", estado: "En ruta hacia tu dirección" },
  entregado: { titulo: "Tu envío fue entregado.", estado: "Entrega completada" },
  no_entregado: { titulo: "No pudimos entregar tu envío.", estado: "Entrega pendiente de reprogramación" },
};

function TrackingMapArtwork({ expanded = false, localidad }: { expanded?: boolean; localidad: string }) {
  return <View style={expanded ? styles.mapFull : styles.map}><View style={styles.mapRoadA} /><View style={styles.mapRoadB} /><View style={styles.routeLine} /><View style={styles.destination}><Text style={styles.destinationText}>⌖</Text></View><View style={styles.mapTag}><Text style={styles.mapTagText}>{localidad.toUpperCase()}</Text></View></View>;
}

/** HU-10: tracking público. Solo muestra lo que devuelve la API: código, estado, localidad e historial (sin datos personales). */
export default function TrackingDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [mapExpanded, setMapExpanded] = useState(false);
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true; // ignora la respuesta si el usuario ya cambió de código o salió
    consultarTracking(code)
      .then((t) => { if (vigente) { setTracking(t); setCargando(false); } })
      .catch((e) => {
        if (!vigente) return;
        if (esNoEncontrado(e)) setNoEncontrado(true);
        else setError(mensajeDeError(e, "No se pudo consultar el envío."));
        setCargando(false);
      });
    return () => { vigente = false; };
  }, [code, intento]);

  const reintentar = () => { setCargando(true); setError(null); setNoEncontrado(false); setIntento((n) => n + 1); };

  if (cargando) return <View style={styles.page}><AuroraBackground style={StyleSheet.absoluteFill} /><View style={styles.loading}><ActivityIndicator color="#806700" /><Text style={styles.loadingText}>Buscando tu envío…</Text></View></View>;
  if (noEncontrado || error || !tracking) return <View style={styles.page}><AuroraBackground style={StyleSheet.absoluteFill} /><View style={styles.notFound}><AppMark /><Text style={styles.notFoundTitle}>{noEncontrado ? "No encontramos ningún envío con ese código." : "No pudimos consultar tu envío."}</Text>{error ? <Text style={styles.statusCopy}>{error}</Text> : null}{error ? <PrimaryButton label="Reintentar" onPress={reintentar} /> : null}<PrimaryButton label="Buscar otro código" tone="secondary" onPress={() => router.replace("/tracking")} /></View></View>;

  const textos = TITULOS[tracking.estado] ?? TITULOS.pendiente;
  // El badge del prototipo no tiene "asignado": se muestra como pendiente (igual que en la ruta del día).
  const badge: ShipmentStatus = tracking.estado === "asignado" ? "pendiente" : tracking.estado;
  const ultimo = tracking.historial[tracking.historial.length - 1];
  return <View style={styles.page}><AuroraBackground style={StyleSheet.absoluteFill} /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.top}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Volver"><Text style={styles.backText}>‹</Text></Pressable><AppMark compact /><Text style={styles.help}>Ayuda</Text></View><View style={styles.headline}><Text style={styles.kicker}>SEGUIMIENTO DE ENVÍO</Text><Text style={styles.title}>{textos.titulo}</Text><Text style={styles.code}>{tracking.codigo_guia}</Text></View><GlassCard style={styles.statusCard}><View style={styles.statusTop}><View><Text style={styles.statusLabel}>ESTADO ACTUAL</Text><Text style={styles.statusTitle}>{textos.estado}</Text></View><StatusBadge status={badge} /></View><Text style={styles.statusCopy}>{ultimo ? ultimo.descripcion : "Todavía no hay movimientos registrados."}</Text></GlassCard><Pressable onPress={() => setMapExpanded(true)} style={({ pressed }) => [styles.mapPressable, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Abrir mapa en pantalla completa"><TrackingMapArtwork localidad={tracking.localidad} /><View style={styles.expandPill}><Text style={styles.expandIcon}>⛶</Text><Text style={styles.expandText}>Ver mapa</Text></View></Pressable><GlassCard style={styles.destinationCard}><Text style={styles.destinationLabel}>DESTINO</Text><Text style={styles.destinationAddress}>{tracking.localidad}</Text><Text style={styles.deliveryDate}>Actualizado · {formatearFecha(tracking.actualizado_en)}</Text></GlassCard><Text style={styles.section}>Recorrido del envío</Text><GlassCard>{tracking.historial.length > 0 ? <ShipmentTimeline events={trackingAEventos(tracking)} /> : <Text style={styles.statusCopy}>Sin eventos registrados todavía.</Text>}</GlassCard><PrimaryButton label="Consultar otro envío" tone="secondary" onPress={() => router.replace("/tracking")} /></ScrollView><Modal visible={mapExpanded} animationType="fade" onRequestClose={() => setMapExpanded(false)}><View style={styles.modal}><TrackingMapArtwork expanded localidad={tracking.localidad} /><View style={styles.modalHeader}><Pressable onPress={() => setMapExpanded(false)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Cerrar mapa"><Text style={styles.closeText}>×</Text></Pressable><View style={styles.modalTitleWrap}><Text style={styles.modalEyebrow}>SEGUIMIENTO DE ENVÍO</Text><Text style={styles.modalTitle}>{tracking.codigo_guia}</Text></View></View><View style={styles.modalCard}><Text style={styles.modalState}>{textos.estado}</Text><Text style={styles.modalAddress}>{tracking.localidad}</Text><PrimaryButton label="Cerrar mapa" tone="secondary" onPress={() => setMapExpanded(false)} /></View></View></Modal></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#F7F7F8" }, content: { paddingTop: 55, paddingHorizontal: 16, paddingBottom: 32, gap: 15, maxWidth: 620, width: "100%", alignSelf: "center" }, top: { height: 38, flexDirection: "row", alignItems: "center", gap: 12 }, back: { width: 38, height: 38, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" }, backText: { color: "#1C1C1E", fontSize: 31, fontWeight: "300", lineHeight: 34, marginTop: -4 }, help: { marginLeft: "auto", color: "#806700", fontSize: 13, fontWeight: "800" }, headline: { gap: 6, marginTop: 11 }, kicker: { color: "#6E6E73", fontSize: 11, fontWeight: "800", letterSpacing: 0.9 }, title: { color: "#1C1C1E", fontSize: 29, lineHeight: 34, fontWeight: "800", letterSpacing: -1 }, code: { color: "#6E6E73", fontSize: 12, fontWeight: "700" }, statusCard: { gap: 10 }, statusTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, statusLabel: { color: "#6E6E73", fontSize: 10, letterSpacing: 0.75, fontWeight: "800" }, statusTitle: { color: "#1C1C1E", fontSize: 16, fontWeight: "800", marginTop: 4, maxWidth: 220 }, statusCopy: { color: "#6E6E73", fontSize: 13, lineHeight: 18 }, mapPressable: { position: "relative", borderRadius: 21, overflow: "hidden" }, map: { height: 174, backgroundColor: "#E9EDEF", position: "relative" }, mapFull: { flex: 1, backgroundColor: "#E9EDEF", position: "relative" }, mapRoadA: { position: "absolute", width: 480, height: 33, backgroundColor: "#FFFFFF", top: 73, left: -50, transform: [{ rotate: "-11deg" }] }, mapRoadB: { position: "absolute", height: 230, width: 37, backgroundColor: "#FFFFFF", top: -35, left: "58%", transform: [{ rotate: "12deg" }] }, routeLine: { position: "absolute", width: 180, height: 100, left: 75, top: 34, borderTopWidth: 4, borderRightWidth: 4, borderColor: "#FFD60A", borderTopRightRadius: 58 }, destination: { position: "absolute", top: 42, right: 74, width: 34, height: 34, borderRadius: 18, backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#FFFFFF" }, destinationText: { color: "#FFD60A", fontSize: 16 }, mapTag: { position: "absolute", left: 11, bottom: 11, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.88)" }, mapTagText: { color: "#6E6E73", fontSize: 8, letterSpacing: 0.8, fontWeight: "800" }, expandPill: { position: "absolute", right: 11, bottom: 11, minHeight: 34, paddingHorizontal: 10, borderRadius: 18, backgroundColor: "rgba(28,28,30,0.9)", flexDirection: "row", alignItems: "center", gap: 6 }, expandIcon: { color: "#FFD60A", fontSize: 14 }, expandText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" }, destinationCard: { gap: 4 }, destinationLabel: { color: "#6E6E73", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, destinationAddress: { color: "#1C1C1E", fontSize: 16, fontWeight: "800" }, destinationLocality: { color: "#6E6E73", fontSize: 13 }, deliveryDate: { color: "#806700", fontSize: 12, fontWeight: "700", marginTop: 4 }, section: { color: "#6E6E73", fontSize: 12, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase", marginTop: 2 }, notFound: { flex: 1, justifyContent: "center", padding: 30, gap: 20, maxWidth: 440, width: "100%", alignSelf: "center" }, notFoundTitle: { color: "#1C1C1E", fontSize: 25, fontWeight: "800", letterSpacing: -0.7 }, modal: { flex: 1, backgroundColor: "#E9EDEF" }, modalHeader: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: 62, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12 }, closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center", shadowColor: "#11111A", shadowOpacity: 0.16, shadowRadius: 9, shadowOffset: { width: 0, height: 3 } }, closeText: { color: "#1C1C1E", fontSize: 30, lineHeight: 32, fontWeight: "300", marginTop: -4 }, modalTitleWrap: { flex: 1, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.92)" }, modalEyebrow: { color: "#6E6E73", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 }, modalTitle: { color: "#1C1C1E", fontSize: 14, fontWeight: "800", marginTop: 2 }, modalCard: { position: "absolute", bottom: 25, left: 16, right: 16, gap: 5, padding: 17, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.96)", shadowColor: "#11111A", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }, modalState: { color: "#1C1C1E", fontSize: 16, fontWeight: "800" }, modalAddress: { color: "#6E6E73", fontSize: 13, marginBottom: 8 }, pressed: { opacity: 0.65, transform: [{ scale: 0.985 }] }, loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 }, loadingText: { color: "#6E6E73", fontSize: 14 }, });
