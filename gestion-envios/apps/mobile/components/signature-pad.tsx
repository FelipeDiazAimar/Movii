import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Polyline, Rect } from "react-native-svg";

export type Point = { x: number; y: number };

/** Lo que expone la firma a la pantalla que la contiene. */
export type SignaturePadHandle = {
  /** PNG de la firma en base64 (sin prefijo data:), o null si no hay trazos o no se pudo exportar. */
  exportarPNG: () => Promise<string | null>;
};

const ALTO_PAD = 190;
const COLOR_TRAZO = "#1C1C1E";
const GROSOR_TRAZO = 2.4;

/**
 * Dibuja los trazos en un canvas y devuelve el PNG en base64. Se usa en web
 * (PWA), donde react-native-svg no implementa toDataURL. Se dibuja al doble
 * de resolución para que la firma no salga pixelada.
 */
export function trazosAPNGWeb(strokes: Point[][], ancho: number, alto: number, escala = 2): string | null {
  if (typeof document === "undefined" || strokes.length === 0 || ancho <= 0 || alto <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(ancho * escala);
  canvas.height = Math.round(alto * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(escala, escala);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.strokeStyle = COLOR_TRAZO;
  ctx.lineWidth = GROSOR_TRAZO;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (const p of stroke.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.replace(/^data:image\/png;base64,/, "") || null;
}

/** Limita el punto al área del pad (un dedo que se sale del borde no dibuja afuera). */
function dentro(p: Point, ancho: number, alto: number): Point {
  return { x: Math.min(Math.max(p.x, 0), ancho), y: Math.min(Math.max(p.y, 0), alto) };
}

export const SignaturePad = forwardRef<
  SignaturePadHandle,
  {
    onChange: (signed: boolean) => void;
    /** Avisa cuando empieza/termina un trazo (para frenar el scroll de la pantalla mientras se firma). */
    onDrawingChange?: (dibujando: boolean) => void;
  }
>(function SignaturePad({ onChange, onDrawingChange }, ref) {
  // Una lista de trazos: levantar el dedo y volver a apoyarlo agrega un trazo nuevo.
  const [strokes, setStrokes] = useState<Point[][]>([]);
  // Tamaño real del pad. El SVG necesita ancho y alto explícitos: con solo
  // position:absolute, en web queda en el tamaño intrínseco (300×150) y la
  // mitad derecha del pad no dibujaba ni salía en el PNG.
  const [size, setSize] = useState({ width: 0, height: ALTO_PAD });
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const svgRef = useRef<Svg>(null);

  const punto = (event: GestureResponderEvent): Point => {
    const { width, height } = sizeRef.current;
    return dentro({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }, width, height);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        // Mientras se firma, un ScrollView padre no puede robar el gesto.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          const p = punto(event);
          setStrokes((current) => [...current, [p]]);
          onChange(true);
          onDrawingChange?.(true);
        },
        onPanResponderMove: (event) => {
          const p = punto(event);
          setStrokes((current) => [...current.slice(0, -1), [...(current[current.length - 1] ?? []), p]]);
        },
        onPanResponderRelease: () => onDrawingChange?.(false),
        onPanResponderTerminate: () => onDrawingChange?.(false),
      }),
    [onChange, onDrawingChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      exportarPNG: () =>
        new Promise((resolve) => {
          if (strokes.length === 0) return resolve(null);
          if (Platform.OS === "web") return resolve(trazosAPNGWeb(strokes, size.width, size.height));
          if (!svgRef.current) return resolve(null);
          try {
            // toDataURL de react-native-svg devuelve el PNG en base64 sin prefijo.
            (svgRef.current as unknown as { toDataURL: (cb: (b64: string) => void, opts?: { width: number; height: number }) => void }).toDataURL(
              (b64) => resolve(b64 || null),
              { width: Math.round(size.width * 2), height: Math.round(size.height * 2) },
            );
          } catch {
            resolve(null);
          }
        }),
    }),
    [strokes, size],
  );

  const clear = () => {
    setStrokes([]);
    onChange(false);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  return (
    <View style={styles.wrap}>
      <View
        {...responder.panHandlers}
        onLayout={onLayout}
        style={[styles.pad, Platform.OS === "web" ? ({ touchAction: "none", userSelect: "none", cursor: "crosshair" } as object) : null]}
        accessibilityRole="image"
        accessibilityLabel="Área para capturar firma digital"
        testID="signature-pad"
      >
        {size.width > 0 ? (
          <Svg ref={svgRef} width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Fondo blanco para que el PNG exportado se lea igual en cualquier visor. */}
            <Rect x="0" y="0" width={size.width} height={size.height} fill="#FFFFFF" />
            {strokes.map((stroke, index) =>
              stroke.length > 1 ? (
                <Polyline
                  key={index}
                  points={stroke.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={COLOR_TRAZO}
                  strokeWidth={GROSOR_TRAZO}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null,
            )}
          </Svg>
        ) : null}
        {strokes.length === 0 ? (
          <Text style={styles.hint} pointerEvents="none">
            Firmá con el dedo aquí
          </Text>
        ) : null}
        <View style={styles.signatureLine} pointerEvents="none" />
      </View>
      <Pressable onPress={clear} style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
        <Text style={styles.clearText}>Limpiar firma</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  pad: {
    width: "100%",
    height: ALTO_PAD,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },
  hint: { color: "#AEAEB2", fontSize: 14 },
  signatureLine: { position: "absolute", left: 22, right: 22, bottom: 36, height: 1, backgroundColor: "#D1D1D6" },
  clear: { alignSelf: "flex-end", minHeight: 30, justifyContent: "center" },
  clearText: { color: "#806700", fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.6 },
});
