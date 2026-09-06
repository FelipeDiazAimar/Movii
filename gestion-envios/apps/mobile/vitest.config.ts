import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // __DEV__ lo inyecta Metro en runtime normal; expo-modules-core lo lee al
  // importarse (vía expo-secure-store), así que vitest necesita definirlo.
  define: {
    __DEV__: "false",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url).href),
      // react-native ships algunos archivos con sintaxis Flow que Vite/Rollup
      // no puede parsear fuera de Metro/Babel. react-native-web es JS/TS
      // estándar y ya es dependencia del proyecto (soporte web de Expo), así
      // que alcanza para testear con vitest la lógica que solo importa
      // Platform/APIs básicas de react-native (no vistas nativas reales).
      "react-native": "react-native-web",
      // Necesita bindings nativos que no existen bajo Node; ver el stub.
      "expo-secure-store": fileURLToPath(new URL("./tests/mocks/expo-secure-store.ts", import.meta.url).href),
    },
  },
});
