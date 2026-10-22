import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { AuroraBackground } from "@/components/aurora-background";
import { GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { useAccionEnvio } from "@/hooks/use-accion-envio";
import { registrarIncidencia } from "@/lib/api-client";
import { tomarFotoJPEG } from "@/lib/foto";
import { haptic } from "@/lib/haptics";
import { useMovii } from "@/lib/movii-context";
import { MOTIVOS_FALLO, validarIncidencia, type MotivoFallo } from "@/lib/seguimiento";

export default function FailureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findShipment, setShipmentStatus } = useMovii();
  const { ejecutar, enviando, error, setError } = useAccionEnvio();
  const shipment = findShipment(id);

  const [motivo, setMotivo] = useState<MotivoFallo>("cliente_ausente");
  const [comentario, setComentario] = useState("");
  const [foto, setFoto] = useState<string | null>(null);

  if (!shipment) return null;
  const real = Boolean(shipment.estadoApi);

  const capturarFoto = async () => {
    try {
      const b64 = await tomarFotoJPEG();
      if (b64) {
        setFoto(b64);
        setError(null);
        haptic.light();
      }
    } catch {
      setError("No se pudo abrir la cámara ni la galería.");
    }
  };

  const save = async () => {
    if (!real) {
      const label = MOTIVOS_FALLO.find((m) => m.value === motivo)?.label ?? motivo;
      setShipmentStatus(shipment.id, "no_entregado", {
        failureReason: comentario.trim() ? `${label}: ${comentario.trim()}` : label,
        hasProof: Boolean(foto),
      });
      haptic.error();
      router.replace({ pathname: "/stop/[id]", params: { id: shipment.id } });
      return;
    }

    const problema = validarIncidencia(motivo, comentario, foto ?? undefined);
    if (problema) {
      setError(problema);
      haptic.error();
      return;
    }

    const ok = await ejecutar(() =>
      registrarIncidencia(shipment.id, {
        motivo,
        comentario: comentario.trim() || undefined,
        foto_base64: foto ?? undefined,
      }),
    );
    if (!ok) {
      haptic.error();
      return;
    }

    haptic.error();
    router.replace({ pathname: "/stop/[id]", params: { id: shipment.id } });
  };

  return (
    <View style={styles.page}>
      <AuroraBackground style={StyleSheet.absoluteFill} />
      <AppHeader title="Registrar incidencia" subtitle={shipment.code} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard>
          <Text style={styles.introTitle}>No se pudo completar la entrega</Text>
          <Text style={styles.introCopy}>
            Seleccioná el motivo y agregá información para que el equipo pueda resolver el siguiente paso.
          </Text>
        </GlassCard>

        <Text style={styles.section}>Motivo</Text>
        <View style={styles.reasons}>
          {MOTIVOS_FALLO.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => {
                haptic.selection();
                setMotivo(item.value);
              }}
              style={[styles.reason, motivo === item.value && styles.reasonActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: motivo === item.value }}
            >
              <View style={[styles.radio, motivo === item.value && styles.radioActive]}>
                {motivo === item.value ? <View style={styles.radioInner} /> : null}
              </View>
              <Text style={[styles.reasonText, motivo === item.value && styles.reasonTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>
          Nota adicional {motivo === "otro" ? <Text style={styles.required}>* (obligatoria)</Text> : null}
        </Text>
        <TextInput
          value={comentario}
          onChangeText={setComentario}
          placeholder={motivo === "otro" ? "Describí el motivo del fallo (obligatorio)…" : "Contanos qué ocurrió…"}
          placeholderTextColor="#AEAEB2"
          multiline
          style={styles.note}
          accessibilityLabel="Nota adicional"
        />

        <GlassCard style={styles.proof}>
          <View style={{ flex: 1 }}>
            <Text style={styles.proofTitle}>{foto ? "Foto adjuntada" : "Evidencia opcional"}</Text>
            <Text style={styles.proofCopy}>Podés registrar una foto del intento de entrega (JPEG ≤ 5 MB).</Text>
          </View>
          <PrimaryButton
            label={foto ? "Cambiar foto" : "Tomar foto"}
            tone="secondary"
            onPress={capturarFoto}
          />
        </GlassCard>

        {foto ? (
          <Pressable onPress={() => setFoto(null)} style={styles.removeProof}>
            <Text style={styles.removeProofText}>Quitar foto adjunta</Text>
          </Pressable>
        ) : null}

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          label={enviando ? "Guardando…" : "Guardar incidencia"}
          tone="danger"
          onPress={save}
          disabled={enviando}
          icon="!"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F7F8" },
  content: { padding: 16, paddingTop: 10, paddingBottom: 34, gap: 12, maxWidth: 620, width: "100%", alignSelf: "center" },
  introTitle: { color: "#1C1C1E", fontSize: 16, fontWeight: "800" },
  introCopy: { color: "#6E6E73", fontSize: 13, lineHeight: 18, marginTop: 6 },
  section: { color: "#6E6E73", fontSize: 12, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase", marginTop: 4 },
  required: { color: "#B42318", textTransform: "none" },
  reasons: { gap: 8 },
  reason: { minHeight: 51, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "#E5E5EA" },
  reasonActive: { backgroundColor: "#FFF4CC", borderColor: "#FFD60A" },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: "#AEAEB2", alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: "#806700" },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FFD60A" },
  reasonText: { color: "#1C1C1E", fontSize: 14, fontWeight: "600" },
  reasonTextActive: { fontWeight: "800" },
  note: { minHeight: 105, borderRadius: 15, borderWidth: 1, borderColor: "#E5E5EA", backgroundColor: "rgba(255,255,255,0.8)", padding: 13, color: "#1C1C1E", textAlignVertical: "top", fontSize: 14 },
  proof: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  proofTitle: { color: "#1C1C1E", fontSize: 14, fontWeight: "800" },
  proofCopy: { color: "#6E6E73", fontSize: 12, maxWidth: 190, marginTop: 3 },
  removeProof: { alignSelf: "center", paddingVertical: 4 },
  removeProofText: { color: "#B42318", fontSize: 13, fontWeight: "600" },
  error: { color: "#B42318", fontSize: 13, fontWeight: "700", textAlign: "center" },
});
