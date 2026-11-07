import { apiClient } from "@/services/api-client";
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

/** Alta de usuario (HU-01, CA-06). Requiere estar logueado como supervisor. */
export async function registrarUsuario(input: RegistroInput): Promise<UsuarioCreado> {
  const { data } = await apiClient.post<UsuarioCreado>("/auth/register", input);
  return data;
}
