import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { M } from "@/constants/movii-design";

/** Entrada escalonada: aparece subiendo y con fundido (estilo React Bits "Animated Content"). */
export function Aparecer({ children, indice = 0, style, desde = 18 }: { children: ReactNode; indice?: number; style?: StyleProp<ViewStyle>; desde?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay: Math.min(indice, 12) * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, indice]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [desde, 0] }) }] }]}>{children}</Animated.View>
  );
}

/** Número que cuenta hasta su valor (React Bits "Count Up"). */
export function NumeroAnimado({ valor, sufijo = "", style, duracion = 900 }: { valor: number; sufijo?: string; style?: StyleProp<TextStyle>; duracion?: number }) {
  const [mostrado, setMostrado] = useState(0);
  const anterior = useRef(0);
  useEffect(() => {
    const desde = anterior.current;
    const v = new Animated.Value(0);
    const id = v.addListener(({ value }) => setMostrado(Math.round(desde + (valor - desde) * value)));
    Animated.timing(v, { toValue: 1, duration: duracion, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      anterior.current = valor;
    });
    return () => v.removeListener(id);
  }, [valor, duracion]);
  return <Text style={style}>{mostrado}{sufijo}</Text>;
}

/** Botón/superficie que responde al toque con un resorte. */
export function Presionable({ children, style, onPress, escala = 0.97, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; escala?: number; children: ReactNode }) {
  const [s] = useState(() => new Animated.Value(1));
  const a = (to: number) => Animated.spring(s, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable {...rest} onPress={onPress} onPressIn={() => a(escala)} onPressOut={() => a(1)}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Destello que cruza una superficie cada tanto (React Bits "Shiny"). */
export function Brillo({ radio = 14, intervalo = 3400 }: { radio?: number; intervalo?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(intervalo),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, intervalo]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radio, overflow: "hidden" }]} onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)}>
      <Animated.View
        style={{
          position: "absolute",
          top: -20,
          bottom: -20,
          width: 46,
          backgroundColor: "rgba(255,255,255,0.45)",
          transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-80, ancho + 80] }) }, { rotate: "18deg" }],
        }}
      />
    </View>
  );
}

/** Línea de carril discontinua que avanza (la misma del panel web). */
export function Carril({ color = M.amarillo, alto = 4, opacidad = 0.85, velocidad = 1400 }: { color?: string; alto?: number; opacidad?: number; velocidad?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const l = Animated.loop(Animated.timing(v, { toValue: 1, duration: velocidad, easing: Easing.linear, useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, [v, velocidad]);
  const tramo = 22;
  const cantidad = 40;
  return (
    <View style={{ height: alto, overflow: "hidden", opacity: opacidad }}>
      <Animated.View style={{ flexDirection: "row", width: tramo * 2 * cantidad, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-tramo * 2, 0] }) }] }}>
        {Array.from({ length: cantidad }, (_, i) => (
          <View key={i} style={{ width: tramo, height: alto, marginRight: tramo, backgroundColor: color, borderRadius: alto / 2 }} />
        ))}
      </Animated.View>
    </View>
  );
}

/** Punto que late (estado "en vivo"). */
export function PuntoVivo({ color = M.verde, tam = 9 }: { color?: string; tam?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const l = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, [v]);
  return (
    <View style={{ width: tam, height: tam }}>
      <Animated.View style={{ position: "absolute", inset: 0, borderRadius: tam, backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }) }] }} />
      <View style={{ width: tam, height: tam, borderRadius: tam, backgroundColor: color }} />
    </View>
  );
}
