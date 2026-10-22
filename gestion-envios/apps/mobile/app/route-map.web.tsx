import { StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { AuroraBackground } from "@/components/aurora-background";
import { GlassCard } from "@/components/ui/movii-ui";

// react-native-maps no tiene soporte web: en el navegador el mapa de ruta vive en el panel web (/rutas/:id/mapa).
export default function RouteMapWeb() {
  return (
    <View style={styles.page}>
      <AuroraBackground style={StyleSheet.absoluteFill} />
      <AppHeader title="Mapa de ruta" subtitle="Disponible en la app" />
      <GlassCard style={styles.card}>
        <Text style={styles.text}>El mapa de la ruta está disponible en la app móvil (iOS y Android).</Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F7F8" },
  card: { margin: 16 },
  text: { color: "#1C1C1E", fontSize: 14, lineHeight: 20 },
});
