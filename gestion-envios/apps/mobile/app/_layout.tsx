import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { MoviiProvider } from "@/lib/movii-context";
import { ThemeProvider } from "@/lib/theme-provider";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <MoviiProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="forgot-password" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="stop/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="pedido/[codigo]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="route-map" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="delivery/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="failure/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="reschedule/[id]" options={{ presentation: "modal" }} />
        </Stack>
      </MoviiProvider>
    </ThemeProvider>
  );
}
