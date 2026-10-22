import { apiClient } from "@/services/api-client";
import type {
  Dashboard,
  MapaRuta,
  PeriodoFiltro,
  RankingRepartidores,
  ReporteEnvios,
  ReporteEnviosFiltro,
  ReporteIncidencias,
} from "./types";

export async function obtenerDashboard(fecha?: string): Promise<Dashboard> {
  const { data } = await apiClient.get<Dashboard>("/operaciones/dashboard", {
    params: { fecha: fecha || undefined },
  });
  return data;
}

export async function obtenerMapaRuta(id: string): Promise<MapaRuta> {
  const { data } = await apiClient.get<MapaRuta>(`/rutas/${id}/mapa`);
  return data;
}

export async function reporteEnvios(filtro: ReporteEnviosFiltro): Promise<ReporteEnvios> {
  const { data } = await apiClient.get<ReporteEnvios>("/reportes/envios", {
    params: { desde: filtro.desde, hasta: filtro.hasta, estado: filtro.estado || undefined, formato: "json" },
  });
  return data;
}

/** HU-13: descarga el CSV (auth por header, por eso blob + <a download>). */
export async function descargarReporteEnviosCSV(filtro: ReporteEnviosFiltro): Promise<void> {
  const res = await apiClient.get<Blob>("/reportes/envios", {
    params: { desde: filtro.desde, hasta: filtro.hasta, estado: filtro.estado || undefined, formato: "csv" },
    responseType: "blob",
  });
  const disposition = String(res.headers?.["content-disposition"] ?? "");
  const nombre =
    /filename="?([^";]+)"?/i.exec(disposition)?.[1] ??
    `reporte_envios_${filtro.desde.replaceAll("-", "")}_${filtro.hasta.replaceAll("-", "")}.csv`;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function rankingRepartidores(periodo: PeriodoFiltro): Promise<RankingRepartidores> {
  const { data } = await apiClient.get<RankingRepartidores>("/reportes/repartidores", { params: periodo });
  return data;
}

export async function reporteIncidencias(periodo: PeriodoFiltro): Promise<ReporteIncidencias> {
  const { data } = await apiClient.get<ReporteIncidencias>("/reportes/incidencias", { params: periodo });
  return data;
}
