import { apiClient } from "@/services/api-client";
import type { RutaDetalle, RutaInput, RutaListItem, RutasFiltro } from "./types";

export async function listarRutas(filtro: RutasFiltro = {}): Promise<RutaListItem[]> {
  const { data } = await apiClient.get<RutaListItem[]>("/rutas", {
    params: { fecha: filtro.fecha || undefined },
  });
  return data;
}

export async function obtenerRuta(id: string): Promise<RutaDetalle> {
  const { data } = await apiClient.get<RutaDetalle>(`/rutas/${id}`);
  return data;
}

export async function crearRuta(input: RutaInput): Promise<RutaListItem> {
  const { data } = await apiClient.post<RutaListItem>("/rutas", input);
  return data;
}

export async function editarRuta(id: string, input: RutaInput): Promise<RutaListItem> {
  const { data } = await apiClient.put<RutaListItem>(`/rutas/${id}`, input);
  return data;
}

export async function asignarEnvios(rutaId: string, envioIds: string[]): Promise<{ asignados: number }> {
  const { data } = await apiClient.post<{ asignados: number }>(`/rutas/${rutaId}/envios`, { envio_ids: envioIds });
  return data;
}

export async function desasignarEnvio(rutaId: string, envioId: string): Promise<void> {
  await apiClient.delete(`/rutas/${rutaId}/envios/${envioId}`);
}
