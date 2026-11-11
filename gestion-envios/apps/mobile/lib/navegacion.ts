import { router } from "expo-router";

/** Vuelve a la pantalla anterior; si se abrió directo (recarga o enlace) no hay historial y va al inicio. */
export function volverAtras() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}
