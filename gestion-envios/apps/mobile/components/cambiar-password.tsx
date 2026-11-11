import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { isAxiosError } from "axios";

import { AppInput, PrimaryButton } from "@/components/ui/movii-ui";
import { M, SOMBRA } from "@/constants/movii-design";
import { cambiarPassword } from "@/lib/api-client";
import { haptic } from "@/lib/haptics";

const REGLAS = [
  { texto: "8 caracteres o más", ok: (p: string) => p.length >= 8 },
  { texto: "Una mayúscula", ok: (p: string) => /\p{Lu}/u.test(p) },
  { texto: "Un número", ok: (p: string) => /\d/.test(p) },
];

/** Cambiar la propia contraseña desde el perfil: la actual, la nueva y repetirla. */
export function CambiarPassword() {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const cumple = REGLAS.every((r) => r.ok(nueva));
  const coinciden = nueva.length > 0 && nueva === repetida;
  const puede = actual.length > 0 && cumple && coinciden && !enviando;

  const guardar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await cambiarPassword(actual, nueva);
      haptic.success();
      setListo(true);
      setActual("");
      setNueva("");
      setRepetida("");
      setAbierto(false);
    } catch (err) {
      haptic.error();
      const msg = isAxiosError(err) ? (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message : undefined;
      setError(msg ?? "No se pudo cambiar la contraseña. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.tarjeta}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        onPress={() => {
          haptic.selection();
          setAbierto((a) => !a);
          setListo(false);
        }}
        style={({ pressed }) => [styles.cabeza, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.icono}><Text style={styles.iconoTexto}>✱</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Cambiar contraseña</Text>
          <Text style={styles.sub}>{listo ? "Listo: ya podés entrar con la nueva." : "Necesitás la contraseña actual."}</Text>
        </View>
        <Text style={[styles.chevron, abierto && { transform: [{ rotate: "90deg" }] }]}>›</Text>
      </Pressable>

      {abierto ? (
        <View style={styles.form}>
          <AppInput label="Contraseña actual" value={actual} onChangeText={setActual} placeholder="••••••••" secureTextEntry />
          <AppInput label="Contraseña nueva" value={nueva} onChangeText={setNueva} placeholder="••••••••" secureTextEntry />
          <View style={styles.reglas}>
            {REGLAS.map((r) => {
              const ok = r.ok(nueva);
              return (
                <View key={r.texto} style={[styles.regla, ok && styles.reglaOk]}>
                  <Text style={[styles.reglaTexto, ok && styles.reglaTextoOk]}>{ok ? "✓ " : ""}{r.texto}</Text>
                </View>
              );
            })}
          </View>
          <AppInput label="Repetí la contraseña nueva" value={repetida} onChangeText={setRepetida} placeholder="••••••••" secureTextEntry />
          {repetida.length > 0 && !coinciden ? <Text style={styles.error}>Las contraseñas no coinciden.</Text> : null}
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <PrimaryButton label={enviando ? "Guardando…" : "Guardar contraseña"} icon="✓" onPress={guardar} disabled={!puede} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16, gap: 14, borderWidth: 1, borderColor: M.hormigon200, ...SOMBRA.panel },
  cabeza: { flexDirection: "row", alignItems: "center", gap: 12 },
  icono: { width: 40, height: 40, borderRadius: 13, backgroundColor: M.asfalto, alignItems: "center", justifyContent: "center" },
  iconoTexto: { color: M.amarillo, fontSize: 18, fontWeight: "900" },
  titulo: { color: M.texto, fontSize: 15, fontWeight: "900" },
  sub: { color: M.gris, fontSize: 12, fontWeight: "600", marginTop: 2 },
  chevron: { color: M.gris, fontSize: 26, fontWeight: "300" },
  form: { gap: 12 },
  reglas: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: -4 },
  regla: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: M.hormigon100 },
  reglaOk: { backgroundColor: "#DCFCE7" },
  reglaTexto: { color: M.gris, fontSize: 11, fontWeight: "800" },
  reglaTextoOk: { color: "#166534" },
  error: { color: "#B42318", fontSize: 12.5, fontWeight: "700" },
});
