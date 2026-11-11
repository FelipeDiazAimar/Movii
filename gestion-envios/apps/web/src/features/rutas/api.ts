import { apiClient } from "@/services/api-client";
import type { Recomendacion, RutaDetalle, RutaInput, RutaListItem, RutasFiltro } from "./types";

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

export async function asignarEnvios(rutaId: string, envioIds: string[], forzar = false): Promise<{ asignados: number }> {
  const { data } = await apiClient.post<{ asignados: number }>(`/rutas/${rutaId}/envios`, { envio_ids: envioIds, forzar });
  return data;
}

/** T4: valida la dirección del envío y estima el desvío que causa en la ruta. */
export async function recomendarEnvio(rutaId: string, envioId: string): Promise<Recomendacion> {
  const { data } = await apiClient.post<Recomendacion>(`/rutas/${rutaId}/recomendar`, { envio_id: envioId });
  return data;
}

export async function desasignarEnvio(rutaId: string, envioId: string): Promise<void> {
  await apiClient.delete(`/rutas/${rutaId}/envios/${envioId}`);
}

export async function eliminarRuta(id: string): Promise<void> {
  await apiClient.delete(`/rutas/${id}`);
}

/** La ruta sale del depósito: todos sus envíos asignados pasan a "en camino". */
export async function iniciarRuta(rutaId: string): Promise<{ envios_en_camino: number }> {
  const { data } = await apiClient.post<{ envios_en_camino: number }>(`/rutas/${rutaId}/iniciar`);
  return data;
}
