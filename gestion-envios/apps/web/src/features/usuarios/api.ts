import { apiClient } from "@/services/api-client";
import type { Rol } from "@/features/auth/types";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const { data } = await apiClient.get<Usuario[]>("/users");
  return data;
}
