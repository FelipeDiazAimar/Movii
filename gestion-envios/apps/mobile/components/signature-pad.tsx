import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Polyline, Rect } from "react-native-svg";

type Point = { x: number; y: number };

/** Lo que expone la firma a la pantalla que la contiene. */
export type SignaturePadHandle = {
  /** PNG de la firma en base64 (sin prefijo data:), o null si no hay trazos o no se pudo exportar. */
  exportarPNG: () => Promise<string | null>;
};

export const SignaturePad = forwardRef<SignaturePadHandle, { onChange: (signed: boolean) => void }>(function SignaturePad(
  { onChange },
  ref,
) {
  // Una lista de trazos: levantar el dedo y volver a apoyarlo agrega un trazo nuevo
  // (antes cada trazo borraba el anterior y no se podía firmar con iniciales separadas).
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const svgRef = useRef<Svg>(null);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
          setStrokes((current) => [...current, [point]]);
          onChange(true);
        },
        onPanResponderMove: (event) => {
          const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
          setStrokes((current) => [...current.slice(0, -1), [...(current[current.length - 1] ?? []), point]]);
        },
      }),
    [onChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      exportarPNG: () =>
        new Promise((resolve) => {
          if (strokes.length === 0 || !svgRef.current) return resolve(null);
          try {
            // toDataURL de react-native-svg devuelve el PNG en base64 sin prefijo.
            (svgRef.current as unknown as { toDataURL: (cb: (b64: string) => void) => void }).toDataURL((b64) => resolve(b64 || null));
          } catch {
            resolve(null); // p. ej. en web, donde toDataURL no está implementado
          }
        }),
    }),
    [strokes],
  );

  const clear = () => {
    setStrokes([]);
    onChange(false);
  };

  return (
    <View style={styles.wrap}>
      <View {...responder.panHandlers} style={styles.pad} accessibilityRole="image" accessibilityLabel="Área para capturar firma digital">
        <Svg ref={svgRef} style={StyleSheet.absoluteFill}>
          {/* Fondo blanco para que el PNG exportado se lea igual en cualquier visor. */}
          <Rect x="0" y="0" width="100%" height="100%" fill="#FFFFFF" />
          {strokes.map((stroke, index) =>
            stroke.length > 1 ? (
              <Polyline
                key={index}
                points={stroke.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#1C1C1E"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null,
          )}
        </Svg>
        {strokes.length === 0 ? <Text style={styles.hint}>Firmá con el dedo aquí</Text> : null}
        <View style={styles.signatureLine} />
      </View>
      <Pressable onPress={clear} style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
        <Text style={styles.clearText}>Limpiar firma</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  pad: { height: 142, borderRadius: 16, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", justifyContent: "center", alignItems: "center" },
  hint: { color: "#AEAEB2", fontSize: 14 },
  signatureLine: { position: "absolute", left: 22, right: 22, bottom: 31, height: 1, backgroundColor: "#D1D1D6" },
  clear: { alignSelf: "flex-end", minHeight: 30, justifyContent: "center" },
  clearText: { color: "#806700", fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.6 },
});
