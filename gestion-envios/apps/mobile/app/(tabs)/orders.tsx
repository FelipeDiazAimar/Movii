import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/aurora-background";
import { CajaEnvio } from "@/components/caja-envio";
import { Aparecer, NumeroAnimado, Presionable } from "@/components/ui/efectos";
import { StatusBadge } from "@/components/ui/status-badge";
import { M, SOMBRA } from "@/constants/movii-design";
import { obtenerPedidos, type PedidoAPI, type PedidosAPI, type PeriodoPedidos } from "@/lib/api-client";
import { haptic } from "@/lib/haptics";
import { CODIGO_COMPLETO, colorCinta, estadoVisual, etiquetaRelativa, fechaCorta } from "@/lib/pedidos";
import { mensajeDeError } from "@/lib/seguimiento";

const PERIODOS: { key: PeriodoPedidos; label: string; icono: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: "viejos", label: "Anteriores", icono: "history" },
  { key: "hoy", label: "Hoy", icono: "today" },
  { key: "proximos", label: "Próximos", icono: "event" },
];

const VACIO: Record<PeriodoPedidos, { titulo: string; copy: string }> = {
  viejos: { titulo: "Sin pedidos anteriores", copy: "Acá vas a ver todo lo que repartiste en días pasados." },
  hoy: { titulo: "Nada para hoy", copy: "No tenés pedidos con entrega hoy." },
  proximos: { titulo: "Sin pedidos próximos", copy: "Cuando te asignen entregas futuras, aparecen acá." },
};

export default function PedidosScreen() {
  const insets = useSafeAreaInsets();
  const [periodo, setPeriodo] = useState<PeriodoPedidos>("hoy");
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [datos, setDatos] = useState<PedidosAPI | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pedido = useRef(0);

  // Espera 350 ms después de la última tecla antes de consultar.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto]);

  const cargar = useCallback(async () => {
    const n = ++pedido.current;
    setCargando(true);
    try {
      // Buscando se mira en todos los períodos; sin búsqueda, el período elegido.
      const r = await obtenerPedidos(busqueda ? ("" as PeriodoPedidos) : periodo, busqueda);
      if (n === pedido.current) { setDatos(r); setError(null); }
    } catch (e) {
      if (n === pedido.current) setError(mensajeDeError(e, "No se pudieron cargar tus pedidos."));
    } finally {
      if (n === pedido.current) setCargando(false);
    }
  }, [periodo, busqueda]);

  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  const abrir = (codigo: string) => {
    haptic.selection();
    router.push({ pathname: "/pedido/[codigo]", params: { codigo } } as never); // rutas tipadas se regeneran al correr expo
  };
  const buscando = busqueda.length > 0;
  const hoy = datos?.hoy ?? "";
  const conteo = datos?.conteo ?? { viejos: 0, hoy: 0, proximos: 0 };

  return (
    <View style={styles.page}>
      <AuroraBackground barra="light" style={StyleSheet.absoluteFill} />
      <FlatList
        data={datos?.pedidos ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshing={cargando && Boolean(datos)}
        onRefresh={() => void cargar()}
        ListHeaderComponent={
          <View>
            <View style={[styles.hero, { paddingTop: insets.top + 18 }]}>
              <View style={styles.glow} pointerEvents="none" />
              <View style={styles.cajaHero} pointerEvents="none"><CajaEnvio ancho={150} fragil urgente /></View>
              <View style={styles.eyebrowFila}><View style={styles.barra} /><Text style={styles.eyebrow}>TODOS TUS ENVÍOS</Text></View>
              <Text style={styles.title}>Mis pedidos</Text>
              <Text style={styles.subtitle}>Anteriores, de hoy y próximos.</Text>
              <View style={styles.buscador}>
                <MaterialIcons name="search" size={22} color={M.asfalto} />
                <TextInput
                  value={texto}
                  onChangeText={setTexto}
                  placeholder="Buscar por código: MOV-20261111-0002"
                  placeholderTextColor="#8A8A90"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel="Buscar pedido por código"
                  onSubmitEditing={() => { if (CODIGO_COMPLETO.test(texto.trim())) abrir(texto.trim().toUpperCase()); }}
                  style={styles.input}
                />
                {texto ? (
                  <Pressable onPress={() => { setTexto(""); setBusqueda(""); }} accessibilityLabel="Borrar búsqueda" hitSlop={10}>
                    <MaterialIcons name="close" size={20} color={M.gris} />
                  </Pressable>
                ) : null}
              </View>
              {CODIGO_COMPLETO.test(texto.trim()) ? (
                <Presionable onPress={() => abrir(texto.trim().toUpperCase())} style={styles.verTodo}>
                  <MaterialIcons name="inventory-2" size={18} color={M.asfalto} />
                  <Text style={styles.verTodoTexto}>Ver todos los datos de {texto.trim().toUpperCase()}</Text>
                  <MaterialIcons name="chevron-right" size={20} color={M.asfalto} />
                </Presionable>
              ) : null}
            </View>
            {buscando ? (
              <Text style={styles.resultados}>{cargando ? "Buscando…" : `${datos?.pedidos.length ?? 0} resultado(s) para “${busqueda}”`}</Text>
            ) : (
              <View style={styles.segmento}>
                {PERIODOS.map((p) => {
                  const activo = periodo === p.key;
                  return (
                    <Pressable
                      key={p.key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: activo }}
                      onPress={() => { haptic.selection(); setPeriodo(p.key); }}
                      style={[styles.segItem, activo && styles.segActivo]}
                    >
                      <MaterialIcons name={p.icono} size={18} color={activo ? M.amarillo : M.gris} />
                      <Text style={[styles.segTexto, activo && styles.segTextoActivo]}>{p.label}</Text>
                      <NumeroAnimado valor={conteo[p.key]} style={[styles.segNumero, activo && styles.segNumeroActivo]} duracion={500} />
                    </Pressable>
                  );
                })}
              </View>
            )}
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          </View>
        }
        renderItem={({ item, index }) => <TarjetaPedido pedido={item} hoy={hoy} indice={index} onPress={() => abrir(item.codigo_guia)} />}
        ListEmptyComponent={
          cargando ? (
            <View style={styles.empty}><ActivityIndicator color={M.amarilloOscuro} /></View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyCaja}><CajaEnvio ancho={110} cinta="#C9CED5" /></View>
              <Text style={styles.emptyTitle}>{buscando ? "No encontramos ese pedido" : VACIO[periodo].titulo}</Text>
              <Text style={styles.emptyCopy}>{buscando ? "Revisá el código. Solo aparecen los pedidos de tus rutas." : VACIO[periodo].copy}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

function TarjetaPedido({ pedido, hoy, indice, onPress }: { pedido: PedidoAPI; hoy: string; indice: number; onPress: () => void }) {
  const d = pedido.destinatario;
  const rel = etiquetaRelativa(pedido.fecha_entrega, hoy);
  return (
    <Aparecer indice={indice} style={styles.itemWrap}>
      <Presionable onPress={onPress} escala={0.975} style={styles.item} accessibilityRole="button" accessibilityLabel={`Pedido ${pedido.codigo_guia} para ${d.nombre}`}>
        <View style={[styles.lateral, { backgroundColor: colorCinta(pedido.estado) }]} />
        <View style={styles.cajaWrap}>
          <CajaEnvio ancho={86} codigo={pedido.codigo_guia} fragil={pedido.fragil} urgente={pedido.urgente} cinta={colorCinta(pedido.estado)} />
        </View>
        <View style={styles.itemCuerpo}>
          <Text style={styles.itemCodigo}>{pedido.codigo_guia}</Text>
          <Text numberOfLines={1} style={styles.itemNombre}>{d.nombre}</Text>
          <Text numberOfLines={1} style={styles.itemDir}>{d.calle} {d.numero}{d.piso_depto ? `, ${d.piso_depto}` : ""} · {d.localidad}</Text>
          <View style={styles.itemFila}>
            <StatusBadge status={estadoVisual(pedido.estado)} />
            <View style={[styles.fecha, rel === "Hoy" && styles.fechaHoy]}>
              <MaterialIcons name="event" size={13} color={rel === "Hoy" ? M.asfalto : M.gris} />
              <Text style={[styles.fechaTexto, rel === "Hoy" && { color: M.asfalto }]}>{rel === "Hoy" || rel === "Mañana" || rel === "Ayer" ? rel : fechaCorta(pedido.fecha_entrega)}</Text>
            </View>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={M.grisClaro} />
      </Presionable>
    </Aparecer>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: M.hormigon100 },
  content: { paddingBottom: 130, maxWidth: 620, width: "100%", alignSelf: "center" },
  hero: { backgroundColor: M.asfalto, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, paddingHorizontal: 20, paddingBottom: 22, gap: 6, overflow: "hidden", ...SOMBRA.lift },
  glow: { position: "absolute", top: -90, right: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: M.amarillo, opacity: 0.16 },
  cajaHero: { position: "absolute", right: -14, top: 36, opacity: 0.95, transform: [{ rotate: "-6deg" }] },
  eyebrowFila: { flexDirection: "row", alignItems: "center", gap: 7 },
  barra: { width: 16, height: 4, borderRadius: 2, backgroundColor: M.amarillo },
  eyebrow: { color: M.amarillo, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.3 },
  title: { color: "#FFFFFF", fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -1.4 },
  subtitle: { color: "#9A9AA0", fontSize: 14 },
  buscador: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: M.amarillo, borderRadius: 18, paddingHorizontal: 14, minHeight: 52, marginTop: 14 },
  input: { flex: 1, color: M.asfalto, fontSize: 15, fontWeight: "800", paddingVertical: 12, outlineStyle: "none" } as never,
  verTodo: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: M.amarilloClaro, borderRadius: 14, paddingHorizontal: 12, minHeight: 44, marginTop: 8 },
  verTodoTexto: { flex: 1, color: M.asfalto, fontSize: 13, fontWeight: "900" },
  segmento: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4 },
  segItem: { flex: 1, minHeight: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 1, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: M.hormigon200 },
  segActivo: { backgroundColor: M.asfalto, borderColor: M.asfalto, ...SOMBRA.panel },
  segTexto: { color: M.gris, fontSize: 11.5, fontWeight: "800" },
  segTextoActivo: { color: "#FFFFFF" },
  segNumero: { color: M.texto, fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  segNumeroActivo: { color: M.amarillo },
  resultados: { color: M.gris, fontSize: 12.5, fontWeight: "800", paddingHorizontal: 22, paddingTop: 18 },
  error: { color: "#B42318", fontSize: 13, fontWeight: "700", textAlign: "center", padding: 16 },
  itemWrap: { paddingHorizontal: 16, marginTop: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, paddingLeft: 16, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: M.hormigon200, overflow: "hidden", ...SOMBRA.panel },
  lateral: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  cajaWrap: { width: 86, alignItems: "center", justifyContent: "center" },
  itemCuerpo: { flex: 1, gap: 2 },
  itemCodigo: { color: M.amarilloOscuro, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  itemNombre: { color: M.texto, fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  itemDir: { color: M.gris, fontSize: 12.5 },
  itemFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 6 },
  fecha: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, minHeight: 26, borderRadius: 999, backgroundColor: M.hormigon100 },
  fechaHoy: { backgroundColor: M.amarilloSuave },
  fechaTexto: { color: M.gris, fontSize: 11.5, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 44, gap: 8, paddingHorizontal: 30 },
  emptyCaja: { opacity: 0.9, marginBottom: 4 },
  emptyTitle: { color: M.texto, fontSize: 17, fontWeight: "900", textAlign: "center" },
  emptyCopy: { color: M.gris, fontSize: 13, textAlign: "center" },
});
