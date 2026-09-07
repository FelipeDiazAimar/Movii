import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { haptic } from "@/lib/haptics";

type ButtonTone = "primary" | "secondary" | "danger" | "ghost";

export function GlassCard({ children, style, className }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; className?: string }) {
  return <View className={className} style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ label, onPress, tone = "primary", disabled, icon, accessibilityLabel }: { label: string; onPress: () => void; tone?: ButtonTone; disabled?: boolean; icon?: string; accessibilityLabel?: string }) {
  const toneStyle = tone === "primary" ? styles.primary : tone === "danger" ? styles.danger : tone === "secondary" ? styles.secondary : styles.ghost;
  const textStyle = tone === "secondary" || tone === "ghost" ? styles.darkButtonText : styles.lightButtonText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={() => { haptic.light(); onPress(); }}
      style={({ pressed }) => [styles.button, toneStyle, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      {icon ? <Text style={[styles.buttonIcon, textStyle]}>{icon}</Text> : null}
      <Text style={[styles.buttonText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function IconAction({ label, icon, onPress, accessibilityLabel }: { label: string; icon: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={() => { haptic.light(); onPress(); }} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
      <Text style={styles.iconActionSymbol}>{icon}</Text>
      <Text style={styles.iconActionText}>{label}</Text>
    </Pressable>
  );
}

export function SectionHeading({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action && onAction ? <Pressable onPress={onAction} style={({ pressed }) => pressed && styles.textPressed}><Text style={styles.headingAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function AppMark({ inverted = false, compact = false, size = "default" }: { inverted?: boolean; compact?: boolean; size?: "default" | "hero" }) {
  return (
    <View style={[styles.markWrap, size === "hero" && styles.markWrapHero]}>
      <View style={[styles.markDot, size === "hero" && styles.markDotHero, inverted && styles.markDotInverted]}><Text style={[styles.markArrow, size === "hero" && styles.markArrowHero]}>›</Text></View>
      {!compact ? <Text style={[styles.markText, size === "hero" && styles.markTextHero, inverted && styles.markTextInverted]}>movii</Text> : null}
    </View>
  );
}

export function AppInput({ label, value, onChangeText, placeholder, autoCapitalize = "none", keyboardType = "default", secureTextEntry = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; autoCapitalize?: "none" | "sentences" | "words" | "characters"; keyboardType?: PressableProps["accessibilityRole"] extends never ? never : "default" | "email-address" | "numeric"; secureTextEntry?: boolean }) {
  const { TextInput } = require("react-native") as typeof import("react-native");
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#AEAEB2" autoCapitalize={autoCapitalize} keyboardType={keyboardType} secureTextEntry={secureTextEntry} returnKeyType="done" style={styles.input} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "rgba(255,255,255,0.76)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", borderRadius: 22, padding: 16, shadowColor: "#11111A", shadowOpacity: 0.08, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  button: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 18 },
  primary: { backgroundColor: "#FFD60A" },
  secondary: { backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "#E2E2E6" },
  danger: { backgroundColor: "#FF3B30" },
  ghost: { backgroundColor: "transparent" },
  buttonText: { fontSize: 15, fontWeight: "700", letterSpacing: -0.15 },
  lightButtonText: { color: "#1C1C1E" },
  darkButtonText: { color: "#1C1C1E" },
  buttonIcon: { fontSize: 18, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  iconAction: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 36 },
  iconActionSymbol: { fontSize: 17, color: "#1C1C1E" },
  iconActionText: { color: "#1C1C1E", fontSize: 13, fontWeight: "600" },
  headingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16 },
  headingText: { flex: 1 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: "#6E6E73", marginBottom: 3 },
  sectionTitle: { fontSize: 23, lineHeight: 28, fontWeight: "700", letterSpacing: -0.7, color: "#1C1C1E" },
  headingAction: { color: "#806700", fontSize: 14, fontWeight: "700", paddingBottom: 2 },
  textPressed: { opacity: 0.6 },
  markWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  markWrapHero: { gap: 10 },
  markDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFD60A", alignItems: "center", justifyContent: "center" },
  markDotHero: { width: 40, height: 40, borderRadius: 20 },
  markDotInverted: { backgroundColor: "#1C1C1E" },
  markArrow: { color: "#1C1C1E", fontSize: 29, fontWeight: "300", lineHeight: 29, marginTop: -3 },
  markArrowHero: { fontSize: 38, lineHeight: 38, marginTop: -4 },
  markText: { color: "#1C1C1E", fontSize: 24, fontWeight: "800", letterSpacing: -1.2 },
  markTextHero: { fontSize: 31, letterSpacing: -1.5 },
  markTextInverted: { color: "#FFFFFF" },
  inputGroup: { gap: 7 },
  inputLabel: { color: "#3A3A3C", fontSize: 13, fontWeight: "700" },
  input: { minHeight: 50, backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 14, borderWidth: 1, borderColor: "#E3E3E7", paddingHorizontal: 14, fontSize: 16, color: "#1C1C1E" },
});
