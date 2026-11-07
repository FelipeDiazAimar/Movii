import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { api, decodeJwt, leerVueltaGoogle, saveToken, type ClaimsJWT, type DesafioLogin } from "@/lib/api-client";

/** Error de Google con un mensaje listo para mostrar. */
export class ErrorLoginGoogle extends Error {}

/**
 * Login con Google (T2): abre GET /auth/google en el navegador del sistema y
 * espera la vuelta a movii://auth (exp://.../--/auth en Expo Go). Devuelve la
 * sesión (token ya guardado en SecureStore), el desafío del código si tenía el
 * primer acceso pendiente, o null si el usuario cerró el navegador.
 * (Separado de api-client porque expo-web-browser no corre bajo vitest.)
 */
export async function loginConGoogle(): Promise<(ClaimsJWT & { token: string }) | DesafioLogin | null> {
  const volver = Linking.createURL("auth");
  const r = await WebBrowser.openAuthSessionAsync(`${api.defaults.baseURL}/auth/google?redirect_uri=${encodeURIComponent(volver)}`, volver);
  if (r.type !== "success") return null;
  const v = leerVueltaGoogle(r.url);
  if (v.error) throw new ErrorLoginGoogle(v.error);
  if (v.desafio) return v.desafio;
  await saveToken(v.token!);
  return { ...decodeJwt(v.token!), token: v.token! };
}
