import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { htmlMapa, type DatosMapaApp } from "@/lib/mapa-html";

type VentanaMapa = Window & { moviiMapa?: { actualizar: (d: DatosMapaApp) => void } };

/** Mapa real (Leaflet + OSM) en la PWA: el mismo HTML que en nativo, dentro de un iframe. */
export function MapaRuta({
  datos,
  style,
  onParadaPress,
}: {
  datos: DatosMapaApp;
  style?: StyleProp<ViewStyle>;
  onParadaPress?: (id: string) => void;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [listo, setListo] = useState(false);
  const html = useMemo(() => htmlMapa(), []);
  const onParadaRef = useRef(onParadaPress);
  useEffect(() => {
    onParadaRef.current = onParadaPress;
  }, [onParadaPress]);

  useEffect(() => {
    const escuchar = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const msg = (e.data as { moviiMapa?: { tipo: string; id?: string } })?.moviiMapa;
      if (!msg) return;
      if (msg.tipo === "listo") setListo(true);
      if (msg.tipo === "parada" && msg.id) onParadaRef.current?.(msg.id);
    };
    window.addEventListener("message", escuchar);
    return () => window.removeEventListener("message", escuchar);
  }, []);

  useEffect(() => {
    if (!listo) return;
    (ref.current?.contentWindow as VentanaMapa | null)?.moviiMapa?.actualizar(datos);
  }, [datos, listo]);

  return (
    <View style={[styles.wrap, style]}>
      {createElement("iframe", {
        ref,
        srcDoc: html,
        title: "Mapa de la ruta",
        style: { border: 0, width: "100%", height: "100%", display: "block" },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", borderRadius: 16, backgroundColor: "#E9EDEF" },
});
