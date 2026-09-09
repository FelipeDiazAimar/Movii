import { apiClient } from "@/services/api-client";
import type { LoginInput, RegistroInput, UsuarioCreado } from "./types";

export async function login(input: LoginInput): Promise<{ token: string }> {
  const { data } = await apiClient.post<{ token: string }>("/auth/login", input);
  return data;
}

/** Alta de usuario (HU-01, CA-06). Requiere estar logueado como supervisor. */
export async function registrarUsuario(input: RegistroInput): Promise<UsuarioCreado> {
  const { data } = await apiClient.post<UsuarioCreado>("/auth/register", input);
  return data;
}
