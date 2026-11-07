import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/aurora-background";
import { MiniCamion } from "@/components/mini-camion";
import { Aparecer, Carril, NumeroAnimado, PuntoVivo } from "@/components/ui/efectos";
import { PrimaryButton } from "@/components/ui/movii-ui";
import { M, SOMBRA } from "@/constants/movii-design";
import { obtenerPerfil, type PerfilRepartidorAPI } from "@/lib/api-client";
import { contadoresDelDia } from "@/lib/envios-del-dia";
import { useMovii } from "@/lib/movii-context";

const DIAS = ["do", "lu", "ma", "mi", "ju", "vi", "sá"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MOTIVOS: Record<string, string> = {
  cliente_ausente: "Cliente ausente",
  direccion_incorrecta: "Dirección incorrecta",
  rechazado: "Rechazado",
  zona_insegura: "Zona insegura",
  otro: "Otro motivo",
};
const TIPOS: Record<string, string> = { camion: "Camión", furgon: "Furgón", utilitario: "Utilitario", moto: "Moto" };

function hora(iso?: string) {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fechaLarga(ymd?: string) {
  const m = ymd ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd) : null;
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : "–";
}

function Seccion({ titulo, children, indice }: { titulo: string; children: ReactNode; indice: number }) {
  return (
    <Aparecer indice={indice} style={styles.seccion}>
      <View style={styles.seccionTitulo}>
        <View style={styles.barra} />
        <Text style={styles.seccionTexto}>{titulo}</Text>
      </View>
      {children}
    </Aparecer>
  );
}

function Metrica({ valor, sufijo, etiqueta, destacada }: { valor: number; sufijo?: string; etiqueta: string; destacada?: boolean }) {
  return (
    <View style={[styles.metrica, destacada && styles.metricaMarca]}>
      <NumeroAnimado valor={valor} sufijo={sufijo} style={styles.metricaNumero} />
      <Text style={[styles.metricaEtiqueta, destacada && { color: M.asfalto3 }]}>{etiqueta}</Text>
    </View>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <Text style={styles.filaValor} numberOfLines={1}>{valor}</Text>
    </View>
  );
}

/** Barras de la última semana: entregados (verde) arriba de los fallidos (rojo). */
function Semana({ dias }: { dias: PerfilRepartidorAPI["ultimos_dias"] }) {
  const max = Math.max(1, ...dias.map((d) => d.entregados + d.no_entregados));
  return (
    <View style={styles.semana}>
      {dias.map((d, i) => {
        const [y, m, dd] = d.fecha.split("-").map(Number);
        const dia = new Date(y, m - 1, dd).getDay();
        const hoy = i === dias.length - 1;
        const total = d.entregados + d.no_entregados;
        return (
          <View key={d.fecha} style={styles.semanaCol}>
            <Text style={styles.semanaValor}>{total || ""}</Text>
            <View style={styles.semanaPista}>
              <View style={{ height: `${(d.no_entregados / max) * 100}%`, backgroundColor: "#F87171", borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
              <View style={{ height: `${(d.entregados / max) * 100}%`, backgroundColor: hoy ? M.amarillo : "#4ADE80", borderRadius: d.no_entregados ? 0 : 6 }} />
            </View>
            <Text style={[styles.semanaDia, hoy && { color: M.texto, fontWeight: "900" }]}>{hoy ? "hoy" : DIAS[dia]}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function ProfileScreen() {
  // Margen superior real (notch / barra de estado), también en la PWA instalada.
  const insets = useSafeAreaInsets();
  const { driverName, rutasDelDia, resumenDelDia, logout } = useMovii();
  const [perfil, setPerfil] = useState<PerfilRepartidorAPI | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setPerfil(await obtenerPerfil());
      setError(null);
    } catch {
      setError("No se pudieron cargar tus estadísticas.");
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const nombre = perfil?.nombre || driverName;
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const nombreCompleto = partes.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  const iniciales = partes.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
  const { total, entregados, noEntregados, pendientes, progreso } = contadoresDelDia(resumenDelDia);
  const rutaTexto = rutasDelDia.length === 0 ? "Sin ruta hoy" : rutasDelDia.length === 1 ? rutasDelDia[0].rutaNombre : `${rutasDelDia.length} rutas hoy`;
  const h = perfil?.historico;
  const v = perfil?.vehiculo_hoy;
  const maxMotivo = Math.max(1, ...(perfil?.motivos_fallo ?? []).map((m) => m.cantidad));
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <View style={styles.page}>
      <AuroraBackground barra="light" style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}>
        {/* Encabezado */}
        <View style={[styles.hero, { paddingTop: insets.top + 18 }]}>
          <View style={styles.glow} pointerEvents="none" />
          <View style={styles.eyebrowFila}><View style={styles.barra} /><Text style={styles.eyebrow}>TU CUENTA</Text></View>
          <View style={styles.perfil}>
            <View style={styles.avatar}><Text style={styles.avatarTexto}>{iniciales}</Text></View>
            <View style={styles.perfilTexto}>
              <Text numberOfLines={1} style={styles.nombre}>{nombreCompleto}</Text>
              <Text numberOfLines={1} style={styles.detalle}>{perfil?.email ?? "Repartidor"}</Text>
              <View style={styles.chips}>
                <View style={styles.chip}><Text style={styles.chipTexto}>Repartidor</Text></View>
                {perfil?.con_google ? <View style={styles.chip}><Text style={styles.chipTexto}>Google</Text></View> : null}
                <View style={[styles.chip, styles.chipVivo]}><PuntoVivo color="#4ADE80" tam={6} /><Text style={[styles.chipTexto, { color: "#4ADE80" }]}>En servicio</Text></View>
              </View>
            </View>
          </View>

          {/* Hoy */}
          <View style={styles.hoy}>
            <View style={styles.hoyCabeza}>
              <Text style={styles.hoyTitulo} numberOfLines={1}>{rutaTexto}</Text>
              <NumeroAnimado valor={progreso} sufijo="%" style={styles.hoyPorcentaje} />
            </View>
            <View style={styles.hoyPista}><View style={[styles.hoyRelleno, { width: `${progreso}%` }]} /></View>
            <View style={styles.hoyDatos}>
              <View style={styles.hoyDato}><NumeroAnimado valor={entregados} style={[styles.hoyNumero, { color: "#4ADE80" }]} /><Text style={styles.hoyEtiqueta}>entregados</Text></View>
              <View style={styles.hoyDato}><NumeroAnimado valor={pendientes} style={[styles.hoyNumero, { color: M.amarillo }]} /><Text style={styles.hoyEtiqueta}>pendientes</Text></View>
              <View style={styles.hoyDato}><NumeroAnimado valor={noEntregados} style={[styles.hoyNumero, { color: "#F87171" }]} /><Text style={styles.hoyEtiqueta}>fallidos</Text></View>
              <View style={styles.hoyDato}><NumeroAnimado valor={total} style={styles.hoyNumero} /><Text style={styles.hoyEtiqueta}>total</Text></View>
            </View>
            <Text style={styles.hoyHorario}>Primera entrega {hora(perfil?.primera_entrega_hoy)} · Última {hora(perfil?.ultima_entrega_hoy)}</Text>
          </View>
          <Carril color={M.amarillo} alto={3} opacidad={0.5} />
        </View>

        <View style={styles.cuerpo}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {v ? (
            <Seccion titulo="Tu vehículo de hoy" indice={0}>
              <View style={styles.tarjeta}>
                <View style={styles.vehiculoCabeza}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vehiculoModelo}>{TIPOS[v.tipo] ?? "Vehículo"} {v.modelo}</Text>
                    <View style={styles.patente}><Text style={styles.patenteTexto}>{v.patente}</Text></View>
                  </View>
                  <MiniCamion ancho={118} color={/^#[0-9a-f]{6}$/i.test(v.color) ? v.color : M.amarillo} />
                </View>
                <View style={styles.cargaFila}>
                  <Text style={styles.filaEtiqueta}>Carga</Text>
                  <Text style={styles.filaValor}>{v.carga_actual_peso} de {v.capacidad_peso} kg</Text>
                </View>
                <View style={styles.cargaPista}><View style={[styles.cargaRelleno, { width: `${Math.min(100, v.capacidad_porcentaje)}%` }]} /></View>
                <View style={styles.vehiculoDatos}>
                  <View style={styles.vehiculoDato}><Text style={styles.vehiculoNumero}>{Math.round(v.capacidad_porcentaje)}%</Text><Text style={styles.metricaEtiqueta}>ocupado</Text></View>
                  <View style={styles.vehiculoDato}><Text style={styles.vehiculoNumero}>{Math.round(v.velocidad)}</Text><Text style={styles.metricaEtiqueta}>km/h</Text></View>
                  <View style={styles.vehiculoDato}><Text style={styles.vehiculoNumero}>{Math.round(v.temperatura)}°</Text><Text style={styles.metricaEtiqueta}>carga</Text></View>
                </View>
              </View>
            </Seccion>
          ) : null}

          {perfil ? (
            <Seccion titulo="Última semana" indice={1}>
              <View style={styles.tarjeta}>
                <Semana dias={perfil.ultimos_dias} />
                <View style={styles.leyenda}>
                  <View style={styles.leyendaItem}><View style={[styles.leyendaPunto, { backgroundColor: "#4ADE80" }]} /><Text style={styles.leyendaTexto}>Entregados</Text></View>
                  <View style={styles.leyendaItem}><View style={[styles.leyendaPunto, { backgroundColor: "#F87171" }]} /><Text style={styles.leyendaTexto}>No entregados</Text></View>
                </View>
              </View>
            </Seccion>
          ) : null}

          {h ? (
            <Seccion titulo="Tu historial" indice={2}>
              <View style={styles.metricas}>
                <Metrica valor={h.entregados} etiqueta="entregas" destacada />
                <Metrica valor={Math.round(h.efectividad)} sufijo="%" etiqueta="efectividad" />
                <Metrica valor={Math.round(h.kg_entregados)} sufijo=" kg" etiqueta="entregados" />
                <Metrica valor={h.rutas_completadas} etiqueta="rutas completas" />
                <Metrica valor={h.dias_trabajados} etiqueta="días en ruta" />
                <Metrica valor={h.mejor_dia} etiqueta="récord en un día" />
                <Metrica valor={Math.round(h.promedio_por_dia)} etiqueta="promedio diario" />
                <Metrica valor={h.fragiles_entregados} etiqueta="frágiles sanos" />
              </View>
            </Seccion>
          ) : null}

          {perfil && perfil.motivos_fallo.length > 0 ? (
            <Seccion titulo="Por qué no se entregó" indice={3}>
              <View style={styles.tarjeta}>
                {perfil.motivos_fallo.map((m) => (
                  <View key={m.motivo} style={styles.motivo}>
                    <View style={styles.motivoCabeza}>
                      <Text style={styles.filaValor}>{MOTIVOS[m.motivo] ?? m.motivo}</Text>
                      <Text style={styles.filaEtiqueta}>{m.cantidad}</Text>
                    </View>
                    <View style={styles.cargaPista}><View style={[styles.cargaRelleno, { width: `${(m.cantidad / maxMotivo) * 100}%`, backgroundColor: "#F87171" }]} /></View>
                  </View>
                ))}
              </View>
            </Seccion>
          ) : null}

          <Seccion titulo="Datos de la cuenta" indice={4}>
            <View style={[styles.tarjeta, { paddingVertical: 4 }]}>
              <Fila etiqueta="Email" valor={perfil?.email ?? "–"} />
              <View style={styles.divisor} />
              <Fila etiqueta="Celular" valor={perfil?.telefono || "Sin cargar"} />
              <View style={styles.divisor} />
              <Fila etiqueta="Ingreso" valor={perfil?.con_google ? "Contraseña y Google" : "Contraseña"} />
              <View style={styles.divisor} />
              <Fila etiqueta="En Movii desde" valor={fechaLarga(perfil?.miembro_desde)} />
              <View style={styles.divisor} />
              <Fila etiqueta="Versión de la app" valor={version} />
            </View>
          </Seccion>

          <Aparecer indice={5}>
            <PrimaryButton label="Cerrar sesión" tone="secondary" onPress={() => { logout(); router.replace("/login"); }} />
          </Aparecer>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: M.hormigon100 },
  content: { paddingBottom: 130, maxWidth: 760, width: "100%", alignSelf: "center" },
  hero: { backgroundColor: M.asfalto, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, paddingHorizontal: 20, paddingBottom: 20, gap: 16, overflow: "hidden", ...SOMBRA.lift },
  glow: { position: "absolute", top: -90, right: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: M.amarillo, opacity: 0.16 },
  eyebrowFila: { flexDirection: "row", alignItems: "center", gap: 7 },
  barra: { width: 16, height: 4, borderRadius: 2, backgroundColor: M.amarillo },
  eyebrow: { color: M.amarillo, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.3 },
  perfil: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: { width: 72, height: 72, borderRadius: 24, backgroundColor: M.amarillo, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-5deg" }] },
  avatarTexto: { color: M.asfalto, fontWeight: "900", fontSize: 26, letterSpacing: -1 },
  perfilTexto: { flex: 1, gap: 3 },
  nombre: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", letterSpacing: -0.8 },
  detalle: { color: "#9A9AA0", fontSize: 13, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
  chipVivo: { backgroundColor: "rgba(74,222,128,0.12)" },
  chipTexto: { color: "#E5E5EA", fontSize: 11, fontWeight: "800" },
  hoy: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 22, padding: 15, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  hoyCabeza: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  hoyTitulo: { flex: 1, color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  hoyPorcentaje: { color: M.amarillo, fontSize: 26, fontWeight: "900", letterSpacing: -1 },
  hoyPista: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  hoyRelleno: { height: "100%", borderRadius: 4, backgroundColor: M.amarillo },
  hoyDatos: { flexDirection: "row" },
  hoyDato: { flex: 1, alignItems: "center" },
  hoyNumero: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", letterSpacing: -0.6 },
  hoyEtiqueta: { color: "#9A9AA0", fontSize: 10, fontWeight: "700" },
  hoyHorario: { color: "#9A9AA0", fontSize: 11.5, fontWeight: "600", textAlign: "center" },
  cuerpo: { paddingHorizontal: 16, paddingTop: 22, gap: 18 },
  error: { color: "#B42318", fontSize: 13, fontWeight: "700", textAlign: "center" },
  seccion: { gap: 10 },
  seccionTitulo: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 4 },
  seccionTexto: { color: M.gris, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1 },
  tarjeta: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16, gap: 10, borderWidth: 1, borderColor: M.hormigon200, ...SOMBRA.panel },
  vehiculoCabeza: { flexDirection: "row", alignItems: "center", gap: 10 },
  vehiculoModelo: { color: M.texto, fontSize: 17, fontWeight: "900", letterSpacing: -0.4 },
  patente: { alignSelf: "flex-start", marginTop: 6, backgroundColor: M.asfalto, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  patenteTexto: { color: M.amarillo, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  cargaFila: { flexDirection: "row", justifyContent: "space-between" },
  cargaPista: { height: 8, borderRadius: 4, backgroundColor: M.hormigon100, overflow: "hidden" },
  cargaRelleno: { height: "100%", borderRadius: 4, backgroundColor: M.amarillo },
  vehiculoDatos: { flexDirection: "row", gap: 8 },
  vehiculoDato: { flex: 1, alignItems: "center", backgroundColor: M.hormigon50, borderRadius: 14, paddingVertical: 10 },
  vehiculoNumero: { color: M.texto, fontSize: 18, fontWeight: "900" },
  semana: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 150 },
  semanaCol: { flex: 1, alignItems: "center", gap: 6, height: "100%" },
  semanaValor: { color: M.gris, fontSize: 11, fontWeight: "800", height: 14 },
  semanaPista: { flex: 1, width: "100%", maxWidth: 30, justifyContent: "flex-end", backgroundColor: M.hormigon50, borderRadius: 6, overflow: "hidden" },
  semanaDia: { color: M.grisClaro, fontSize: 11, fontWeight: "800" },
  leyenda: { flexDirection: "row", gap: 16, justifyContent: "center" },
  leyendaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  leyendaPunto: { width: 8, height: 8, borderRadius: 4 },
  leyendaTexto: { color: M.gris, fontSize: 11, fontWeight: "700" },
  metricas: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metrica: { flexGrow: 1, flexBasis: "45%", alignItems: "center", gap: 2, paddingVertical: 18, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: M.hormigon200, ...SOMBRA.panel },
  metricaMarca: { backgroundColor: M.amarillo, borderColor: M.amarillo },
  metricaNumero: { color: M.asfalto, fontSize: 30, lineHeight: 34, fontWeight: "900", letterSpacing: -1.4 },
  metricaEtiqueta: { color: M.gris, fontSize: 11.5, fontWeight: "800" },
  motivo: { gap: 6 },
  motivoCabeza: { flexDirection: "row", justifyContent: "space-between" },
  fila: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  filaEtiqueta: { color: M.gris, fontSize: 12.5, fontWeight: "700" },
  filaValor: { flexShrink: 1, color: M.texto, fontSize: 13.5, fontWeight: "800", textAlign: "right" },
  divisor: { height: 1, backgroundColor: M.hormigon100 },
});
