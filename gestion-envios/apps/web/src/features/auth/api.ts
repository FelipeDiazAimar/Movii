import { API_URL, apiClient } from "@/services/api-client";
import type { DesafioLogin, LoginInput, RegistroInput, UsuarioCreado } from "./types";

/**
 * Respuesta de POST /auth/login: el token directo o, si el usuario tiene
 * celular, el desafío del segundo paso (código de 6 dígitos por WhatsApp).
 */
export type LoginRespuesta = { token: string } | ({ requiere_codigo: true } & DesafioLogin);

export async function login(input: LoginInput): Promise<LoginRespuesta> {
  const { data } = await apiClient.post<LoginRespuesta>("/auth/login", input);
  return data;
}

/** Segundo paso del login (HU-16): canjea el código de WhatsApp por el token. */
export async function verificarCodigo(desafioId: string, codigo: string): Promise<{ token: string }> {
  const { data } = await apiClient.post<{ token: string }>("/auth/login/verificar", { desafio_id: desafioId, codigo });
  return data;
}

/** Manda un código nuevo (invalida el anterior). */
export async function reenviarCodigo(desafioId: string): Promise<DesafioLogin> {
  const { data } = await apiClient.post<DesafioLogin>("/auth/login/reenviar", { desafio_id: desafioId });
  return data;
}

/** Primer acceso (T1): guarda la contraseña nueva y manda el código por WhatsApp o mail. */
export async function cambiarPasswordPrimerAcceso(userId: string, token: string, nuevaPassword: string): Promise<DesafioLogin> {
  const { data } = await apiClient.post<DesafioLogin>("/auth/primer-acceso/cambiar-password", {
    user_id: userId,
    token,
    nueva_password: nuevaPassword,
  });
  return data;
}

/** Primer acceso (T1): canjea el código por el token de sesión. */
export async function verificarPrimerAcceso(desafioId: string, codigo: string): Promise<{ token: string }> {
  const { data } = await apiClient.post<{ token: string }>("/auth/primer-acceso/verificar", { desafio_id: desafioId, codigo });
  return data;
}

/** Primer acceso (T1): manda un código nuevo (invalida el anterior). */
export async function reenviarPrimerAcceso(desafioId: string): Promise<DesafioLogin> {
  const { data } = await apiClient.post<DesafioLogin>("/auth/primer-acceso/reenviar", { desafio_id: desafioId });
  return data;
}

/** Métodos de login disponibles (T2): sin GOOGLE_* en la API, google es false. */
export async function obtenerConfigAuth(): Promise<{ google: boolean }> {
  const { data } = await apiClient.get<{ google: boolean }>("/auth/config");
  return data;
}

/** URL a la que se navega para entrar con Google (la API redirige a Google y vuelve a /login). */
export function urlLoginGoogle(): string {
  return `${API_URL}/auth/google`;
}

/** Alta de usuario (HU-01, CA-06). Requiere estar logueado como admin. */
export async function registrarUsuario(input: RegistroInput): Promise<UsuarioCreado> {
  const { data } = await apiClient.post<UsuarioCreado>("/auth/register", input);
  return data;
}
