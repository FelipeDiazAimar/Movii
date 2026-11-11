import { Tabs } from "expo-router";

import { BarraTabs, type PropsBarra } from "@/components/barra-tabs";

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <BarraTabs {...(props as unknown as PropsBarra)} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Ruta" }} />
      <Tabs.Screen name="orders" options={{ title: "Pedidos" }} />
      <Tabs.Screen name="history" options={{ title: "Historial" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
