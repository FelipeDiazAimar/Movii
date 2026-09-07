import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { AuroraBackground } from "@/components/aurora-background";
import { SignaturePad } from "@/components/signature-pad";
import { AppInput, GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { haptic } from "@/lib/haptics";
import { useMovii } from "@/lib/movii-context";

export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findShipment, setShipmentStatus } = useMovii();
  const shipment = findShipment(id);
  const [recipientName, setRecipientName] = useState(shipment?.recipient.name ?? "");
  const [signed, setSigned] = useState(false);
  const [proofReady, setProofReady] = useState(false);
  if (!shipment) return null;
  const confirm = () => { setShipmentStatus(shipment.id, "entregado", { recipientName: recipientName.trim() || shipment.recipient.name, hasProof: proofReady || signed }); haptic.success(); router.replace({ pathname: "/stop/[id]", params: { id: shipment.id } }); };
  return (
    <View style={styles.page}><AuroraBackground style={StyleSheet.absoluteFill} /><AppHeader title="Confirmar entrega" subtitle={shipment.code} /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><GlassCard style={styles.addressCard}><Text style={styles.label}>ENTREGA A</Text><Text style={styles.recipient}>{shipment.recipient.name}</Text><Text style={styles.address}>{shipment.recipient.address}, {shipment.recipient.locality}</Text></GlassCard><Text style={styles.section}>Firma digital</Text><GlassCard><SignaturePad onChange={setSigned} /></GlassCard><Text style={styles.section}>Evidencia de entrega</Text><GlassCard style={styles.evidence}><View style={styles.camera}><Text style={styles.cameraIcon}>▣</Text></View><View style={styles.evidenceCopy}><Text style={styles.evidenceTitle}>{proofReady ? "Foto de evidencia lista" : "Tomar foto del paquete"}</Text><Text style={styles.evidenceText}>{proofReady ? "La evidencia se adjuntará a la entrega." : "Usá la cámara para registrar el paquete en destino."}</Text><PrimaryButton label={proofReady ? "Cambiar evidencia" : "Simular captura"} tone="secondary" onPress={() => setProofReady((current) => !current)} /></View></GlassCard><AppInput label="Nombre de quien recibe" value={recipientName} onChangeText={setRecipientName} placeholder="Nombre y apellido" autoCapitalize="words" /><PrimaryButton label="Confirmar entrega" onPress={confirm} disabled={!signed && !proofReady} icon="✓" /><Text style={styles.hint}>Registrá una firma o una evidencia para habilitar la confirmación.</Text></ScrollView></View>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#F7F7F8" }, content: { padding: 16, paddingTop: 10, paddingBottom: 34, gap: 15, maxWidth: 620, width: "100%", alignSelf: "center" }, addressCard: { gap: 4 }, label: { color: "#6E6E73", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, recipient: { color: "#1C1C1E", fontSize: 18, fontWeight: "800" }, address: { color: "#6E6E73", fontSize: 13 }, section: { color: "#6E6E73", fontSize: 12, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase", marginTop: 2 }, evidence: { flexDirection: "row", gap: 13, alignItems: "center" }, camera: { width: 70, height: 70, borderRadius: 14, backgroundColor: "#FFF4CC", alignItems: "center", justifyContent: "center" }, cameraIcon: { color: "#806700", fontSize: 30 }, evidenceCopy: { flex: 1, gap: 5 }, evidenceTitle: { color: "#1C1C1E", fontSize: 14, fontWeight: "800" }, evidenceText: { color: "#6E6E73", fontSize: 12, lineHeight: 17 }, hint: { color: "#6E6E73", fontSize: 12, textAlign: "center", marginTop: -5 }, });
