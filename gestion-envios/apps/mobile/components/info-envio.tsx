import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { M } from "@/constants/movii-design";
import { GlassCard } from "@/components/ui/movii-ui";
import type { Shipment } from "@/types/logistics";

const TAMANOS: Record<string, string> = { chico: "Chico", pequeno: "Chico", mediano: "Mediano", grande: "Grande" };

/** "2026-11-11" → "11/11/2026"; si no viene en ese formato se muestra tal cual. */
function fechaCorta(iso?: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? "");
}

function Dato({ etiqueta, valor, ancho }: { etiqueta: string; valor?: string; ancho?: "mitad" }) {
  if (!valor) return null;
  return (
    <View style={[s.dato, ancho === "mitad" && s.mitad]}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <Text style={s.valor}>{valor}</Text>
    </View>
  );
}

function Sello({ texto, color, fondo }: { texto: string; color: string; fondo: string }) {
  return (
    <View style={[s.sello, { backgroundColor: fondo }]}>
      <Text style={[s.selloTexto, { color }]}>{texto}</Text>
    </View>
  );
}

/**
 * Ficha del envío en la pantalla de la parada: quién lo manda, qué lleva, cuánto
 * pesa, cómo se entrega y a quién. Solo muestra los datos que el envío trae.
 */
export function InfoEnvio({ envio }: { envio: Shipment }) {
  const tamano = envio.size ? (TAMANOS[envio.size] ?? envio.size) : undefined;
  const destino = [envio.recipient.address, envio.recipientUnit ? `Piso/Depto ${envio.recipientUnit}` : "", envio.recipient.locality, envio.recipient.postalCode ? `CP ${envio.recipient.postalCode}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <GlassCard style={s.card}>
      <View style={s.sellos}>
        {envio.urgent ? <Sello texto="URGENTE" color="#FFFFFF" fondo={M.naranja} /> : null}
        {envio.fragile ? <Sello texto="FRÁGIL" color="#FFFFFF" fondo={M.rojo} /> : null}
        {!envio.urgent && !envio.fragile ? <Sello texto="ENVÍO ESTÁNDAR" color={M.gris} fondo={M.hormigon100} /> : null}
      </View>

      <Text style={s.grupo}>Paquete</Text>
      <View style={s.grilla}>
        <Dato etiqueta="Contenido" valor={envio.packageDescription} ancho="mitad" />
        <Dato etiqueta="Peso" valor={envio.weight} ancho="mitad" />
        <Dato etiqueta="Tamaño" valor={tamano} ancho="mitad" />
        <Dato etiqueta="Entrega prevista" valor={fechaCorta(envio.deliveryDate)} ancho="mitad" />
        <Dato etiqueta="Guía" valor={envio.code} ancho="mitad" />
        <Dato etiqueta="Parada" valor={envio.stopOrder ? `N.º ${envio.stopOrder} · ${envio.routeName}` : envio.routeName} ancho="mitad" />
      </View>

      <View style={s.linea} />
      <Text style={s.grupo}>Remitente</Text>
      <Dato etiqueta="Nombre" valor={envio.sender} />
      <Dato etiqueta="Dirección de origen" valor={envio.senderAddress} />
      {envio.senderPhone ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`Llamar al remitente ${envio.senderPhone}`} onPress={() => void Linking.openURL(`tel:${envio.senderPhone!.replace(/[^\d+]/g, "")}`)} style={s.dato}>
          <Text style={s.etiqueta}>Teléfono</Text>
          <Text style={[s.valor, s.enlace]}>{envio.senderPhone}</Text>
        </Pressable>
      ) : null}

      <View style={s.linea} />
      <Text style={s.grupo}>Destinatario</Text>
      <Dato etiqueta="Nombre" valor={envio.recipient.name} />
      <Dato etiqueta="Dirección" valor={destino} />
      {envio.recipient.phone ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`Llamar al destinatario ${envio.recipient.phone}`} onPress={() => void Linking.openURL(`tel:${envio.recipient.phone.replace(/[^\d+]/g, "")}`)} style={s.dato}>
          <Text style={s.etiqueta}>Teléfono</Text>
          <Text style={[s.valor, s.enlace]}>{envio.recipient.phone}</Text>
        </Pressable>
      ) : null}

      {envio.notes ? (
        <>
          <View style={s.linea} />
          <Text style={s.grupo}>Indicaciones</Text>
          <Text style={s.valor}>{envio.notes}</Text>
        </>
      ) : null}
    </GlassCard>
  );
}

const s = StyleSheet.create({
  card: { padding: 16, gap: 10 },
  sellos: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  sello: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  selloTexto: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.8 },
  grupo: { color: M.gris, fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 },
  grilla: { flexDirection: "row", flexWrap: "wrap", rowGap: 12, columnGap: 8 },
  dato: { gap: 2 },
  mitad: { width: "48%" },
  etiqueta: { color: M.gris, fontSize: 11, fontWeight: "700" },
  valor: { color: M.texto, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  enlace: { color: M.azul, textDecorationLine: "underline" },
  linea: { height: 1, backgroundColor: "#EFEFF2", marginVertical: 2 },
});
