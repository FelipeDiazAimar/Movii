import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { AuroraBackground } from "@/components/aurora-background";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { AppInput, GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { useAccionEnvio } from "@/hooks/use-accion-envio";
import { confirmarEntrega } from "@/lib/api-client";
import { tomarFotoJPEG } from "@/lib/foto";
import { haptic } from "@/lib/haptics";
import { useMovii } from "@/lib/movii-context";
import { RELACIONES_RECEPTOR, validarConfirmacion, type RelacionReceptor } from "@/lib/seguimiento";

export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findShipment, setShipmentStatus } = useMovii();
  const { ejecutar, enviando, error, setError } = useAccionEnvio();
  const shipment = findShipment(id);
  const firmaRef = useRef<SignaturePadHandle>(null);
  const [recipientName, setRecipientName] = useState(shipment?.recipient.name ?? "");
  const [relacion, setRelacion] = useState<RelacionReceptor>("destinatario");
  const [signed, setSigned] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  if (!shipment) return null;
  const real = Boolean(shipment.estadoApi);

  const capturar = async () => {
    try {
      const b64 = await tomarFotoJPEG();
      if (b64) { setFoto(b64); setError(null); haptic.light(); }
    } catch {
      setError("No se pudo abrir la cámara ni la galería.");
    }
  };

  const confirm = async () => {
    if (!real) {
      setShipmentStatus(shipment.id, "entregado", { recipientName: recipientName.trim() || shipment.recipient.name, hasProof: Boolean(foto) || signed });
      haptic.success();
      router.replace({ pathname: "/stop/[id]", params: { id: shipment.id } });
      return;
    }
    const firma = (await firmaRef.current?.exportarPNG()) ?? null;
    const problema = validarConfirmacion({ receptorNombre: recipientName, relacion, firmaBase64: firma, fotoBase64: foto });
    if (problema) { setError(problema); haptic.error(); return; }
    const ok = await ejecutar(() =>
      confirmarEntrega(shipment.id, { receptor_nombre: recipientName.trim(), receptor_relacion: relacion, firma_base64: firma as string, foto_base64: foto as string }),
    );
    if (!ok) { haptic.error(); return; }
    haptic.success();
    router.replace({ pathname: "/stop/[id]", params: { id: shipment.id } });
  };

  // HU-08: firma y foto son obligatorias. En el modo mock alcanza con una de las dos (como el prototipo).
  const listo = real ? signed && Boolean(foto) : signed || Boolean(foto);

  return (
    <View style={styles.page}><AuroraBackground style={StyleSheet.absoluteFill} /><AppHeader title="Confirmar entrega" subtitle={shipment.code} /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><GlassCard style={styles.addressCard}><Text style={styles.label}>ENTREGA A</Text><Text style={styles.recipient}>{shipment.recipient.name}</Text><Text style={styles.address}>{shipment.recipient.address}, {shipment.recipient.locality}</Text></GlassCard><Text style={styles.section}>Firma digital</Text><GlassCard><SignaturePad ref={firmaRef} onChange={setSigned} /></GlassCard><Text style={styles.section}>Evidencia de entrega</Text><GlassCard style={styles.evidence}><View style={styles.camera}><Text style={styles.cameraIcon}>{foto ? "✓" : "▣"}</Text></View><View style={styles.evidenceCopy}><Text style={styles.evidenceTitle}>{foto ? "Foto del paquete lista" : "Tomar foto del paquete"}</Text><Text style={styles.evidenceText}>{foto ? "La foto se adjuntará a la entrega." : "Usá la cámara para registrar el paquete en destino."}</Text><PrimaryButton label={foto ? "Volver a sacar" : "Abrir cámara"} tone="secondary" onPress={capturar} /></View></GlassCard><AppInput label="Nombre de quien recibe" value={recipientName} onChangeText={setRecipientName} placeholder="Nombre y apellido" autoCapitalize="words" /><Text style={styles.section}>Relación con el destinatario</Text><View style={styles.chips}>{RELACIONES_RECEPTOR.map((r) => <Pressable key={r.value} onPress={() => { haptic.selection(); setRelacion(r.value); }} style={[styles.chip, relacion === r.value && styles.chipActive]} accessibilityRole="radio" accessibilityState={{ selected: relacion === r.value }}><Text style={[styles.chipText, relacion === r.value && styles.chipTextActive]}>{r.label}</Text></Pressable>)}</View><PrimaryButton label={enviando ? "Confirmando…" : "Confirmar entrega"} onPress={confirm} disabled={!listo || enviando} icon="✓" />{error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : <Text style={styles.hint}>{real ? "Registrá la firma y la foto del paquete para confirmar." : "Registrá una firma o una evidencia para habilitar la confirmación."}</Text>}</ScrollView></View>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#F7F7F8" }, content: { padding: 16, paddingTop: 10, paddingBottom: 34, gap: 15, maxWidth: 620, width: "100%", alignSelf: "center" }, addressCard: { gap: 4 }, label: { color: "#6E6E73", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, recipient: { color: "#1C1C1E", fontSize: 18, fontWeight: "800" }, address: { color: "#6E6E73", fontSize: 13 }, section: { color: "#6E6E73", fontSize: 12, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase", marginTop: 2 }, evidence: { flexDirection: "row", gap: 13, alignItems: "center" }, camera: { width: 70, height: 70, borderRadius: 14, backgroundColor: "#FFF4CC", alignItems: "center", justifyContent: "center" }, cameraIcon: { color: "#806700", fontSize: 30 }, evidenceCopy: { flex: 1, gap: 5 }, evidenceTitle: { color: "#1C1C1E", fontSize: 14, fontWeight: "800" }, evidenceText: { color: "#6E6E73", fontSize: 12, lineHeight: 17 }, hint: { color: "#6E6E73", fontSize: 12, textAlign: "center", marginTop: -5 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "#E5E5EA" }, chipActive: { backgroundColor: "#FFF4CC", borderColor: "#FFD60A" }, chipText: { color: "#1C1C1E", fontSize: 13, fontWeight: "600" }, chipTextActive: { fontWeight: "800" }, error: { color: "#B42318", fontSize: 13, fontWeight: "700", textAlign: "center" }, });
