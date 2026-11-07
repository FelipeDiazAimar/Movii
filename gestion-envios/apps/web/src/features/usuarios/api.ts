import { apiClient } from "@/services/api-client";
import type { Rol } from "@/features/auth/types";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  /** Formato internacional sin "+" (5493564412345); vacío si no tiene. */
  telefono: string;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const { data } = await apiClient.get<Usuario[]>("/users");
  return data;
}

export interface RepartidorOpcion {
  id: string;
  nombre: string;
}

/** Repartidores activos para elegir en una ruta; disponible para operadores (GET /users es solo supervisor). */
export async function listarRepartidores(): Promise<RepartidorOpcion[]> {
  const { data } = await apiClient.get<RepartidorOpcion[]>("/repartidores");
  return data;
}
