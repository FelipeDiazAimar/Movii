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
  const [trayecto, setTrayecto] = useState<TrayectoAPI | null>(null);
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
    void cargar();
    const t = setInterval(() => void cargar(), 5000);
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    if (!elegida) {
      setTrayecto(null);
      return;
    }
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

  const paradasPendientes = useMemo(() => {
    return paradas
      .filter((p) => p.estado !== "entregado" && p.estado !== "no_entregado")
      .map((p) =>
        p.coordenadas
          ? { lat: p.coordenadas.lat, lng: p.coordenadas.lng }
          : `${p.direccion}, ${p.localidad}`,
      );
  }, [paradas]);

  const abrirEnGoogleMaps = () => {
    const origen = datos.camion
      ? { lat: datos.camion.lat, lng: datos.camion.lng }
      : (datos.deposito ?? undefined);
    const paradasMapear =
      modoMaps === "proximo"
        ? (proxima
            ? [
                proxima.coordenadas
                  ? { lat: proxima.coordenadas.lat, lng: proxima.coordenadas.lng }
                  : `${proxima.direccion}, ${proxima.localidad}`,
              ]
            : paradasPendientes.slice(0, 1))
        : paradasPendientes;

    const url = urlGoogleMaps({ origen, paradas: paradasMapear, modo: modoMaps });
    if (url) Linking.openURL(url);
  };

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

  const elegidaInfo = paradas.find((p) => p.envio_id === elegida);
  const subtitulo = mapa
    ? `${paradas.length} paradas${mapa.recorrido ? ` · ${km(mapa.recorrido.distancia_m)}` : ""}${mapa.vehiculo ? ` · ${mapa.vehiculo.patente}` : ""}`
    : "Cargando…";

  if (!rutaId) {
    return (
      <View style={styles.page}>
        <AuroraBackground style={StyleSheet.absoluteFill} />
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
      <AuroraBackground style={StyleSheet.absoluteFill} />
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

        <GlassCard style={styles.mapsCard}>
          <View style={styles.mapsTop}>
            <Text style={styles.mapsTitle}>Navegación en Google Maps</Text>
            <View style={styles.modoSelector}>
              <Pressable
                onPress={() => setModoMaps("proximo")}
                style={[styles.modoChip, modoMaps === "proximo" && styles.modoChipActivo]}
                accessibilityRole="button"
                accessibilityLabel="Modo próxima parada"
              >
                <Text style={[styles.modoChipText, modoMaps === "proximo" && styles.modoChipTextActivo]}>
                  Próxima
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setModoMaps("completo")}
                style={[styles.modoChip, modoMaps === "completo" && styles.modoChipActivo]}
                accessibilityRole="button"
                accessibilityLabel="Modo ruta completa"
              >
                <Text style={[styles.modoChipText, modoMaps === "completo" && styles.modoChipTextActivo]}>
                  Completa ({paradasPendientes.length})
                </Text>
              </Pressable>
            </View>
          </View>
          <PrimaryButton
            label={
              modoMaps === "completo"
                ? `Abrir ruta completa en Maps (${paradasPendientes.length} paradas)`
                : proxima
                  ? `Abrir próxima parada: ${proxima.destinatario_nombre}`
                  : "Abrir en Maps"
            }
            tone="secondary"
            icon="⌖"
            onPress={abrirEnGoogleMaps}
            disabled={paradasPendientes.length === 0}
          />
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
  page: { flex: 1, backgroundColor: "#F7F7F8" },
  content: { padding: 16, paddingTop: 11, gap: 18, maxWidth: 620, width: "100%", alignSelf: "center" },
  mapCard: { padding: 10, gap: 12 },
  mapsCard: { gap: 10, padding: 14 },
  mapsTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  mapsTitle: { color: "#1C1C1E", fontSize: 13, fontWeight: "800" },
  modoSelector: { flexDirection: "row", gap: 6 },
  modoChip: { minHeight: 30, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 1, borderColor: "#E5E5EA", alignItems: "center", justifyContent: "center" },
  modoChipActivo: { backgroundColor: "#1C1C1E", borderColor: "#1C1C1E" },
  modoChipText: { color: "#59595F", fontSize: 11, fontWeight: "700" },
  modoChipTextActivo: { color: "#FFD60A" },
  map: { height: 320 },
  loading: { alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#E9EDEF" },
  expandPill: { position: "absolute", right: 11, bottom: 11, minHeight: 35, paddingHorizontal: 11, borderRadius: 18, backgroundColor: "rgba(28,28,30,0.9)", flexDirection: "row", alignItems: "center", gap: 6 },
  expandIcon: { color: "#FFD60A", fontSize: 14 },
  expandText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingHorizontal: 5 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: "#6E6E73", fontSize: 11 },
  legendHint: { color: "#806700", fontSize: 11, fontWeight: "700" },
  trayecto: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: "#FFF4CC", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  trayectoTitulo: { flex: 1, color: "#1C1C1E", fontSize: 13, fontWeight: "700" },
  trayectoLink: { color: "#806700", fontSize: 12, fontWeight: "800" },
  section: { color: "#6E6E73", fontSize: 12, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase" },
  stopsCard: { paddingVertical: 4 },
  stopRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, borderRadius: 12 },
  stopRowActive: { backgroundColor: "#FFF4CC" },
  order: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EFEFF2", alignItems: "center", justifyContent: "center" },
  orderActive: { backgroundColor: "#FFD60A" },
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
