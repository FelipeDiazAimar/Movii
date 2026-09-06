import { useMemo, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

type Point = { x: number; y: number };

export function SignaturePad({ onChange }: { onChange: (signed: boolean) => void }) {
  const [points, setPoints] = useState<Point[]>([]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      setPoints([point]);
      onChange(true);
    },
    onPanResponderMove: (event) => {
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      setPoints((current) => [...current, point]);
    },
  }), [onChange]);
  const coordinates = points.map((point) => `${point.x},${point.y}`).join(" ");
  const clear = () => { setPoints([]); onChange(false); };
  return (
    <View style={styles.wrap}>
      <View {...responder.panHandlers} style={styles.pad} accessibilityRole="image" accessibilityLabel="Área para capturar firma digital">
        {points.length > 1 ? <Svg style={StyleSheet.absoluteFill}><Polyline points={coordinates} fill="none" stroke="#1C1C1E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></Svg> : <Text style={styles.hint}>Firmá con el dedo aquí</Text>}
        <View style={styles.signatureLine} />
      </View>
      <Pressable onPress={clear} style={({ pressed }) => [styles.clear, pressed && styles.pressed]}><Text style={styles.clearText}>Limpiar firma</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  pad: { height: 142, borderRadius: 16, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", justifyContent: "center", alignItems: "center" },
  hint: { color: "#AEAEB2", fontSize: 14 },
  signatureLine: { position: "absolute", left: 22, right: 22, bottom: 31, height: 1, backgroundColor: "#D1D1D6" },
  clear: { alignSelf: "flex-end", minHeight: 30, justifyContent: "center" },
  clearText: { color: "#806700", fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.6 },
});
