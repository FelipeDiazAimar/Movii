import { apiClient } from "@/services/api-client";
import type {
  CambiarEstadoInput,
  CrearEnvioInput,
  CrearEnvioResponse,
  EnvioDetalle,
  EnviosFiltro,
  EnvioListItem,
  IncidenciaInput,
  ReprogramacionInput,
  TrackingResponse,
} from "./types";

export async function listarEnvios(filtro: EnviosFiltro = {}): Promise<EnvioListItem[]> {
  const { data } = await apiClient.get<EnvioListItem[]>("/envios", {
    params: {
      estado: filtro.estado || undefined,
      fecha: filtro.fecha || undefined,
    },
  });
  return data;
}

export async function obtenerEnvio(id: string): Promise<EnvioDetalle> {
  const { data } = await apiClient.get<EnvioDetalle>(`/envios/${id}`);
  return data;
}

export async function crearEnvio(input: CrearEnvioInput): Promise<CrearEnvioResponse> {
  const { data } = await apiClient.post<CrearEnvioResponse>("/envios", input);
  return data;
}

export async function cambiarEstado(id: string, input: CambiarEstadoInput): Promise<EnvioDetalle> {
  const { data } = await apiClient.put<EnvioDetalle>(`/envios/${id}/estado`, input);
  return data;
}

export async function registrarIncidencia(id: string, input: IncidenciaInput): Promise<EnvioDetalle> {
  const { data } = await apiClient.post<EnvioDetalle>(`/envios/${id}/incidencia`, input);
  return data;
}

export async function reprogramarEnvio(id: string, input: ReprogramacionInput): Promise<EnvioDetalle> {
  const { data } = await apiClient.post<EnvioDetalle>(`/envios/${id}/reprogramacion`, input);
  return data;
}

export async function obtenerTracking(codigo: string): Promise<TrackingResponse> {
  const { data } = await apiClient.get<TrackingResponse>(`/tracking/${codigo}`);
  return data;
}
