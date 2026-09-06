import { StyleSheet, Text, View } from "react-native";

import type { TimelineEvent } from "@/types/logistics";

export function ShipmentTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <View style={styles.root}>
      {events.map((event, index) => (
        <View style={styles.row} key={`${event.label}-${index}`}>
          <View style={styles.track}>
            <View style={[styles.dot, event.completed && styles.dotComplete]}>{event.completed ? <Text style={styles.check}>✓</Text> : null}</View>
            {index < events.length - 1 ? <View style={[styles.line, event.completed && styles.lineComplete]} /> : null}
          </View>
          <View style={styles.copy}>
            <Text style={[styles.label, event.completed && styles.labelComplete]}>{event.label}</Text>
            <Text style={styles.detail}>{event.detail}</Text>
            <Text style={styles.timestamp}>{event.timestamp}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 0 },
  row: { flexDirection: "row", minHeight: 72 },
  track: { width: 28, alignItems: "center" },
  dot: { width: 19, height: 19, borderRadius: 10, backgroundColor: "#E6E6EA", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#FFFFFF" },
  dotComplete: { backgroundColor: "#FFD60A" },
  check: { fontSize: 11, color: "#1C1C1E", fontWeight: "800" },
  line: { flex: 1, width: 2, backgroundColor: "#E6E6EA", marginVertical: 2 },
  lineComplete: { backgroundColor: "#FFD60A" },
  copy: { flex: 1, paddingLeft: 8, paddingBottom: 14 },
  label: { color: "#6E6E73", fontSize: 15, fontWeight: "700", lineHeight: 19 },
  labelComplete: { color: "#1C1C1E" },
  detail: { color: "#6E6E73", fontSize: 13, marginTop: 2 },
  timestamp: { color: "#AEAEB2", fontSize: 12, marginTop: 4 },
});
