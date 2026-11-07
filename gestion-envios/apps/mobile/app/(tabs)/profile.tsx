import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/aurora-background";
import { Aparecer, Carril, NumeroAnimado, PuntoVivo } from "@/components/ui/efectos";
import { PrimaryButton } from "@/components/ui/movii-ui";
import { M, SOMBRA } from "@/constants/movii-design";
import { contadoresDelDia } from "@/lib/envios-del-dia";
import { useMovii } from "@/lib/movii-context";

export default function ProfileScreen() {
  // Margen superior real (notch / barra de estado), también en la PWA instalada.
  const insets = useSafeAreaInsets();
  const { driverName, rutasDelDia, resumenDelDia, logout } = useMovii();
  const partes = driverName.trim().split(/\s+/).filter(Boolean);
  const nombreCompleto = partes.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  const iniciales = partes.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
  const { total, entregados, noEntregados, pendientes } = contadoresDelDia(resumenDelDia);
  const cerrados = entregados + noEntregados;
  const efectividad = cerrados > 0 ? Math.round((entregados / cerrados) * 100) : 0;
  const rutaTexto = rutasDelDia.length === 0 ? "Sin ruta hoy" : rutasDelDia.length === 1 ? rutasDelDia[0].rutaNombre : `${rutasDelDia.length} rutas hoy`;
  return (
    <View style={styles.page}>
      <AuroraBackground barra="light" style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 18 }]}>
          <View style={styles.glow} pointerEvents="none" />
          <View style={styles.eyebrowFila}><View style={styles.barra} /><Text style={styles.eyebrow}>TU CUENTA</Text></View>
          <View style={styles.perfil}>
            <View style={styles.avatar}><Text style={styles.avatarTexto}>{iniciales}</Text></View>
            <View style={styles.perfilTexto}>
              <Text numberOfLines={1} style={styles.nombre}>{nombreCompleto}</Text>
              <Text numberOfLines={1} style={styles.detalle}>Repartidor · {rutaTexto}</Text>
              <View style={styles.estado}><PuntoVivo color="#4ADE80" tam={7} /><Text style={styles.estadoTexto}>{pendientes} pendientes de {total}</Text></View>
            </View>
          </View>
          <Carril color={M.amarillo} alto={3} opacidad={0.5} />
        </View>

        <View style={styles.cuerpo}>
          <Text style={styles.seccion}>Rendimiento de hoy</Text>
          <View style={styles.metricas}>
            <Aparecer indice={0} style={styles.metrica}>
              <View style={styles.metricaTarjeta}>
                <NumeroAnimado valor={entregados} style={styles.metricaNumero} />
                <Text style={styles.metricaEtiqueta}>entregas</Text>
              </View>
            </Aparecer>
            <Aparecer indice={1} style={styles.metrica}>
              <View style={[styles.metricaTarjeta, styles.metricaMarca]}>
                <NumeroAnimado valor={efectividad} sufijo="%" style={styles.metricaNumero} />
                <Text style={[styles.metricaEtiqueta, { color: M.asfalto3 }]}>efectividad</Text>
              </View>
            </Aparecer>
          </View>
          <Aparecer indice={2}>
            <PrimaryButton label="Cerrar sesión" tone="secondary" onPress={() => { logout(); router.replace("/login"); }} />
          </Aparecer>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: M.hormigon100 },
  content: { paddingBottom: 130, maxWidth: 620, width: "100%", alignSelf: "center" },
  hero: { backgroundColor: M.asfalto, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, paddingHorizontal: 20, paddingBottom: 22, gap: 16, overflow: "hidden", ...SOMBRA.lift },
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
  estado: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
  estadoTexto: { color: "#4ADE80", fontSize: 12, fontWeight: "800" },
  cuerpo: { paddingHorizontal: 16, paddingTop: 24, gap: 14 },
  seccion: { color: M.gris, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1, paddingHorizontal: 4 },
  metricas: { flexDirection: "row", gap: 12 },
  metrica: { flex: 1 },
  metricaTarjeta: { alignItems: "center", gap: 2, paddingVertical: 24, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: M.hormigon200, ...SOMBRA.panel },
  metricaMarca: { backgroundColor: M.amarillo, borderColor: M.amarillo },
  metricaNumero: { color: M.asfalto, fontSize: 38, lineHeight: 42, fontWeight: "900", letterSpacing: -1.8 },
  metricaEtiqueta: { color: M.gris, fontSize: 12, fontWeight: "800" },
});
