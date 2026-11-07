import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { htmlMapa, type DatosMapaApp } from "@/lib/mapa-html";

/** Mapa real (Leaflet + OSM) en un WebView. La versión web está en mapa-ruta.web.tsx. */
export function MapaRuta({
  datos,
  style,
  onParadaPress,
}: {
  datos: DatosMapaApp;
  style?: StyleProp<ViewStyle>;
  onParadaPress?: (id: string) => void;
}) {
  const ref = useRef<WebView>(null);
  const [listo, setListo] = useState(false);
  const html = useMemo(() => htmlMapa(), []);

  useEffect(() => {
    if (!listo) return;
    ref.current?.injectJavaScript(`window.moviiMapa && window.moviiMapa.actualizar(${JSON.stringify(datos)}); true;`);
  }, [datos, listo]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { tipo: string; id?: string };
      if (msg.tipo === "listo") setListo(true);
      if (msg.tipo === "parada" && msg.id) onParadaPress?.(msg.id);
    } catch {
      // mensaje ajeno al mapa
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={ref}
        source={{ html, baseUrl: "https://movii.app/" }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", borderRadius: 16, backgroundColor: "#E9EDEF" },
  web: { flex: 1, backgroundColor: "transparent" },
});
