import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.root}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Text style={styles.backText}>‹</Text></Pressable>
      <View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}</View>
      <View style={styles.balance} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" },
  backText: { color: "#1C1C1E", fontSize: 33, fontWeight: "300", lineHeight: 36, marginTop: -4 },
  copy: { maxWidth: "62%", alignItems: "center" },
  title: { color: "#1C1C1E", fontSize: 15, fontWeight: "800" },
  subtitle: { color: "#6E6E73", fontSize: 11, marginTop: 2 },
  balance: { width: 40 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.96 }] },
});
