import { Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";

import { M, SOMBRA } from "@/constants/movii-design";
import { haptic } from "@/lib/haptics";
import { Brillo, Presionable } from "@/components/ui/efectos";

type ButtonTone = "primary" | "secondary" | "danger" | "ghost";

/** Tarjeta de panel: superficie blanca, borde de hormigón y sombra suave. (Antes "GlassCard".) */
export function GlassCard({ children, style, className, oscura = false }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; className?: string; oscura?: boolean }) {
  return <View className={className} style={[styles.card, oscura && styles.cardOscura, style]}>{children}</View>;
}

export function PrimaryButton({ label, onPress, tone = "primary", disabled, icon, accessibilityLabel }: { label: string; onPress: () => void; tone?: ButtonTone; disabled?: boolean; icon?: string; accessibilityLabel?: string }) {
  const toneStyle = tone === "primary" ? styles.primary : tone === "danger" ? styles.danger : tone === "secondary" ? styles.secondary : styles.ghost;
  const textStyle = tone === "danger" ? styles.textoClaro : styles.textoOscuro;
  return (
    <Presionable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={() => { haptic.light(); onPress(); }}
      style={[styles.button, toneStyle, tone === "primary" && SOMBRA.panel, disabled && styles.disabled]}
    >
      {tone === "primary" && !disabled ? <Brillo radio={16} /> : null}
      {icon ? <Text style={[styles.buttonIcon, textStyle]}>{icon}</Text> : null}
      <Text style={[styles.buttonText, textStyle]}>{label}</Text>
    </Presionable>
  );
}

export function IconAction({ label, icon, onPress, accessibilityLabel }: { label: string; icon: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={() => { haptic.light(); onPress(); }} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
      <View style={styles.iconActionBubble}><Text style={styles.iconActionSymbol}>{icon}</Text></View>
      <Text style={styles.iconActionText}>{label}</Text>
    </Pressable>
  );
}

export function SectionHeading({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingText}>
        {eyebrow ? <View style={styles.eyebrowRow}><View style={styles.eyebrowBar} /><Text style={styles.eyebrow}>{eyebrow}</Text></View> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action && onAction ? <Pressable onPress={onAction} style={({ pressed }) => [styles.headingActionBox, pressed && styles.textPressed]}><Text style={styles.headingAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function AppMark({ inverted = false, compact = false, size = "default" }: { inverted?: boolean; compact?: boolean; size?: "default" | "hero" }) {
  return (
    <View style={[styles.markWrap, size === "hero" && styles.markWrapHero]}>
      <View style={[styles.markDot, size === "hero" && styles.markDotHero]}><Text style={[styles.markArrow, size === "hero" && styles.markArrowHero]}>›</Text></View>
      {!compact ? <Text style={[styles.markText, size === "hero" && styles.markTextHero, inverted && styles.markTextInverted]}>movii</Text> : null}
    </View>
  );
}

export function AppInput({ label, value, onChangeText, placeholder, autoCapitalize = "none", keyboardType = "default", secureTextEntry = false, textContentType, autoComplete }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; autoCapitalize?: "none" | "sentences" | "words" | "characters"; keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "number-pad"; secureTextEntry?: boolean; textContentType?: "oneTimeCode" | "telephoneNumber"; autoComplete?: "sms-otp" | "tel" | "one-time-code" }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={M.grisClaro}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        autoComplete={autoComplete}
        returnKeyType="done"
        style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as object)]}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: M.hormigon200, borderRadius: 24, padding: 16, ...SOMBRA.panel },
  cardOscura: { backgroundColor: M.asfalto, borderColor: M.asfalto4 },
  button: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, paddingHorizontal: 20, overflow: "hidden" },
  primary: { backgroundColor: M.amarillo },
  secondary: { backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: M.hormigon300 },
  danger: { backgroundColor: M.rojo },
  ghost: { backgroundColor: "transparent" },
  buttonText: { fontSize: 15.5, fontWeight: "900", letterSpacing: -0.2 },
  textoOscuro: { color: M.asfalto },
  textoClaro: { color: "#FFFFFF" },
  buttonIcon: { fontSize: 18, fontWeight: "900" },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  iconAction: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 38 },
  iconActionBubble: { width: 30, height: 30, borderRadius: 10, backgroundColor: M.asfalto, alignItems: "center", justifyContent: "center" },
  iconActionSymbol: { fontSize: 16, color: M.amarillo, fontWeight: "800" },
  iconActionText: { color: M.texto, fontSize: 14, fontWeight: "800" },
  headingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16 },
  headingText: { flex: 1 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 },
  eyebrowBar: { width: 16, height: 4, borderRadius: 2, backgroundColor: M.amarillo },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase", color: M.gris },
  sectionTitle: { fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -0.9, color: M.texto },
  headingActionBox: { backgroundColor: M.asfalto, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  headingAction: { color: M.amarillo, fontSize: 12.5, fontWeight: "900" },
  textPressed: { opacity: 0.6 },
  markWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  markWrapHero: { gap: 11 },
  markDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: M.amarillo, alignItems: "center", justifyContent: "center" },
  markDotHero: { width: 44, height: 44, borderRadius: 22 },
  markArrow: { color: M.asfalto, fontSize: 29, fontWeight: "300", lineHeight: 29, marginTop: -3 },
  markArrowHero: { fontSize: 42, lineHeight: 42, marginTop: -4 },
  markText: { color: M.asfalto, fontSize: 24, fontWeight: "900", letterSpacing: -1.2 },
  markTextHero: { fontSize: 36, letterSpacing: -1.8 },
  markTextInverted: { color: "#FFFFFF" },
  inputGroup: { gap: 7 },
  inputLabel: { color: M.texto, fontSize: 12.5, fontWeight: "800", letterSpacing: 0.2 },
  input: { minHeight: 52, backgroundColor: M.hormigon50, borderRadius: 14, borderWidth: 1.5, borderColor: M.hormigon200, paddingHorizontal: 15, fontSize: 16, fontWeight: "600", color: M.texto },
});
