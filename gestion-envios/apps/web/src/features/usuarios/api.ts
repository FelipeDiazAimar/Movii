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

/** Repartidores activos para elegir en una ruta; disponible para operadores (GET /users es solo admin). */
export async function listarRepartidores(): Promise<RepartidorOpcion[]> {
  const { data } = await apiClient.get<RepartidorOpcion[]>("/repartidores");
  return data;
}

/** Repartidor con su carga del día y cercanía a la ruta (GET /repartidores/sugeridos). */
export interface RepartidorSugerido {
  id: string;
  nombre: string;
  rutas: number;
  envios: number;
  peso_kg: number;
  en_curso: boolean;
  distancia_km: number | null;
  actual: boolean;
  recomendado: boolean;
  motivo: string;
}

/** Con rutaId mide cercanía a esa ruta; sin ella solo la carga de la fecha. */
export async function repartidoresSugeridos(params: { rutaId?: string; fecha?: string }): Promise<RepartidorSugerido[]> {
  const { data } = await apiClient.get<RepartidorSugerido[]>("/repartidores/sugeridos", {
    params: { ruta_id: params.rutaId || undefined, fecha: params.fecha || undefined },
  });
  return data;
}

export async function eliminarUsuario(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
