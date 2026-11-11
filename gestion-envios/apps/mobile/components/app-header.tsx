import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Carril } from "@/components/ui/efectos";
import { M, SOMBRA } from "@/constants/movii-design";

/** Encabezado de las pantallas de detalle: panel de asfalto con volver, título y la calzada animada abajo. */
export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  // El header arranca debajo del notch / barra de estado (también en la PWA de iPhone).
  const insets = useSafeAreaInsets();
  // Si la pantalla se abrió directo (recarga o enlace) no hay historial al que volver: se va al inicio.
  const volver = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.glow} pointerEvents="none" />
      <View style={styles.fila}>
        <Pressable onPress={volver} accessibilityRole="button" accessibilityLabel="Volver" style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.balance} />
      </View>
      <View style={styles.carril}><Carril color={M.amarillo} alto={3} opacidad={0.55} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: M.asfalto, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingHorizontal: 16, paddingBottom: 16, gap: 14, overflow: "hidden", ...SOMBRA.lift },
  glow: { position: "absolute", top: -80, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: M.amarillo, opacity: 0.15 },
  fila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: M.amarillo },
  backText: { color: M.asfalto, fontSize: 31, fontWeight: "400", lineHeight: 34, marginTop: -4 },
  copy: { flex: 1, paddingHorizontal: 12, alignItems: "center" },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", letterSpacing: -0.4 },
  subtitle: { color: "#9A9AA0", fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  balance: { width: 42 },
  carril: { marginHorizontal: 4 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.95 }] },
});
