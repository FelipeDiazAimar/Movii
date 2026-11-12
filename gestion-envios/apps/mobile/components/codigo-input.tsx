import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { M } from "@/constants/movii-design";
import { haptic } from "@/lib/haptics";

type Props = {
  value: string;
  onChange: (valor: string) => void;
  /** Cantidad de dígitos (6 por defecto). */
  largo?: number;
  /** Texto del error: sacude las celdas y las pinta de rojo hasta que se vuelve a escribir. */
  error?: string | null;
  /** true cuando el código fue aceptado: las celdas se vuelven verdes. */
  ok?: boolean;
  disabled?: boolean;
  label?: string;
};

const soloDigitos = (s: string, largo: number) => s.replace(/\D/g, "").slice(0, largo);

/**
 * Entrada de código de verificación, igual a la del panel web: una celda por cifra,
 * celda activa resaltada, contador, "Pegar código" (en la versión web) y sacudida en error.
 * Debajo hay un TextInput real y transparente que recibe el teclado, el pegado y el
 * autocompletado del SMS (one-time-code).
 */
export function CodigoInput({ value, onChange, largo = 6, error, ok, disabled, label = "Código de verificación" }: Props) {
  const ref = useRef<TextInput>(null);
  const [foco, setFoco] = useState(false);
  const [pegado, setPegado] = useState(false);
  const [pegadoFallo, setPegadoFallo] = useState(false);
  // Al volver a escribir, las celdas dejan de verse en rojo (el mensaje lo maneja la pantalla).
  const [descartado, setDescartado] = useState<string | null>(null);
  const errorActivo = error && error !== descartado ? error : null;
  const [sacudida] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!errorActivo) return;
    sacudida.setValue(0);
    Animated.sequence([
      Animated.timing(sacudida, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(sacudida, { toValue: -1, duration: 90, useNativeDriver: true }),
      Animated.timing(sacudida, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(sacudida, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [errorActivo, sacudida]);

  const cambiar = (texto: string) => {
    if (error) setDescartado(error);
    onChange(soloDigitos(texto, largo));
  };

  const pegar = async () => {
    ref.current?.focus();
    try {
      const texto = soloDigitos(await navigator.clipboard.readText(), largo);
      if (!texto) throw new Error("vacío");
      onChange(texto);
      haptic.success();
      setPegadoFallo(false);
      setPegado(true);
      setTimeout(() => setPegado(false), 1400);
    } catch {
      setPegadoFallo(true);
      setTimeout(() => setPegadoFallo(false), 2600);
    }
  };

  const activa = foco ? Math.min(value.length, largo - 1) : -1;
  const puedePegar = Platform.OS === "web" && typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

  return (
    <View style={styles.grupo}>
      <Text style={styles.label}>{label}</Text>

      <View>
        <Animated.View
          style={[styles.celdas, { transform: [{ translateX: sacudida.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) }] }]}
          accessibilityLabel="Dígitos del código"
        >
          {Array.from({ length: largo }, (_, i) => {
            const digito = value[i];
            const esActiva = i === activa;
            const lleno = digito !== undefined;
            const estilo = errorActivo
              ? styles.celdaError
              : ok
                ? styles.celdaOk
                : esActiva
                  ? styles.celdaActiva
                  : lleno
                    ? styles.celdaLlena
                    : null;
            const colorTexto = errorActivo ? M.rojo : ok ? "#15803D" : M.texto;
            return (
              <View key={i} style={[styles.celda, estilo, esActiva && styles.celdaElevada]}>
                {lleno ? <Text style={[styles.digito, { color: colorTexto }]}>{digito}</Text> : esActiva ? <View style={styles.cursor} /> : null}
                {ok ? (
                  <View style={styles.check}>
                    <Text style={styles.checkTexto}>✓</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Animated.View>

        <TextInput
          ref={ref}
          value={value}
          onChangeText={cambiar}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={largo}
          autoFocus
          editable={!disabled}
          caretHidden
          accessibilityLabel={label}
          style={[styles.entradaOculta, Platform.OS === "web" && ({ outlineStyle: "none", cursor: "text" } as object)]}
        />
      </View>

      <View style={styles.pie}>
        {puedePegar ? (
          <Pressable
            onPress={() => void pegar()}
            disabled={disabled}
            accessibilityRole="button"
            style={({ pressed }) => [styles.pegar, pegado && styles.pegarOk, pressed && { opacity: 0.7 }, disabled && { opacity: 0.5 }]}
          >
            <Text style={[styles.pegarTexto, pegado && { color: "#15803D" }]}>{pegado ? "✓ ¡Pegado!" : "Pegar código"}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Text style={[styles.contador, pegadoFallo && { color: M.naranja }]}>
          {pegadoFallo ? "No pude leer el portapapeles: pegalo manualmente" : `${value.length}/${largo}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: 8 },
  label: { color: "#3A3A3C", fontSize: 13.5, fontWeight: "700" },
  celdas: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  celda: { flex: 1, minWidth: 0, height: 58, borderRadius: 14, borderWidth: 2, borderColor: M.hormigon300, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  celdaLlena: { borderColor: "rgba(128,103,0,0.6)" },
  celdaActiva: { borderColor: M.amarillo, backgroundColor: M.amarilloSuave, shadowColor: M.amarillo, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 2 },
  celdaElevada: { transform: [{ translateY: -2 }] },
  celdaError: { borderColor: "#F87171", backgroundColor: "#FEF2F2" },
  celdaOk: { borderColor: "#34D399", backgroundColor: "#ECFDF5" },
  digito: { fontSize: 26, fontWeight: "900", fontVariant: ["tabular-nums"] },
  cursor: { width: 2, height: 24, borderRadius: 1, backgroundColor: M.amarilloOscuro },
  check: { position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" },
  checkTexto: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", marginTop: -1 },
  entradaOculta: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: "transparent" },
  pie: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 30 },
  pegar: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: M.hormigon300, backgroundColor: "#FFFFFF" },
  pegarOk: { borderColor: "#6EE7B7", backgroundColor: "#ECFDF5" },
  pegarTexto: { color: M.gris, fontSize: 12, fontWeight: "700" },
  contador: { color: M.grisClaro, fontSize: 12 },
});
