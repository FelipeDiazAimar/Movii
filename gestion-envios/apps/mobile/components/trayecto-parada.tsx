import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { MapaRuta } from "@/components/mapa-ruta";
import { obtenerTrayecto, type TrayectoAPI } from "@/lib/api-client";
import type { DatosMapaApp } from "@/lib/mapa-html";

/** Mini mapa del detalle de parada: el camión, el destino y el camino por calles hasta ahí. */
export function TrayectoParada({ envioId }: { envioId: string }) {
  const [t, setT] = useState<TrayectoAPI | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    const traer = () =>
      obtenerTrayecto(envioId)
        .then((r) => {
          if (vigente) {
            setT(r);
            setError(false);
          }
        })
        .catch(() => vigente && setError(true));
    void traer();
    const intervalo = setInterval(traer, 10000);
    return () => {
      vigente = false;
      clearInterval(intervalo);
    };
  }, [envioId]);

  const datos = useMemo<DatosMapaApp>(
    () => ({
      paradas: t?.destino ? [{ id: t.envio_id, orden: 1, estado: t.estado, lat: t.destino.lat, lng: t.destino.lng, titulo: t.codigo_guia, destacada: true }] : [],
      trayecto: t?.recorrido?.geometria ?? null,
      camion: t?.vehiculo ? { lat: t.vehiculo.lat, lng: t.vehiculo.lng, rumbo: t.vehiculo.rumbo, patente: t.vehiculo.patente } : null,
      encuadre: t?.vehiculo ? "con-camion" : "destino",
    }),
    [t],
  );

  if (!t) {
    return <View style={[styles.box, styles.center]}>{error ? <Text style={styles.caption}>Mapa no disponible</Text> : <ActivityIndicator color="#806700" />}</View>;
  }
  if (!t.destino) {
    return (
      <View style={[styles.box, styles.center]}>
        <Text style={styles.caption}>Ubicando la dirección en el mapa…</Text>
      </View>
    );
  }

  let texto = "Destino de la entrega";
  if (t.recorrido) {
    const min = Math.max(1, Math.round(t.recorrido.duracion_s / 60));
    texto = `${(t.recorrido.distancia_m / 1000).toFixed(1).replace(".", ",")} km · ~${min} min${t.paradas_antes > 0 ? ` · ${t.paradas_antes} parada(s) antes` : " · es tu próxima entrega"}`;
  }

  return (
    <View style={styles.box}>
      <MapaRuta datos={datos} style={StyleSheet.absoluteFill} />
      <View style={styles.captionBox} pointerEvents="none">
        <Text style={styles.caption}>{texto}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 190, borderRadius: 20, overflow: "hidden", backgroundColor: "#E9EDEF" },
  center: { alignItems: "center", justifyContent: "center" },
  captionBox: { position: "absolute", bottom: 10, left: 10, backgroundColor: "rgba(255,255,255,0.94)", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 },
  caption: { color: "#1C1C1E", fontSize: 11, fontWeight: "700" },
});
