import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 9);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1C1C1E",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: [styles.tabBar, { height: 59 + bottomPadding, paddingBottom: bottomPadding }],
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Ruta", tabBarIcon: ({ color, focused }) => <MaterialIcons name="route" size={23} color={focused ? "#B28C00" : color} /> }} />
      <Tabs.Screen name="history" options={{ title: "Historial", tabBarIcon: ({ color, focused }) => <MaterialIcons name="history" size={23} color={focused ? "#B28C00" : color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarIcon: ({ color, focused }) => <MaterialIcons name="person-outline" size={24} color={focused ? "#B28C00" : color} /> }} />
      <Tabs.Screen name="design" options={{ title: "Sistema", tabBarIcon: ({ color, focused }) => <MaterialIcons name="palette" size={22} color={focused ? "#B28C00" : color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: "rgba(255,255,255,0.94)", borderTopWidth: 0.5, borderTopColor: "#E6E6EA", paddingTop: 7, elevation: 8, shadowColor: "#11111A", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: -4 } },
  tabLabel: { fontSize: 10, fontWeight: "700", marginTop: -2 },
  tabItem: { paddingTop: 1 },
});
