import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  // El header arranca debajo del notch / barra de estado (también en la PWA de iPhone).
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { height: 52 + insets.top, paddingTop: insets.top }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Text style={styles.backText}>‹</Text></Pressable>
      <View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}</View>
      <View style={styles.balance} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#1A1A1A" },
  backText: { color: "#F4B400", fontSize: 33, fontWeight: "300", lineHeight: 36, marginTop: -4 },
  copy: { maxWidth: "62%", alignItems: "center" },
  title: { color: "#1C1C1E", fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  subtitle: { color: "#6E6E73", fontSize: 11, marginTop: 2 },
  balance: { width: 40 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.96 }] },
});
