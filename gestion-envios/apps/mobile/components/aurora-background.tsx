import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions, type ViewProps } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

type AuroraBackgroundProps = ViewProps & {
  colorStops?: [string, string, string];
  speed?: number;
  amplitude?: number;
  blend?: number;
};

/**
 * Aurora de bajo costo para Expo. Conserva la idea de tres colores, amplitud,
 * mezcla y desplazamiento del componente de referencia, sin usar WebGL/OGL.
 */
export function AuroraBackground({
  children,
  style,
  colorStops = ["#FFE169", "#C8B3FF", "#9FD6FF"],
  speed = 0.5,
  amplitude = 1,
  blend = 0.58,
  ...props
}: AuroraBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const driftA = useRef(new Animated.Value(0)).current;
  const driftB = useRef(new Animated.Value(0)).current;
  const safeSpeed = Math.max(speed, 0.2);
  const travel = 46 * amplitude;

  useEffect(() => {
    const animationA = Animated.loop(
      Animated.sequence([
        Animated.timing(driftA, { toValue: 1, duration: 24000 / safeSpeed, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(driftA, { toValue: 0, duration: 24000 / safeSpeed, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const animationB = Animated.loop(
      Animated.sequence([
        Animated.timing(driftB, { toValue: 1, duration: 31000 / safeSpeed, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(driftB, { toValue: 0, duration: 31000 / safeSpeed, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    animationA.start();
    animationB.start();
    return () => { animationA.stop(); animationB.stop(); };
  }, [driftA, driftB, safeSpeed]);

  const ribbonWidth = Math.max(width * 1.72, 620);
  const ribbonHeight = Math.max(height * 0.94, 530);
  const glowSize = Math.max(width * 1.08, 360);
  const primaryTransform = {
    transform: [
      { translateX: driftA.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] }) },
      { translateY: driftA.interpolate({ inputRange: [0, 1], outputRange: [-travel * 0.28, travel * 0.28] }) },
      { scale: driftA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] }) },
    ],
  };
  const secondaryTransform = {
    transform: [
      { translateX: driftB.interpolate({ inputRange: [0, 1], outputRange: [travel * 0.45, -travel * 0.45] }) },
      { translateY: driftB.interpolate({ inputRange: [0, 1], outputRange: [travel * 0.25, -travel * 0.4] }) },
      { scale: driftB.interpolate({ inputRange: [0, 1], outputRange: [1.02, 0.98] }) },
    ],
  };

  return (
    <View style={[styles.root, style]} {...props}>
      <Animated.View pointerEvents="none" style={[styles.glow, styles.glowGold, { width: glowSize, height: glowSize }, primaryTransform]} />
      <Animated.View pointerEvents="none" style={[styles.glow, styles.glowLilac, { width: glowSize * 1.08, height: glowSize * 1.08 }, secondaryTransform]} />
      <Animated.View pointerEvents="none" style={[styles.glow, styles.glowBlue, { width: glowSize * 0.9, height: glowSize * 0.9 }, primaryTransform]} />
      <Animated.View pointerEvents="none" style={[styles.ribbon, { opacity: Math.max(blend * 1.32, 0.76) }, primaryTransform]}>
        <Svg width={ribbonWidth} height={ribbonHeight} viewBox="0 0 720 560">
          <Defs>
            <LinearGradient id="aurora-primary" x1="0" y1="0" x2="1" y2="0.35">
              <Stop offset="0" stopColor={colorStops[0]} stopOpacity="0.9" />
              <Stop offset="0.5" stopColor={colorStops[1]} stopOpacity="0.78" />
              <Stop offset="1" stopColor={colorStops[2]} stopOpacity="0.72" />
            </LinearGradient>
            <LinearGradient id="aurora-fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.8" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <Path d="M-90,330 C30,126 158,408 321,226 C441,91 582,104 808,258 L808,605 L-90,605 Z" fill="url(#aurora-primary)" />
          <Path d="M-80,316 C98,172 185,426 365,246 C498,113 607,168 808,284 L808,560 L-80,560 Z" fill="url(#aurora-fade)" opacity="0.32" />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.ribbonSecondary, { opacity: Math.max(blend * 0.92, 0.52) }, secondaryTransform]}>
        <Svg width={ribbonWidth} height={ribbonHeight} viewBox="0 0 720 560">
          <Defs>
            <LinearGradient id="aurora-secondary" x1="0.1" y1="0" x2="0.92" y2="0.8">
              <Stop offset="0" stopColor={colorStops[2]} stopOpacity="0.18" />
              <Stop offset="0.5" stopColor={colorStops[1]} stopOpacity="0.56" />
              <Stop offset="1" stopColor={colorStops[0]} stopOpacity="0.2" />
            </LinearGradient>
          </Defs>
          <Path d="M-120,440 C82,238 226,507 398,330 C532,191 652,297 820,354 L820,620 L-120,620 Z" fill="url(#aurora-secondary)" />
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={styles.softLight} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EFEDF8", overflow: "hidden" },
  ribbon: { position: "absolute", top: -80, left: -130 },
  ribbonSecondary: { position: "absolute", top: 138, left: -98 },
  glow: { position: "absolute", borderRadius: 999, opacity: 0.72 },
  glowGold: { top: -150, left: -128, backgroundColor: "#FFD948" },
  glowLilac: { top: 182, right: -185, backgroundColor: "#C7B7FF" },
  glowBlue: { bottom: -124, left: -74, backgroundColor: "#A4D8FF" },
  softLight: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(255,255,255,0.07)" },
});
