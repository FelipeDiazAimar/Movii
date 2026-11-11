import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { AppHeader } from "@/components/app-header";
import { AuroraBackground } from "@/components/aurora-background";
import { CajaEnvio } from "@/components/caja-envio";
import { ShipmentTimeline } from "@/components/timeline";
import { Aparecer, Presionable } from "@/components/ui/efectos";
import { GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { StatusBadge } from "@/components/ui/status-badge";
import { M, SOMBRA } from "@/constants/movii-design";
import { obtenerPedido, type PedidoDetalleAPI } from "@/lib/api-client";
import { urlGoogleMaps } from "@/lib/google-maps";
import { haptic } from "@/lib/haptics";
import { colorCinta, ETIQUETA_ESTADO, ETIQUETA_TAMANO, estadoVisual, etiquetaRelativa, fechaCorta } from "@/lib/pedidos";
import { formatearFecha, mensajeDeError } from "@/lib/seguimiento";
import { useMovii } from "@/lib/movii-context";
import type { TimelineEvent } from "@/types/logistics";

const MOTIVOS: Record<string, string> = {
  cliente_ausente: "Destinatario ausente",
  direccion_incorrecta: "Dirección incorrecta",
  rechazado: "Rechazado por el destinatario",
  zona_insegura: "Zona insegura",
  otro: "Otro motivo",
};
const FRANJAS: Record<string, string> = { manana: "Mañana", tarde: "Tarde", noche: "Noche" };

function Fila({ icono, etiqueta, valor, ultimo }: { icono: keyof typeof MaterialIcons.glyphMap; etiqueta: string; valor: ReactNode; ultimo?: boolean }) {
  return (
    <View style={[styles.fila, !ultimo && styles.filaBorde]}>
      <View style={styles.filaIcono}><MaterialIcons name={icono} size={18} color={M.amarilloOscuro} /></View>
      <View style={styles.filaCuerpo}>
        <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
        {typeof valor === "string" ? <Text style={styles.filaValor}>{valor}</Text> : valor}
      </View>
    </View>
  );
}

function Seccion({ titulo, icono, children, indice }: { titulo: string; icono: keyof typeof MaterialIcons.glyphMap; children: ReactNode; indice: number }) {
  return (
    <Aparecer indice={indice} style={styles.seccion}>
      <View style={styles.seccionTitulo}><MaterialIcons name={icono} size={16} color={M.gris} /><Text style={styles.seccionTexto}>{titulo}</Text></View>
      <GlassCard style={styles.card}>{children}</GlassCard>
    </Aparecer>
  );
}

/** Todos los datos de un pedido propio (viejo, de hoy o próximo), abierto por su código de guía. */
export default function PedidoScreen() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const { findShipment } = useMovii();
  const [p, setP] = useState<PedidoDetalleAPI | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    obtenerPedido(String(codigo ?? ""))
      .then((r) => { if (vivo) setP(r); })
      .catch((e) => { if (vivo) setError(mensajeDeError(e, "No se pudo cargar el pedido.")); });
    return () => { vivo = false; };
  }, [codigo]);

  if (error) {
    return (
      <View style={styles.page}>
        <AuroraBackground barra="light" style={StyleSheet.absoluteFill} />
        <AppHeader title="Pedido" subtitle={String(codigo ?? "")} />
        <View style={styles.centro}>
          <CajaEnvio ancho={120} cinta="#C9CED5" />
          <Text style={styles.errorTitulo}>No encontramos el pedido</Text>
          <Text style={styles.errorTexto}>{error}</Text>
        </View>
      </View>
    );
  }
  if (!p) {
    return (
      <View style={styles.page}>
        <AuroraBackground barra="light" style={StyleSheet.absoluteFill} />
        <AppHeader title="Pedido" subtitle={String(codigo ?? "")} />
        <View style={styles.centro}><ActivityIndicator color={M.amarilloOscuro} size="large" /></View>
      </View>
    );
  }

  const d = p.destinatario;
  const direccion = `${d.calle} ${d.numero}${d.piso_depto ? `, ${d.piso_depto}` : ""}`;
  const hoy = new Date();
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const eventos: TimelineEvent[] = [...p.historial].reverse().map((ev) => ({
    label: ev.estado_nuevo === "no_entregado" && ev.motivo ? `No entregado: ${MOTIVOS[ev.motivo] ?? ev.motivo}` : ETIQUETA_ESTADO[ev.estado_nuevo] ?? ev.estado_nuevo,
    detail: [ev.comentario, ev.actor_nombre ? `por ${ev.actor_nombre}` : ""].filter(Boolean).join(" · ") || "Registrado en el sistema",
    timestamp: formatearFecha(ev.fecha),
    completed: true,
  }));
  const cerrado = p.estado === "entregado" || p.estado === "no_entregado";
  const delDia = findShipment(p.id); // solo existe si es un envío de hoy: ahí se puede operar
  const llamar = () => { haptic.light(); void Linking.openURL(`tel:${d.telefono.replace(/[^\d+]/g, "")}`); };
  const comoLlegar = () => {
    const url = urlGoogleMaps({ paradas: [`${direccion}, ${d.localidad}`], modo: "proximo" });
    if (url) { haptic.medium(); void Linking.openURL(url); }
  };

  return (
    <View style={styles.page}>
      <AuroraBackground barra="light" style={StyleSheet.absoluteFill} />
      <AppHeader title="Detalle del pedido" subtitle={p.codigo_guia} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Aparecer indice={0}>
          <View style={styles.hero}>
            <View style={styles.glow} pointerEvents="none" />
            <View style={styles.heroCaja}><CajaEnvio ancho={210} codigo={p.codigo_guia} fragil={p.fragil} urgente={p.urgente} cinta={colorCinta(p.estado)} /></View>
            <Text style={styles.heroCodigo}>{p.codigo_guia}</Text>
            <Text style={styles.heroNombre}>{d.nombre}</Text>
            <View style={styles.heroFila}>
              <StatusBadge status={estadoVisual(p.estado)} />
              <View style={styles.chipFecha}>
                <MaterialIcons name="event" size={14} color={M.asfalto} />
                <Text style={styles.chipFechaTexto}>{etiquetaRelativa(p.fecha_entrega, hoyISO)} · {fechaCorta(p.fecha_entrega)}</Text>
              </View>
            </View>
            {p.fragil || p.urgente ? (
              <View style={styles.heroFila}>
                {p.fragil ? <View style={[styles.sello, { backgroundColor: "#7F1D1D" }]}><MaterialIcons name="warning" size={13} color="#FECACA" /><Text style={[styles.selloTexto, { color: "#FECACA" }]}>Frágil</Text></View> : null}
                {p.urgente ? <View style={[styles.sello, { backgroundColor: M.amarillo }]}><MaterialIcons name="bolt" size={13} color={M.asfalto} /><Text style={[styles.selloTexto, { color: M.asfalto }]}>Urgente</Text></View> : null}
              </View>
            ) : null}
          </View>
        </Aparecer>

        <View style={styles.acciones}>
          <View style={styles.accionMitad}><PrimaryButton label="Cómo llegar" icon="⌖" onPress={comoLlegar} /></View>
          {d.telefono ? <View style={styles.accionMitad}><PrimaryButton label="Llamar" tone="secondary" icon="✆" onPress={llamar} /></View> : null}
        </View>
        {delDia && !cerrado ? (
          <Presionable onPress={() => router.push({ pathname: "/stop/[id]", params: { id: p.id } })} style={styles.operar}>
            <MaterialIcons name="local-shipping" size={20} color={M.asfalto} />
            <Text style={styles.operarTexto}>Entregar o registrar incidencia</Text>
            <MaterialIcons name="chevron-right" size={22} color={M.asfalto} />
          </Presionable>
        ) : null}

        <Seccion titulo="DESTINATARIO" icono="person" indice={1}>
          <Fila icono="badge" etiqueta="Nombre" valor={d.nombre} />
          <Fila icono="place" etiqueta="Dirección" valor={direccion} />
          <Fila icono="location-city" etiqueta="Localidad" valor={`${d.localidad} · CP ${d.codigo_postal}`} />
          <Fila icono="phone" etiqueta="Teléfono" valor={d.telefono || "Sin teléfono"} ultimo />
        </Seccion>

        <Seccion titulo="PAQUETE" icono="inventory-2" indice={2}>
          <Fila icono="category" etiqueta="Contenido" valor={p.tipo_contenido || "Sin especificar"} />
          <Fila icono="scale" etiqueta="Peso" valor={`${p.peso} kg`} />
          <Fila icono="straighten" etiqueta="Tamaño" valor={ETIQUETA_TAMANO[p.tamano] ?? p.tamano} />
          <Fila icono="warning-amber" etiqueta="Manejo" valor={[p.fragil ? "Frágil" : "", p.urgente ? "Urgente" : ""].filter(Boolean).join(" · ") || "Normal"} ultimo />
        </Seccion>

        <Seccion titulo="ENTREGA" icono="local-shipping" indice={3}>
          <Fila icono="event" etiqueta="Fecha de entrega" valor={fechaCorta(p.fecha_entrega)} />
          <Fila icono="route" etiqueta="Ruta" valor={p.ruta_nombre || "Sin ruta"} />
          <Fila icono="person-pin" etiqueta="Repartidor" valor={p.repartidor_nombre || "Sin asignar"} />
          <Fila icono="flag" etiqueta="Estado" valor={ETIQUETA_ESTADO[p.estado]} />
          {p.reprogramado_para ? <Fila icono="update" etiqueta="Reprogramado para" valor={`${fechaCorta(p.reprogramado_para)}${p.franja ? ` · ${FRANJAS[p.franja] ?? p.franja}` : ""}`} /> : null}
          <Fila icono="schedule" etiqueta="Alta del envío" valor={formatearFecha(p.fecha_creacion)} ultimo />
        </Seccion>

        {p.remitente?.nombre ? (
          <Seccion titulo="REMITENTE" icono="storefront" indice={4}>
            <Fila icono="business" etiqueta="Nombre" valor={p.remitente.nombre} />
            <Fila icono="phone" etiqueta="Teléfono" valor={p.remitente.telefono || "—"} />
            <Fila icono="place" etiqueta="Dirección" valor={p.remitente.direccion || "—"} ultimo />
          </Seccion>
        ) : null}

        {p.confirmacion ? (
          <Seccion titulo="CONFIRMACIÓN DE ENTREGA" icono="verified" indice={5}>
            <Fila icono="how-to-reg" etiqueta="Recibió" valor={`${p.confirmacion.receptor_nombre} (${p.confirmacion.receptor_relacion})`} />
            <Fila icono="schedule" etiqueta="Confirmada" valor={formatearFecha(p.confirmacion.confirmada_at)} ultimo />
          </Seccion>
        ) : null}

        <Seccion titulo="HISTORIAL" icono="history" indice={6}>
          <ShipmentTimeline events={eventos} />
        </Seccion>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: M.hormigon100 },
  content: { padding: 16, paddingBottom: 50, gap: 14, maxWidth: 760, width: "100%", alignSelf: "center" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 30 },
  errorTitulo: { color: M.texto, fontSize: 18, fontWeight: "900" },
  errorTexto: { color: M.gris, fontSize: 13.5, textAlign: "center" },
  hero: { backgroundColor: M.asfalto, borderRadius: 30, alignItems: "center", paddingTop: 18, paddingBottom: 20, paddingHorizontal: 18, gap: 8, overflow: "hidden", ...SOMBRA.lift },
  glow: { position: "absolute", top: -60, alignSelf: "center", width: 320, height: 320, borderRadius: 160, backgroundColor: M.amarillo, opacity: 0.14 },
  heroCaja: { marginBottom: -4 },
  heroCodigo: { color: M.amarillo, fontSize: 12, fontWeight: "900", letterSpacing: 1.4 },
  heroNombre: { color: "#FFFFFF", fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -0.8, textAlign: "center" },
  heroFila: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  chipFecha: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: M.amarillo, paddingHorizontal: 11, minHeight: 28, borderRadius: 999 },
  chipFechaTexto: { color: M.asfalto, fontSize: 12, fontWeight: "900" },
  sello: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, minHeight: 26, borderRadius: 999 },
  selloTexto: { fontSize: 11.5, fontWeight: "900" },
  acciones: { flexDirection: "row", gap: 10 },
  accionMitad: { flex: 1 },
  operar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: M.amarilloSuave, borderWidth: 1, borderColor: M.amarillo, borderRadius: 16, paddingHorizontal: 14, minHeight: 50 },
  operarTexto: { flex: 1, color: M.asfalto, fontSize: 14, fontWeight: "900" },
  seccion: { gap: 8 },
  seccionTitulo: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4, marginTop: 4 },
  seccionTexto: { color: M.gris, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  card: { paddingVertical: 4 },
  fila: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  filaBorde: { borderBottomWidth: 1, borderBottomColor: "#EFEFF2" },
  filaIcono: { width: 34, height: 34, borderRadius: 11, backgroundColor: M.amarilloSuave, alignItems: "center", justifyContent: "center" },
  filaCuerpo: { flex: 1 },
  filaEtiqueta: { color: M.gris, fontSize: 11, fontWeight: "700" },
  filaValor: { color: M.texto, fontSize: 14.5, fontWeight: "800", marginTop: 2 },
});
