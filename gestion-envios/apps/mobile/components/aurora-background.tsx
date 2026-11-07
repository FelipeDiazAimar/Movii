import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions, type ViewProps } from "react-native";
import { StatusBar } from "expo-status-bar";
import Svg, { Circle, Defs, Line, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

import { M } from "@/constants/movii-design";

type Props = ViewProps & {
  /** "oscuro": asfalto con luces amarillas (login). "claro": hormigón con un halo cálido. */
  variante?: "oscuro" | "claro";
  /** Color de los íconos de la barra de estado; por defecto el que contrasta con el fondo. */
  barra?: "light" | "dark";
};

function Halo({ id, color, tam, opacidad }: { id: string; color: string; tam: number; opacidad: number }) {
  return (
    <Svg width={tam} height={tam}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacidad} />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={tam / 2} cy={tam / 2} r={tam / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Fondo de Movii. Reemplaza a la aurora anterior: dos halos que derivan
 * lentamente sobre asfalto (oscuro) u hormigón (claro), más una trama de
 * calzada muy sutil. Solo usa Animated nativo, sin WebGL.
 */
export function AuroraBackground({ children, style, variante = "claro", barra, ...props }: Props) {
  const { width, height } = useWindowDimensions();
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = (v: Animated.Value, ms: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
    const la = loop(a, 9000);
    const lb = loop(b, 13000);
    la.start();
    lb.start();
    return () => {
      la.stop();
      lb.stop();
    };
  }, [a, b]);

  const oscuro = variante === "oscuro";
  const tam = Math.max(width, 360) * 1.25;
  const traza = oscuro ? "#ffffff" : "#000000";
  return (
    <View style={[styles.root, { backgroundColor: oscuro ? M.asfalto : M.hormigon100 }, style]} {...props}>
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", top: -tam * 0.45, right: -tam * 0.35, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] }) }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) }] }}
      >
        <Halo id="h1" color={M.amarillo} tam={tam} opacidad={oscuro ? 0.5 : 0.28} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", bottom: -tam * 0.55, left: -tam * 0.4, transform: [{ translateX: b.interpolate({ inputRange: [0, 1], outputRange: [20, -30] }) }, { translateY: b.interpolate({ inputRange: [0, 1], outputRange: [30, -20] }) }] }}
      >
        <Halo id="h2" color={oscuro ? "#5B6CFF" : "#FFD452"} tam={tam} opacidad={oscuro ? 0.22 : 0.18} />
      </Animated.View>
      {/* Trama de calzada */}
      <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill} opacity={oscuro ? 0.035 : 0.035}>
        <Defs>
          <Pattern id="trama" width="28" height="28" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="27.5" x2="28" y2="27.5" stroke={traza} strokeWidth="1" />
            <Line x1="27.5" y1="0" x2="27.5" y2="28" stroke={traza} strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} fill="url(#trama)" />
      </Svg>
      <StatusBar style={barra ?? (oscuro ? "light" : "dark")} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
});
