import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { M, SOMBRA } from "@/constants/movii-design";
import { haptic } from "@/lib/haptics";

const ICONOS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  index: "route",
  history: "history",
  profile: "person-outline",
};

/**
 * Barra inferior flotante: pastilla de asfalto con un indicador amarillo que
 * se desliza hasta la pestaña activa (como el "Pill Nav" de React Bits).
 */
export type PropsBarra = BottomTabBarProps;

export function BarraTabs({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [ancho, setAncho] = useState(0);
  const pos = useRef(new Animated.Value(state.index)).current;
  const n = state.routes.length;

  useEffect(() => {
    Animated.spring(pos, { toValue: state.index, useNativeDriver: true, speed: 16, bounciness: 9 }).start();
  }, [state.index, pos]);

  const interno = ancho - 12;
  const celda = interno / n;

  return (
    <View pointerEvents="box-none" style={[styles.contenedor, { paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 12 : 10) }]}>
      <View style={styles.barra} onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)}>
        {ancho > 0 ? (
          <Animated.View
            style={[styles.indicador, { width: celda, transform: [{ translateX: pos.interpolate({ inputRange: [0, n - 1], outputRange: [0, celda * (n - 1)] }) }] }]}
          />
        ) : null}
        {state.routes.map((route, i) => {
          const foco = state.index === i;
          const { options } = descriptors[route.key];
          const titulo = typeof options.title === "string" ? options.title : route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: foco }}
              accessibilityLabel={titulo}
              onPress={() => {
                const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!foco && !ev.defaultPrevented) {
                  haptic.selection();
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={styles.item}
            >
              <MaterialIcons name={ICONOS[route.name] ?? "circle"} size={22} color={foco ? M.asfalto : "#9A9AA0"} />
              <Text style={[styles.etiqueta, foco && styles.etiquetaActiva]}>{titulo}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingHorizontal: 18 },
  barra: { flexDirection: "row", width: "100%", maxWidth: 420, padding: 6, borderRadius: 26, backgroundColor: M.asfalto, borderWidth: 1, borderColor: M.asfalto4, ...SOMBRA.lift },
  indicador: { position: "absolute", top: 6, bottom: 6, left: 6, borderRadius: 20, backgroundColor: M.amarillo },
  item: { flex: 1, height: 54, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 1 },
  etiqueta: { color: "#9A9AA0", fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
  etiquetaActiva: { color: M.asfalto },
});
