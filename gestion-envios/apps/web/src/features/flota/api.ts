import { API_URL, TOKEN_STORAGE_KEY, apiClient } from "@/services/api-client";
import type { TrayectoEnvio, Vehiculo, VehiculoDetalle, VehiculoInput } from "./types";

export async function listarFlota(fecha?: string): Promise<Vehiculo[]> {
  const { data } = await apiClient.get<Vehiculo[]>("/operaciones/flota", { params: fecha ? { fecha } : undefined });
  return data;
}

export async function obtenerVehiculo(id: string): Promise<VehiculoDetalle> {
  const { data } = await apiClient.get<VehiculoDetalle>(`/operaciones/flota/${id}`);
  return data;
}

export async function crearVehiculo(input: VehiculoInput): Promise<Vehiculo> {
  const { data } = await apiClient.post<Vehiculo>("/vehiculos", input);
  return data;
}

export async function actualizarVehiculo(id: string, input: VehiculoInput): Promise<Vehiculo> {
  const { data } = await apiClient.put<Vehiculo>(`/vehiculos/${id}`, input);
  return data;
}

export async function eliminarVehiculo(id: string): Promise<void> {
  await apiClient.delete(`/vehiculos/${id}`);
}

/** Asigna el vehículo a la ruta; con vehiculoId vacío lo quita. */
export async function asignarVehiculoARuta(rutaId: string, vehiculoId: string): Promise<void> {
  await apiClient.put(`/rutas/${rutaId}/vehiculo`, { vehiculo_id: vehiculoId });
}

export async function obtenerTrayecto(envioId: string): Promise<TrayectoEnvio> {
  const { data } = await apiClient.get<TrayectoEnvio>(`/envios/${envioId}/trayecto`);
  return data;
}

/** URL del stream SSE de posiciones (EventSource no manda headers: el token va en la query). */
export function urlStreamFlota(): string {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
  const base = API_URL.replace(/\/$/, "");
  const absoluta = base.startsWith("http") ? base : `${window.location.origin}${base}`;
  return `${absoluta}/operaciones/flota/stream?access_token=${encodeURIComponent(token)}`;
}
