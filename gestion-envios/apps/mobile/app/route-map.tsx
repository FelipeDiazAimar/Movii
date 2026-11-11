import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { AuroraBackground } from "@/components/aurora-background";
import { MapaRuta } from "@/components/mapa-ruta";
import { GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { obtenerMapaRuta, obtenerTrayecto, type MapaRutaAPI, type TrayectoAPI } from "@/lib/api-client";
import type { DatosMapaApp } from "@/lib/mapa-html";
import { useMovii } from "@/lib/movii-context";
import { urlGoogleMaps, type ModoMaps } from "@/lib/google-maps";
import { haptic } from "@/lib/haptics";

const ESTADO_TEXTO: Record<string, string> = {
  asignado: "Pendiente",
  en_camino: "En camino",
  entregado: "Entregado",
  no_entregado: "No entregado",
  pendiente: "Sin ruta",
};

function km(m: number) {
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
function minutos(s: number) {
  return `${Math.max(1, Math.round(s / 60))} min`;
}

/** HU-12: la ruta del día en un mapa real, con el recorrido por calles y el camión en vivo. */
export default function RouteMapScreen() {
  const insets = useSafeAreaInsets();
  const { rutaId: rutaParam } = useLocalSearchParams<{ rutaId?: string }>();
  const { rutasDelDia } = useMovii();
  const rutaId = rutaParam ?? rutasDelDia[0]?.rutaId;

  const [mapa, setMapa] = useState<MapaRutaAPI | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [trayectoCargado, setTrayecto] = useState<TrayectoAPI | null>(null);
  // Sin parada elegida no hay trayecto, aunque quede el último cargado.
  const trayecto = elegida ? trayectoCargado : null;
  const [expanded, setExpanded] = useState(false);
  const [modoMaps, setModoMaps] = useState<ModoMaps>("proximo");

  const cargar = useCallback(async () => {
    if (!rutaId) return;
    try {
      setMapa(await obtenerMapaRuta(rutaId));
      setError(null);
    } catch {
      setError("No se pudo cargar el mapa de la ruta.");
    }
  }, [rutaId]);

  // El camión se mueve: se refresca la posición cada 5 s.
  useEffect(() => {
    void Promise.resolve().then(cargar);
    const t = setInterval(() => void cargar(), 5000);
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    if (!elegida) return;
    let vigente = true;
    const traer = () =>
      obtenerTrayecto(elegida)
        .then((t) => vigente && setTrayecto(t))
        .catch(() => vigente && setTrayecto(null));
    void traer();
    const t = setInterval(traer, 15000);
    return () => {
      vigente = false;
      clearInterval(t);
    };
  }, [elegida]);

  const paradas = useMemo(() => [...(mapa?.paradas ?? [])].sort((a, b) => a.orden - b.orden), [mapa]);
  const proxima = paradas.find((p) => p.estado === "en_camino") ?? paradas.find((p) => p.estado === "asignado");

  const datos = useMemo<DatosMapaApp>(
    () => ({
      paradas: paradas.flatMap((p) =>
        p.coordenadas
          ? [{ id: p.envio_id, orden: p.orden, estado: p.estado, lat: p.coordenadas.lat, lng: p.coordenadas.lng, titulo: p.codigo_guia, destacada: p.envio_id === elegida }]
          : [],
      ),
      recorrido: mapa?.recorrido?.geometria ?? null,
      trayecto: trayecto?.recorrido?.geometria ?? null,
      camion: mapa?.vehiculo ? { lat: mapa.vehiculo.lat, lng: mapa.vehiculo.lng, rumbo: mapa.vehiculo.rumbo, patente: mapa.vehiculo.patente } : null,
      deposito: mapa?.deposito ?? null,
      encuadre: `${rutaId}-${elegida ?? "ruta"}-${trayecto ? "t" : ""}`,
    }),
    [paradas, mapa, trayecto, elegida, rutaId],
  );

  // T5: abrir la navegación en Google Maps (app nativa si está instalada).
  const pendientes = paradas.filter((p) => p.coordenadas && p.estado !== "entregado" && p.estado !== "no_entregado").map((p) => p.coordenadas!);
  const origenMaps = mapa?.vehiculo ? { lat: mapa.vehiculo.lat, lng: mapa.vehiculo.lng } : mapa?.deposito;
  const urlMaps = urlGoogleMaps({ origen: origenMaps, paradas: pendientes, modo: modoMaps });
  const abrirMaps = () => {
    if (!urlMaps) return;
    haptic.medium();
    void Linking.openURL(urlMaps);
  };

  const elegidaInfo = paradas.find((p) => p.envio_id === elegida);
  const subtitulo = mapa
    ? `${paradas.length} paradas${mapa.recorrido ? ` · ${km(mapa.recorrido.distancia_m)}` : ""}${mapa.vehiculo ? ` · ${mapa.vehiculo.patente}` : ""}`
    : "Cargando…";

  if (!rutaId) {
    return (
      <View style={styles.page}>
        <AuroraBackground barra="light" style={StyleSheet.absoluteFill} />
        <AppHeader title="Mapa de ruta" subtitle="Sin ruta asignada hoy" />
        <View style={styles.content}>
          <GlassCard>
            <Text style={styles.empty}>Cuando tengas una ruta asignada para hoy vas a ver acá el recorrido y tus paradas.</Text>
          </GlassCard>
          <PrimaryButton label="Volver" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <AuroraBackground barra="light" style={StyleSheet.absoluteFill} />
      <AppHeader title={mapa?.nombre ?? "Mapa de ruta"} subtitle={subtitulo} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <GlassCard style={styles.mapCard}>
          {mapa ? (
            <View>
              <MapaRuta datos={datos} style={styles.map} onParadaPress={setElegida} />
              <Pressable onPress={() => setExpanded(true)} style={({ pressed }) => [styles.expandPill, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Ampliar mapa de ruta">
                <Text style={styles.expandIcon}>⛶</Text>
                <Text style={styles.expandText}>Ampliar</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.map, styles.loading]}>
              {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color="#806700" />}
            </View>
          )}
          {trayecto?.recorrido && elegidaInfo ? (
            <View style={styles.trayecto}>
              <Text style={styles.trayectoTitulo}>
                Hasta {elegidaInfo.destinatario_nombre}: {km(trayecto.recorrido.distancia_m)} · {minutos(trayecto.recorrido.duracion_s)}
              </Text>
              <Pressable onPress={() => setElegida(null)}>
                <Text style={styles.trayectoLink}>Ver toda la ruta</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#1C1C1E" }]} /><Text style={styles.legendText}>Tu camión</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#2563eb" }]} /><Text style={styles.legendText}>Pendiente</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#16a34a" }]} /><Text style={styles.legendText}>Entregado</Text></View>
              <Text style={styles.legendHint}>Tocá una parada para ver el camino</Text>
            </View>
          )}
        </GlassCard>

        <GlassCard oscura style={styles.mapsCard}>
          <View style={styles.mapsCabeza}>
            <Text style={styles.mapsTitulo}>Navegar con Google Maps</Text>
            <Text style={styles.mapsSub}>{pendientes.length === 0 ? "No quedan paradas pendientes con ubicación." : modoMaps === "proximo" ? "Te lleva a la próxima parada." : `Recorre las ${Math.min(pendientes.length, 10)} paradas pendientes en orden.`}</Text>
          </View>
          <View style={styles.segmento}>
            {(["proximo", "completo"] as const).map((m) => (
              <Pressable key={m} onPress={() => { haptic.selection(); setModoMaps(m); }} accessibilityRole="radio" accessibilityState={{ selected: modoMaps === m }} style={[styles.segmentoItem, modoMaps === m && styles.segmentoActivo]}>
                <Text style={[styles.segmentoTexto, modoMaps === m && styles.segmentoTextoActivo]}>{m === "proximo" ? "Próximo destino" : "Ruta completa"}</Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton label="Abrir en Maps" icon="⌖" onPress={abrirMaps} disabled={!urlMaps} />
        </GlassCard>

        <Text style={styles.section}>Orden de paradas</Text>
        <GlassCard style={styles.stopsCard}>
          {paradas.map((p) => {
            const esProxima = p.envio_id === proxima?.envio_id;
            return (
              <Pressable
                key={p.envio_id}
                onPress={() => router.push({ pathname: "/stop/[id]", params: { id: p.envio_id } })}
                onLongPress={() => setElegida(p.envio_id)}
                style={({ pressed }) => [styles.stopRow, p.envio_id === elegida && styles.stopRowActive, pressed && styles.pressed]}
              >
                <View style={[styles.order, esProxima && styles.orderActive, p.estado === "entregado" && styles.orderDone]}>
                  <Text style={[styles.orderText, p.estado === "entregado" && styles.orderTextDone]}>{p.estado === "entregado" ? "✓" : p.orden}</Text>
                </View>
                <View style={styles.stopCopy}>
                  <Text style={styles.stopName}>{p.destinatario_nombre}</Text>
                  <Text style={styles.stopAddress}>
                    {p.direccion}, {p.localidad} · {ESTADO_TEXTO[p.estado] ?? p.estado}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })}
          {mapa && paradas.length === 0 ? <Text style={styles.empty}>La ruta no tiene paradas.</Text> : null}
        </GlassCard>
        <PrimaryButton label="Volver a mi ruta" onPress={() => router.back()} />
      </ScrollView>

      <Modal visible={expanded} animationType="fade" onRequestClose={() => setExpanded(false)}>
        <View style={styles.modal}>
          <MapaRuta datos={{ ...datos, encuadre: `${datos.encuadre}-full` }} style={StyleSheet.absoluteFill} onParadaPress={setElegida} />
          <View style={[styles.modalTop, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
            <Pressable onPress={() => setExpanded(false)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Cerrar mapa ampliado">
              <Text style={styles.closeText}>×</Text>
            </Pressable>
            <View style={styles.modalTitle}>
              <Text style={styles.modalEyebrow}>{(mapa?.nombre ?? "").toUpperCase()}</Text>
              <Text style={styles.modalName}>Mapa de ruta</Text>
            </View>
          </View>
          {proxima ? (
            <View style={[styles.modalBottom, { bottom: 16 + insets.bottom }]}>
              <Text style={styles.modalNext}>Próxima parada</Text>
              <Text style={styles.modalAddress}>
                {proxima.direccion}, {proxima.localidad}
              </Text>
              <PrimaryButton
                label="Ver detalle"
                onPress={() => {
                  setExpanded(false);
                  router.push({ pathname: "/stop/[id]", params: { id: proxima.envio_id } });
                }}
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#EEF0F2" },
  content: { padding: 16, paddingTop: 16, gap: 18, maxWidth: 760, width: "100%", alignSelf: "center" },
  mapCard: { padding: 10, gap: 12 },
  mapsCard: { gap: 14, padding: 18 },
  mapsCabeza: { gap: 3 },
  mapsTitulo: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", letterSpacing: -0.3 },
  mapsSub: { color: "#9A9AA0", fontSize: 12.5, fontWeight: "600" },
  segmento: { flexDirection: "row", padding: 4, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)" },
  segmentoItem: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  segmentoActivo: { backgroundColor: "#FFFFFF" },
  segmentoTexto: { color: "#C7C7CC", fontSize: 13, fontWeight: "800" },
  segmentoTextoActivo: { color: "#1A1A1A" },
  map: { height: 320 },
  loading: { alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#E9EDEF" },
  expandPill: { position: "absolute", right: 11, bottom: 11, minHeight: 35, paddingHorizontal: 11, borderRadius: 18, backgroundColor: "rgba(28,28,30,0.9)", flexDirection: "row", alignItems: "center", gap: 6 },
  expandIcon: { color: "#F4B400", fontSize: 14 },
  expandText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingHorizontal: 5 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: "#6E6E73", fontSize: 11 },
  legendHint: { color: "#806700", fontSize: 11, fontWeight: "700" },
  trayecto: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: "#FFF4CC", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  trayectoTitulo: { flex: 1, color: "#1C1C1E", fontSize: 13, fontWeight: "700" },
  trayectoLink: { color: "#806700", fontSize: 12, fontWeight: "800" },
  section: { color: "#6E6E73", fontSize: 11, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase", paddingHorizontal: 4 },
  stopsCard: { paddingVertical: 4 },
  stopRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, borderRadius: 12 },
  stopRowActive: { backgroundColor: "#FFF4CC" },
  order: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EFEFF2", alignItems: "center", justifyContent: "center" },
  orderActive: { backgroundColor: "#F4B400" },
  orderDone: { backgroundColor: "#16a34a" },
  orderText: { color: "#1C1C1E", fontSize: 12, fontWeight: "800" },
  orderTextDone: { color: "#FFFFFF" },
  stopCopy: { flex: 1 },
  stopName: { color: "#1C1C1E", fontSize: 14, fontWeight: "800" },
  stopAddress: { color: "#6E6E73", fontSize: 12, marginTop: 3 },
  chevron: { color: "#6E6E73", fontSize: 25, fontWeight: "300" },
  empty: { color: "#6E6E73", fontSize: 13, lineHeight: 19, padding: 12, textAlign: "center" },
  error: { color: "#B42318", fontSize: 13, fontWeight: "700", textAlign: "center", padding: 12 },
  modal: { flex: 1, backgroundColor: "#EAEDEF" },
  modalTop: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 11 },
  closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center", shadowColor: "#11111A", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  closeText: { color: "#1C1C1E", fontSize: 30, lineHeight: 32, fontWeight: "300", marginTop: -4 },
  modalTitle: { flex: 1, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 13, paddingHorizontal: 12, paddingVertical: 7 },
  modalEyebrow: { color: "#6E6E73", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  modalName: { color: "#1C1C1E", fontSize: 14, fontWeight: "800", marginTop: 1 },
  modalBottom: { position: "absolute", right: 16, left: 16, gap: 4, padding: 16, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.96)", shadowColor: "#11111A", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  modalNext: { color: "#6E6E73", fontSize: 10, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase" },
  modalAddress: { color: "#1C1C1E", fontSize: 16, fontWeight: "800", marginBottom: 9 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
});
