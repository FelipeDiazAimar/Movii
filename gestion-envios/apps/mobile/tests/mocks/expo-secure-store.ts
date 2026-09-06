// Stub de expo-secure-store para tests con vitest: el módulo real necesita
// bindings nativos (expo-modules-core) que no existen fuera de una app
// Expo/React Native en ejecución. Los tests unitarios de este proyecto solo
// ejercitan funciones puras (decodeJwt, mapEnvioDelDiaToShipment); este stub
// evita que vitest intente cargar el módulo nativo real al importar
// lib/api-client.ts.
const store = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return store.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}
