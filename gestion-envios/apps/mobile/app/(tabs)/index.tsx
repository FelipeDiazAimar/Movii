import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/aurora-background";
import { MiniCamion } from "@/components/mini-camion";
import { GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { Aparecer, Carril, NumeroAnimado, Presionable, PuntoVivo } from "@/components/ui/efectos";
import { StatusBadge } from "@/components/ui/status-badge";
import { M, SOMBRA } from "@/constants/movii-design";
import { useAccionEnvio } from "@/hooks/use-accion-envio";
import { iniciarRuta } from "@/lib/api-client";
import { useMovii } from "@/lib/movii-context";
import { haptic } from "@/lib/haptics";
import { buscarEnRutas, contadoresDelDia, estadoEfectivo, filtrarPorEstado, rutaSinIniciar, type EstadoEnvioAPI, type RutaDelDia } from "@/lib/envios-del-dia";
import { type Shipment, type ShipmentStatus } from "@/types/logistics";

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

const COLOR_ESTADO: Record<ShipmentStatus, string> = { pendiente: "#6B7280", en_camino: M.naranja, entregado: M.verde, no_entregado: M.rojo };

/** Tarjeta de parada a todo el ancho: número (o tilde si ya se entregó), destinatario, dirección y estado. */
function Parada({ shipment, indice, onPress }: { shipment: Shipment; indice: number; onPress: () => void }) {
  const color = COLOR_ESTADO[shipment.status];
  const hecha = shipment.status === "entregado";
  const activa = shipment.status === "en_camino";
  return (
    <Aparecer indice={indice} style={styles.paradaFila}>
      <Presionable
        accessibilityRole="button"
        accessibilityLabel={`Ver parada ${shipment.stopOrder}, ${shipment.recipient.name}`}
        onPress={onPress}
        escala={0.98}
        style={[styles.parada, activa && styles.paradaActiva]}
      >
        {activa ? <View style={styles.paradaBarra} /> : null}
        <View style={styles.paradaCabeza}>
          <View style={[styles.numero, { borderColor: color, backgroundColor: hecha ? color : "#FFFFFF" }]}>
            {hecha ? <Text style={styles.numeroCheck}>✓</Text> : <Text style={[styles.numeroTexto, { color }]}>{shipment.stopOrder}</Text>}
          </View>
          <Text numberOfLines={1} style={styles.paradaNombre}>{shipment.recipient.name}</Text>
          <Text style={styles.paradaPeso}>{shipment.weight}</Text>
        </View>
        <Text numberOfLines={1} style={styles.paradaDireccion}>{shipment.recipient.address} · {shipment.recipient.locality}</Text>
        <View style={styles.paradaPie}>
          <StatusBadge status={shipment.status} />
          <Text style={styles.paradaCodigo}>{shipment.code}</Text>
        </View>
      </Presionable>
    </Aparecer>
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

/**
 * Tarjeta "Iniciar ruta": una por cada ruta del día que todavía no salió del
 * depósito (ver rutaSinIniciar). El primer toque pide confirmación en la misma
 * tarjeta; al confirmar, contra la API real llama a POST /rutas/{id}/iniciar y
 * recarga el día (vía useAccionEnvio, como las otras acciones), y en modo demo
 * pasa esos envíos a en_camino en el estado local (igual que "Marcar en
 * camino" en app/stop/[id].tsx). Una vez iniciada, la tarjeta desaparece
 * porque los envíos ya figuran en camino.
 */
function TarjetaIniciarRuta({ ruta }: { ruta: RutaDelDia }) {
  const { setShipmentStatus } = useMovii();
  const { ejecutar, enviando, error } = useAccionEnvio();
  const [confirmando, setConfirmando] = useState(false);
  const porSalir = ruta.envios.filter((envio) => estadoEfectivo(envio) === "asignado");
  const real = ruta.envios.some((envio) => Boolean(envio.estadoApi));
  if (porSalir.length === 0) return null;
  const cantidad = `${porSalir.length} ${porSalir.length === 1 ? "envío" : "envíos"}`;

  const iniciar = async () => {
    if (!real) {
      for (const envio of porSalir) setShipmentStatus(envio.id, "en_camino");
      haptic.medium();
      setConfirmando(false);
      return;
    }
    const ok = await ejecutar(async () => {
      await iniciarRuta(ruta.rutaId);
    });
    if (ok) {
      haptic.success();
      setConfirmando(false);
    } else {
      haptic.error();
    }
  };

  return (
    <GlassCard style={styles.iniciar}>
      <View style={styles.iniciarCabeza}>
        <View style={styles.iniciarEyebrowFila}><View style={styles.eyebrowBarra} /><Text style={styles.iniciarEyebrow}>LISTA PARA SALIR</Text></View>
        <Text style={styles.iniciarTitulo}>{ruta.rutaNombre}</Text>
        <Text style={styles.iniciarCopete}>Salís del depósito con {cantidad}.</Text>
      </View>
      {confirmando ? (
        <View style={styles.iniciarConfirmar}>
          <Text style={styles.iniciarPregunta}>¿Salís a repartir con {cantidad}?</Text>
          <View style={styles.iniciarAcciones}>
            <View style={styles.iniciarAccionMitad}>
              <PrimaryButton label={enviando ? "Iniciando…" : "Sí, iniciar"} onPress={iniciar} disabled={enviando} icon="→" />
            </View>
            <View style={styles.iniciarAccionMitad}>
              <PrimaryButton label="Volver" tone="secondary" onPress={() => setConfirmando(false)} disabled={enviando} />
            </View>
          </View>
        </View>
      ) : (
        <PrimaryButton label="Iniciar ruta" onPress={() => setConfirmando(true)} icon="→" accessibilityLabel={`Iniciar ruta ${ruta.rutaNombre} con ${cantidad}`} />
      )}
      {error ? <Text style={styles.iniciarError} accessibilityRole="alert">{error}</Text> : null}
    </GlassCard>
  );
}

function Dato({ valor, etiqueta, color = "#FFFFFF" }: { valor: number; etiqueta: string; color?: string }) {
  return (
    <View style={styles.dato}>
      <NumeroAnimado valor={valor} style={[styles.datoNumero, { color }]} />
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

export default function RouteScreen() {
  // Margen superior real (notch / barra de estado), también en la PWA instalada.
  const insets = useSafeAreaInsets();
  const {
    rutasDelDia,
    resumenDelDia,
    filtroEstado,
    setFiltroEstado,
    cargandoEnviosDelDia,
    errorEnviosDelDia,
    recargarEnviosDelDia,
    driverName,
  } = useMovii();
  const partes = driverName.trim().split(/\s+/).filter(Boolean);
  const nombre = partes[0] ? partes[0].charAt(0).toUpperCase() + partes[0].slice(1) : "";
  const driver = { name: nombre, initials: partes.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") };

  // CA-03: una sección por ruta. El filtro de CA-04 se aplica dentro de cada
  // ruta y las rutas que quedan sin envíos no se muestran.
  const [busqueda, setBusqueda] = useState("");
  const secciones = useMemo(
    () =>
      buscarEnRutas(filtrarPorEstado(rutasDelDia, filtroEstado), busqueda).map((ruta) => ({
        rutaId: ruta.rutaId,
        title: ruta.rutaNombre,
        data: ruta.envios,
      })),
    [rutasDelDia, filtroEstado, busqueda],
  );

  // Rutas que todavía no salieron del depósito: una tarjeta "Iniciar ruta" por
  // cada una. Se calculan sobre el día completo, no sobre lo filtrado, para que
  // la tarjeta no aparezca y desaparezca al buscar o filtrar.
  const rutasPorIniciar = useMemo(() => rutasDelDia.filter(rutaSinIniciar), [rutasDelDia]);

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
  // sola, el nombre ya está en el panel de resumen.
  const mostrarEncabezadosDeRuta = rutasDelDia.length > 1;

  const vacioPorFiltro = total > 0 && secciones.length === 0;
  const hayBusqueda = busqueda.trim().length > 0;

  // El camión recorre la calzada según el avance del día.
  const [pista, setPista] = useState(0);
  const avance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(avance, { toValue: progreso, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progreso, avance]);
  const camionAncho = 78;
  const camionX = avance.interpolate({ inputRange: [0, 100], outputRange: [0, Math.max(pista - camionAncho, 0)], extrapolate: "clamp" });
  const estela = avance.interpolate({ inputRange: [0, 100], outputRange: [camionAncho / 2, Math.max(pista - camionAncho / 2, camionAncho / 2)], extrapolate: "clamp" });

  return (
    <View style={styles.page}>
      <AuroraBackground barra="light" style={StyleSheet.absoluteFill} />
      <SectionList
        sections={secciones}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={cargandoEnviosDelDia} onRefresh={recargarEnviosDelDia} />}
        ListHeaderComponent={
          <View>
            {/* Panel de asfalto */}
            <View style={[styles.hero, { paddingTop: insets.top + 18 }]}>
              <View style={styles.heroGlow} pointerEvents="none" />
              <View style={styles.topBar}>
                <View>
                  <View style={styles.vivoFila}><PuntoVivo color={M.amarillo} tam={8} /><Text style={styles.saludo}>EN SERVICIO</Text></View>
                  <Text style={styles.nombre}>{driver.name ? `Buen día, ${driver.name}.` : "Buen día."}</Text>
                </View>
                <View style={styles.avatar}><Text style={styles.avatarTexto}>{driver.initials}</Text></View>
              </View>
              {errorEnviosDelDia ? <Text style={styles.errorBanner}>{errorEnviosDelDia}</Text> : null}

              <Text style={styles.heroEyebrow}>MI RUTA DE HOY</Text>
              <View style={styles.heroTitulo}>
                <Text numberOfLines={2} style={styles.rutaNombre}>{nombreRuta}</Text>
                <View style={styles.porcentaje}>
                  <NumeroAnimado valor={progreso} sufijo="%" style={styles.porcentajeNumero} />
                  <Text style={styles.porcentajeTexto}>listo</Text>
                </View>
              </View>

              {/* Calzada con el camión */}
              <View style={styles.calzada} onLayout={(e: LayoutChangeEvent) => setPista(e.nativeEvent.layout.width)}>
                <View style={styles.calzadaFondo} />
                <View style={styles.calzadaCarril}><Carril color="#FFFFFF" alto={3} opacidad={0.35} /></View>
                <Animated.View style={[styles.estela, { width: estela }]} />
                <Animated.View style={[styles.camion, { transform: [{ translateX: camionX }] }]}><MiniCamion ancho={camionAncho} /></Animated.View>
                <View style={styles.bandera}><Text style={styles.banderaTexto}>⚑</Text></View>
              </View>

              <View style={styles.datos}>
                <Dato valor={total} etiqueta="total" />
                <View style={styles.datoDivisor} />
                <Dato valor={entregados} etiqueta="entregados" color="#4ADE80" />
                <View style={styles.datoDivisor} />
                <Dato valor={pendientes} etiqueta="pendientes" color={M.amarillo} />
                <View style={styles.datoDivisor} />
                <Dato valor={noEntregados} etiqueta="no entreg." color="#F87171" />
              </View>

              <Presionable onPress={() => router.push("/route-map")} accessibilityRole="button" accessibilityLabel="Ver ruta en el mapa" style={styles.botonMapa}>
                <Text style={styles.botonMapaIcono}>⌖</Text>
                <Text style={styles.botonMapaTexto}>Ver ruta en el mapa</Text>
                <Text style={styles.botonMapaFlecha}>→</Text>
              </Presionable>
            </View>

            {rutasPorIniciar.length > 0 ? (
              <View style={styles.iniciarBloque}>
                {rutasPorIniciar.map((ruta) => <TarjetaIniciarRuta key={ruta.rutaId} ruta={ruta} />)}
              </View>
            ) : null}
            <View style={styles.listaCabeza}>
              <View style={styles.eyebrowFila}><View style={styles.eyebrowBarra} /><Text style={styles.eyebrow}>PRÓXIMAS PARADAS</Text></View>
              <Text style={styles.listaTitulo}>Tu recorrido</Text>
            </View>
            <View style={styles.buscador}>
              <Text style={styles.buscadorLupa}>⌕</Text>
              <TextInput
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar por nombre, dirección o código"
                maxLength={100}
                placeholderTextColor={M.grisClaro}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Buscar envío"
                style={[styles.buscadorInput, Platform.OS === "web" && ({ outlineStyle: "none" } as object)]}
              />
              {hayBusqueda ? (
                <Pressable onPress={() => setBusqueda("")} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" style={styles.buscadorX}>
                  <Text style={styles.buscadorXTexto}>×</Text>
                </Pressable>
              ) : null}
            </View>
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
        renderItem={({ item, index }) => (
          <Parada shipment={item} indice={index} onPress={() => router.push({ pathname: "/stop/[id]", params: { id: item.id } })} />
        )}
        ListEmptyComponent={
          cargandoEnviosDelDia ? null : (
            <Text style={styles.emptyText}>
              {vacioPorFiltro ? (hayBusqueda ? "Ningún envío coincide con la búsqueda." : "Ningún envío coincide con el filtro seleccionado.") : "No tenés envíos asignados para hoy."}
            </Text>
          )
        }
        ListFooterComponent={<View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: M.hormigon100 },
  content: { paddingBottom: 130, maxWidth: 760, width: "100%", alignSelf: "center" },
  hero: { backgroundColor: M.asfalto, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, paddingHorizontal: 20, paddingBottom: 20, gap: 14, overflow: "hidden", ...SOMBRA.lift },
  heroGlow: { position: "absolute", top: -90, right: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: M.amarillo, opacity: 0.16 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  vivoFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  saludo: { color: M.amarillo, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.3 },
  nombre: { color: "#FFFFFF", fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  avatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: M.amarillo, justifyContent: "center", alignItems: "center", transform: [{ rotate: "6deg" }] },
  avatarTexto: { color: M.asfalto, fontWeight: "900", fontSize: 15 },
  errorBanner: { color: "#FCA5A5", fontSize: 12, fontWeight: "800", textAlign: "center" },
  heroEyebrow: { color: "#9A9AA0", fontSize: 10.5, fontWeight: "900", letterSpacing: 1.2, marginTop: 4 },
  heroTitulo: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: -8 },
  rutaNombre: { flex: 1, color: "#FFFFFF", fontSize: 21, lineHeight: 25, fontWeight: "900", letterSpacing: -0.6 },
  porcentaje: { alignItems: "flex-end" },
  porcentajeNumero: { color: M.amarillo, fontSize: 34, lineHeight: 36, fontWeight: "900", letterSpacing: -1.5 },
  porcentajeTexto: { color: "#9A9AA0", fontSize: 11, fontWeight: "800", marginTop: -2 },
  calzada: { height: 52, justifyContent: "flex-end", marginTop: 2 },
  calzadaFondo: { position: "absolute", left: 0, right: 0, bottom: 0, height: 22, borderRadius: 11, backgroundColor: M.asfalto3 },
  calzadaCarril: { position: "absolute", left: 10, right: 10, bottom: 9 },
  estela: { position: "absolute", left: 0, bottom: 0, height: 22, borderRadius: 11, backgroundColor: "rgba(244,180,0,0.28)" },
  camion: { position: "absolute", left: 0, bottom: 5 },
  bandera: { position: "absolute", right: 4, bottom: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: M.amarillo, alignItems: "center", justifyContent: "center" },
  banderaTexto: { color: M.asfalto, fontSize: 12, fontWeight: "900", marginTop: -1 },
  datos: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, paddingVertical: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  dato: { flex: 1, alignItems: "center" },
  datoNumero: { fontSize: 22, fontWeight: "900", letterSpacing: -0.8 },
  datoEtiqueta: { color: "#9A9AA0", fontSize: 10, fontWeight: "700", marginTop: 1 },
  datoDivisor: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.1)" },
  botonMapa: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, borderRadius: 16, backgroundColor: M.amarillo },
  botonMapaIcono: { fontSize: 19, fontWeight: "900", color: M.asfalto },
  botonMapaTexto: { flex: 1, color: M.asfalto, fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  botonMapaFlecha: { color: M.asfalto, fontSize: 20, fontWeight: "900" },
  iniciarBloque: { paddingHorizontal: 16, marginTop: 16, gap: 12 },
  iniciar: { gap: 12 },
  iniciarCabeza: { gap: 4 },
  iniciarEyebrowFila: { flexDirection: "row", alignItems: "center", gap: 7 },
  iniciarEyebrow: { color: M.gris, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  iniciarTitulo: { color: M.texto, fontSize: 19, fontWeight: "900", letterSpacing: -0.5 },
  iniciarCopete: { color: M.gris, fontSize: 13.5, fontWeight: "600" },
  iniciarConfirmar: { gap: 10 },
  iniciarPregunta: { color: M.texto, fontSize: 14.5, fontWeight: "800" },
  iniciarAcciones: { flexDirection: "row", gap: 10 },
  iniciarAccionMitad: { flex: 1 },
  iniciarError: { color: "#B42318", fontSize: 13, fontWeight: "700", textAlign: "center" },
  listaCabeza: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  eyebrowFila: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 },
  eyebrowBarra: { width: 16, height: 4, borderRadius: 2, backgroundColor: M.amarillo },
  eyebrow: { color: M.gris, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  listaTitulo: { color: M.texto, fontSize: 27, lineHeight: 31, fontWeight: "900", letterSpacing: -1 },
  filtros: { gap: 8, paddingHorizontal: 20, paddingBottom: 6 },
  chip: { minHeight: 36, justifyContent: "center", paddingHorizontal: 15, borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: M.hormigon200 },
  chipActivo: { backgroundColor: M.asfalto, borderColor: M.asfalto },
  chipTexto: { color: "#4B5563", fontSize: 12.5, fontWeight: "800" },
  chipTextoActivo: { color: M.amarillo },
  rutaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  rutaHeaderTitulo: { flex: 1, color: M.texto, fontSize: 14, fontWeight: "900", letterSpacing: -0.2 },
  rutaHeaderConteo: { color: M.gris, fontSize: 11, fontWeight: "800" },
  paradaFila: { paddingHorizontal: 16, marginTop: 12 },
  numero: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  numeroTexto: { fontSize: 13, fontWeight: "900" },
  numeroCheck: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", marginTop: -1 },
  buscador: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginBottom: 12, minHeight: 50, paddingHorizontal: 14, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: M.hormigon200, ...SOMBRA.panel },
  buscadorLupa: { color: M.gris, fontSize: 22, fontWeight: "700", marginTop: -3 },
  buscadorInput: { flex: 1, minHeight: 46, color: M.texto, fontSize: 15, fontWeight: "600" },
  buscadorX: { width: 26, height: 26, borderRadius: 13, backgroundColor: M.hormigon100, alignItems: "center", justifyContent: "center" },
  buscadorXTexto: { color: M.gris, fontSize: 18, fontWeight: "700", marginTop: -2 },
  parada: { gap: 6, padding: 16, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: M.hormigon200, overflow: "hidden", ...SOMBRA.panel },
  paradaActiva: { borderColor: M.amarillo, borderWidth: 1.5 },
  paradaBarra: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundColor: M.amarillo },
  paradaCabeza: { flexDirection: "row", alignItems: "center", gap: 8 },
  paradaNombre: { flex: 1, color: M.texto, fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  paradaPeso: { color: M.gris, fontSize: 11, fontWeight: "800", backgroundColor: M.hormigon100, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" },
  paradaDireccion: { color: M.gris, fontSize: 12.5 },
  paradaPie: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  paradaCodigo: { color: M.grisClaro, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  emptyText: { color: M.gris, fontSize: 13, textAlign: "center", paddingTop: 40, paddingHorizontal: 20 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
});
