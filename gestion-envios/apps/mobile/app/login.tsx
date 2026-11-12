import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { isAxiosError } from "axios";

import { AuroraBackground } from "@/components/aurora-background";
import { AppInput, AppMark, GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { haptic } from "@/lib/haptics";
import { useMovii } from "@/lib/movii-context";
import { cambiarPasswordPrimerAcceso, obtenerConfigAuth, reenviarCodigoLogin, reenviarPrimerAcceso, type DesafioLogin, type PrimerAccesoPendiente } from "@/lib/api-client";
import { REGLAS } from "@/components/cambiar-password";
import { CodigoInput } from "@/components/codigo-input";
import { ErrorLoginGoogle } from "@/lib/login-google";

/** Mensaje de error de la API ({ error: { message } }) o un texto por defecto. */
function mensajeDeError(err: unknown, porDefecto: string): string {
  if (err instanceof ErrorLoginGoogle) return err.message;
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (msg) return msg;
  }
  return porDefecto;
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  // Segundo paso (HU-16): código de 6 dígitos que llega por WhatsApp.
  const [desafio, setDesafio] = useState<DesafioLogin | null>(null);
  const [codigo, setCodigo] = useState("");
  const [verificado, setVerificado] = useState(false);
  const [espera, setEspera] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  // Primer acceso (T1): el 428 del login pide elegir una contraseña nueva antes del código.
  const [pendiente, setPendiente] = useState<PrimerAccesoPendiente | null>(null);
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, verificarCodigo, verificarPrimerAcceso, loginConGoogle } = useMovii();
  // Botón de Google (T2) solo si la API lo tiene configurado; no en la PWA (web).
  const [conGoogle, setConGoogle] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    obtenerConfigAuth()
      .then((c) => setConGoogle(c.google))
      .catch(() => setConGoogle(false));
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const ejecutar = async (accion: () => Promise<void>, porDefecto: string) => {
    setError(null);
    setCargando(true);
    try {
      await accion();
    } catch (err) {
      haptic.error();
      setError(mensajeDeError(err, porDefecto));
    } finally {
      setCargando(false);
    }
  };

  const empezarDesafio = (d: DesafioLogin) => {
    setDesafio(d);
    setCodigo("");
    setEspera(60); // la API acepta un código por minuto
  };

  const ingresar = () =>
    ejecutar(async () => {
      const d = await login(email, password);
      if (d && "user_id" in d) {
        setPendiente(d);
        setNueva("");
        setRepetida("");
        return;
      }
      if (d) {
        haptic.success();
        empezarDesafio(d);
        return;
      }
      router.replace("/(tabs)");
    }, "No se pudo iniciar sesión. Verificá el email y la contraseña.");

  const entrarConGoogle = () =>
    ejecutar(async () => {
      const r = await loginConGoogle();
      if (r === null) return; // cerró el navegador
      if (r === true) {
        router.replace("/(tabs)");
        return;
      }
      if (r) empezarDesafio(r);
    }, "No se pudo iniciar sesión con Google.");

  const guardarPasswordNueva = () =>
    ejecutar(async () => {
      if (!pendiente) return;
      haptic.success();
      empezarDesafio(await cambiarPasswordPrimerAcceso(pendiente, nueva));
    }, "No se pudo guardar la contraseña. Volvé a iniciar sesión e intentá de nuevo.");

  const volverAlLogin = () => {
    setDesafio(null);
    setPendiente(null);
    setError(null);
    setAviso(null);
  };

  const confirmarCodigo = () =>
    ejecutar(async () => {
      if (!desafio) return;
      if (pendiente) await verificarPrimerAcceso(desafio.desafio_id, codigo, email);
      else await verificarCodigo(desafio.desafio_id, codigo, email);
      setVerificado(true);
      await new Promise((r) => setTimeout(r, 650)); // deja ver las celdas en verde
      router.replace("/(tabs)");
    }, "El código es incorrecto o venció.");

  const reenviar = () =>
    ejecutar(async () => {
      if (!desafio) return;
      empezarDesafio(await (pendiente ? reenviarPrimerAcceso : reenviarCodigoLogin)(desafio.desafio_id));
      setAviso("Te mandamos un código nuevo.");
    }, "No se pudo reenviar el código.");

  return (
    <AuroraBackground variante="oscuro">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.content}>
          <View style={styles.brandBlock}>
            <AppMark size="hero" inverted />
            <Text style={styles.kicker}>OPERACIÓN DE ÚLTIMA MILLA</Text>
            <Text style={styles.title}>Tu jornada, siempre en movimiento.</Text>
            <Text style={styles.subtitle}>Ingresá y continuá con la ruta asignada a tu perfil.</Text>
          </View>
          <GlassCard style={styles.card}>
            {!desafio && pendiente ? (
              <>
                <View style={styles.cardIntro}>
                  <Text style={styles.cardTitle}>Elegí tu contraseña</Text>
                  <Text style={styles.cardDescription}>Es tu primer ingreso: reemplazá la contraseña temporal por una propia.</Text>
                </View>
                <View style={styles.form}>
                  <AppInput label="Contraseña nueva" value={nueva} onChangeText={setNueva} placeholder="••••••••" secureTextEntry />
                  <AppInput label="Repetí la contraseña" value={repetida} onChangeText={setRepetida} placeholder="••••••••" secureTextEntry />
                </View>
                <View style={styles.reglas}>
                  {REGLAS.map((r) => (
                    <Text key={r.texto} style={[styles.regla, r.ok(nueva) && styles.reglaOk]}>
                      {r.ok(nueva) ? "✓" : "•"} {r.texto}
                    </Text>
                  ))}
                  <Text style={[styles.regla, nueva.length > 0 && nueva === repetida && styles.reglaOk]}>
                    {nueva.length > 0 && nueva === repetida ? "✓" : "•"} Las dos coinciden
                  </Text>
                </View>
                <PrimaryButton
                  label={cargando ? "Guardando…" : "Guardar y continuar"}
                  onPress={guardarPasswordNueva}
                  icon="→"
                  disabled={cargando || !REGLAS.every((r) => r.ok(nueva)) || nueva !== repetida}
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <Pressable onPress={volverAlLogin} style={({ pressed }) => [styles.forgotButton, pressed && styles.pressed]} accessibilityRole="button">
                  <Text style={styles.link}>‹ Volver</Text>
                </Pressable>
              </>
            ) : !desafio ? (
              <>
                <View style={styles.cardIntro}>
                  <Text style={styles.cardTitle}>Bienvenido de nuevo</Text>
                  <Text style={styles.cardDescription}>Accedé a tu ruta de reparto.</Text>
                </View>
                <View style={styles.form}>
                  <AppInput label="Correo electrónico" value={email} onChangeText={setEmail} placeholder="nombre@movii.com" keyboardType="email-address" />
                  <AppInput label="Contraseña" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
                </View>
                <Pressable
                  onPress={() => {
                    haptic.selection();
                    setKeepSignedIn((current) => !current);
                  }}
                  style={({ pressed }) => [styles.keepSession, pressed && styles.pressed]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: keepSignedIn }}
                  accessibilityLabel="Mantener sesión iniciada"
                >
                  <View style={[styles.checkbox, keepSignedIn && styles.checkboxChecked]}>{keepSignedIn ? <Text style={styles.checkboxCheck}>✓</Text> : null}</View>
                  <Text style={styles.keepSessionText}>Mantener sesión iniciada</Text>
                </Pressable>
                <PrimaryButton label={cargando ? "Ingresando…" : "Ingresar"} onPress={ingresar} icon="→" disabled={cargando} />
                {conGoogle ? <PrimaryButton label="Continuar con Google" tone="secondary" icon="G" onPress={entrarConGoogle} disabled={cargando} /> : null}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <Pressable
                  onPress={() => {
                    haptic.light();
                    router.push("/forgot-password");
                  }}
                  style={({ pressed }) => [styles.forgotButton, pressed && styles.pressed]}
                  accessibilityRole="link"
                  accessibilityLabel="Recuperar contraseña"
                >
                  <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.cardIntro}>
                  <Text style={styles.cardTitle}>Verificá que sos vos</Text>
                </View>
                <View style={[styles.canal, desafio.canal === "mail" && styles.canalMail]}>
                  <View style={[styles.waIcon, desafio.canal === "mail" && styles.waIconMail]}>
                    <Text style={styles.waIconText}>{desafio.canal === "mail" ? "✉" : "✆"}</Text>
                  </View>
                  <Text style={styles.canalTexto}>
                    Te mandamos un código de 6 dígitos {desafio.canal === "mail" ? "por mail a " : "por WhatsApp al "}
                    <Text style={styles.strong}>{desafio.destino || desafio.telefono}</Text>. Vence en {Math.round(desafio.vence_en_segundos / 60)} minutos.
                  </Text>
                </View>
                {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
                <CodigoInput value={codigo} onChange={setCodigo} error={error} ok={verificado} disabled={cargando || verificado} />
                {error ? <Text style={styles.errorCaja}>{error}</Text> : null}
                <PrimaryButton label={cargando ? "Verificando…" : "Verificar e ingresar"} onPress={confirmarCodigo} icon="✓" disabled={cargando || verificado || codigo.length !== 6} />
                <View style={styles.row}>
                  <Pressable
                    onPress={volverAlLogin}
                    style={({ pressed }) => pressed && styles.pressed}
                    accessibilityRole="button"
                  >
                    <Text style={styles.link}>‹ Volver</Text>
                  </Pressable>
                  <Pressable onPress={reenviar} disabled={espera > 0 || cargando} style={({ pressed }) => pressed && styles.pressed} accessibilityRole="button">
                    <Text style={[styles.forgot, espera > 0 && styles.disabled]}>{espera > 0 ? `Reenviar en ${espera}s` : "Reenviar código"}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </GlassCard>
        </View>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, width: "100%", maxWidth: 500, alignSelf: "center", justifyContent: "center", paddingHorizontal: 22, paddingVertical: 28, gap: 22 },
  brandBlock: { alignItems: "flex-start", gap: 8 },
  kicker: { color: "#F4B400", fontSize: 11, fontWeight: "900", letterSpacing: 1.6, marginTop: 12 },
  title: { color: "#FFFFFF", fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -1.5, maxWidth: 340 },
  subtitle: { color: "#9A9AA0", fontSize: 14.5, lineHeight: 21, maxWidth: 320 },
  card: { gap: 16, padding: 22, borderRadius: 28, borderColor: "transparent" },
  cardIntro: { gap: 4, alignItems: "center" },
  cardTitle: { color: "#1C1C1E", fontSize: 21, lineHeight: 25, fontWeight: "800", letterSpacing: -0.55, textAlign: "center" },
  cardDescription: { color: "#6E6E73", fontSize: 14, lineHeight: 20, textAlign: "center" },
  strong: { color: "#1C1C1E", fontWeight: "800" },
  canal: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 14, padding: 12, backgroundColor: "#E8F8EE" },
  canalMail: { backgroundColor: "#FFF4CC" },
  canalTexto: { flex: 1, color: "#3A3A3C", fontSize: 13.5, lineHeight: 19 },
  waIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#25D366", alignItems: "center", justifyContent: "center" },
  waIconMail: { backgroundColor: "#F4B400" },
  waIconText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  errorCaja: { color: "#B91C1C", backgroundColor: "#FEF2F2", borderRadius: 12, padding: 11, fontSize: 13, fontWeight: "600", textAlign: "center" },
  form: { gap: 12 },
  aviso: { color: "#1E7F3C", backgroundColor: "#E8F7EC", borderRadius: 12, padding: 11, fontSize: 13, textAlign: "center" },
  keepSession: { flexDirection: "row", alignItems: "center", gap: 9, alignSelf: "flex-start", minHeight: 30, marginTop: -2 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: "#AEAEB2", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  checkboxChecked: { backgroundColor: "#F4B400", borderColor: "#D7AA00" },
  checkboxCheck: { color: "#1C1C1E", fontSize: 13, fontWeight: "900", marginTop: -1 },
  keepSessionText: { color: "#3A3A3C", fontSize: 13, fontWeight: "600" },
  forgotButton: { minHeight: 28, justifyContent: "center", alignSelf: "center", marginTop: -7 },
  forgot: { color: "#806700", fontSize: 13, fontWeight: "700", textAlign: "center" },
  link: { color: "#6E6E73", fontSize: 13, fontWeight: "700" },
  disabled: { color: "#AEAEB2" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 30 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  reglas: { gap: 3 },
  regla: { color: "#8E8E93", fontSize: 13 },
  reglaOk: { color: "#1E7F3C", fontWeight: "700" },
  errorText: { color: "#D70015", fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: -6 },
});
