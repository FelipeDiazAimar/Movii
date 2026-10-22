import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { AuroraBackground } from "@/components/aurora-background";
import { GlassCard, PrimaryButton } from "@/components/ui/movii-ui";
import { useAccionEnvio } from "@/hooks/use-accion-envio";
import { reprogramarEnvio } from "@/lib/api-client";
import { haptic } from "@/lib/haptics";
import { useMovii } from "@/lib/movii-context";
import { FRANJAS_HORARIAS, proximasFechas, type FranjaHoraria } from "@/lib/seguimiento";

export default function RescheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findShipment, updateShipment } = useMovii();
  const { ejecutar, enviando, error } = useAccionEnvio();
  const shipment = findShipment(id);

  const fechasValidas = useMemo(() => proximasFechas(3), []);
  const [selectedFecha, setSelectedFecha] = useState(fechasValidas[0]?.fecha ?? "");
  const [selectedFranja, setSelectedFranja] = useState<FranjaHoraria>("manana");

  if (!shipment) return null;
  const real = Boolean(shipment.estadoApi);

  const save = async () => {
    if (!real) {
      const fechaObj = fechasValidas.find((f) => f.fecha === selectedFecha);
      const franjaObj = FRANJAS_HORARIAS.find((f) => f.value === selectedFranja);
      const diaTexto = fechaObj?.etiqueta.replace("\n", " · ") ?? selectedFecha;
      const franjaTexto = franjaObj?.label ?? selectedFranja;
      updateShipment(shipment.id, {
        status: "pendiente",
        rescheduledFor: `${diaTexto} · ${franjaTexto}`,
        timeWindow: franjaTexto,
        estimatedDate: diaTexto,
      });
      haptic.success();
      router.replace({ pathname: "/stop/[id]", params: { id: shipment.id } });
      return;
    }

    const ok = await ejecutar(() =>
      reprogramarEnvio(shipment.id, {
        nueva_fecha: selectedFecha,
        franja: selectedFranja,
      }),
    );
    if (!ok) {
      haptic.error();
      return;
    }

    haptic.success();
    router.replace({ pathname: "/stop/[id]", params: { id: shipment.id } });
  };

  return (
    <View style={styles.page}>
      <AuroraBackground style={StyleSheet.absoluteFill} />
      <AppHeader title="Reprogramar visita" subtitle={shipment.code} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard>
          <Text style={styles.title}>Elegí una nueva ventana de entrega</Text>
          <Text style={styles.copy}>
            El envío volverá al circuito operativo para la fecha y franja seleccionadas (≥ hoy en UTC).
          </Text>
        </GlassCard>

        <Text style={styles.section}>Fecha de entrega</Text>
        <View style={styles.dayRow}>
          {fechasValidas.map((item) => (
            <Pressable
              key={item.fecha}
              onPress={() => {
                haptic.selection();
                setSelectedFecha(item.fecha);
              }}
              style={[styles.day, selectedFecha === item.fecha && styles.dayActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedFecha === item.fecha }}
            >
              <Text style={[styles.dayText, selectedFecha === item.fecha && styles.dayTextActive]}>
                {item.etiqueta}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Franja horaria</Text>
        <View style={styles.slots}>
          {FRANJAS_HORARIAS.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => {
                haptic.selection();
                setSelectedFranja(item.value);
              }}
              style={[styles.slot, selectedFranja === item.value && styles.slotActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedFranja === item.value }}
            >
              <Text style={[styles.slotText, selectedFranja === item.value && styles.slotTextActive]}>
                {item.label}
              </Text>
              {selectedFranja === item.value ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          ))}
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          label={enviando ? "Reprogramando…" : "Confirmar nueva visita"}
          onPress={save}
          disabled={enviando || !selectedFecha}
          icon="✓"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F7F8" },
  content: { padding: 16, paddingTop: 10, paddingBottom: 34, gap: 14, maxWidth: 620, width: "100%", alignSelf: "center" },
  title: { color: "#1C1C1E", fontSize: 16, fontWeight: "800" },
  copy: { color: "#6E6E73", fontSize: 13, lineHeight: 18, marginTop: 6 },
  section: { color: "#6E6E73", fontSize: 12, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase", marginTop: 4 },
  dayRow: { flexDirection: "row", gap: 8 },
  day: { flex: 1, minHeight: 70, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "#E5E5EA" },
  dayActive: { backgroundColor: "#FFF4CC", borderColor: "#FFD60A" },
  dayText: { color: "#6E6E73", fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 18 },
  dayTextActive: { color: "#1C1C1E", fontWeight: "800" },
  slots: { gap: 8 },
  slot: { minHeight: 51, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "#E5E5EA" },
  slotActive: { backgroundColor: "#FFF4CC", borderColor: "#FFD60A" },
  slotText: { color: "#1C1C1E", fontSize: 14, fontWeight: "700" },
  slotTextActive: { fontWeight: "800" },
  check: { color: "#806700", fontWeight: "900", fontSize: 16 },
  error: { color: "#B42318", fontSize: 13, fontWeight: "700", textAlign: "center" },
});
