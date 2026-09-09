import { apiClient } from "@/services/api-client";
import type { CrearEnvioInput, CrearEnvioResponse, EnvioDetalle, EnviosFiltro, EnvioListItem } from "./types";

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
