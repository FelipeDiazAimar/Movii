/** Lógica pura del mapa de ruta (HU-12), sin dependencias de React Native. */
import type { EstadoEnvioAPI, MapaRutaAPI, ParadaMapaAPI } from "@/lib/api-client";

export type ParadaConUbicacion = ParadaMapaAPI & { coordenadas: { lat: number; lng: number } };

export const paradasConUbicacion = (mapa: MapaRutaAPI): ParadaConUbicacion[] =>
  mapa.paradas.filter((p): p is ParadaConUbicacion => p.coordenadas !== null);

export const paradasSinUbicacion = (mapa: MapaRutaAPI): ParadaMapaAPI[] => mapa.paradas.filter((p) => p.coordenadas === null);

/** Región que contiene todas las paradas con 40 % de margen (y un mínimo para una sola parada). */
export function regionInicial(paradas: ParadaConUbicacion[]) {
  if (paradas.length === 0) return null;
  const lats = paradas.map((p) => p.coordenadas.lat);
  const lngs = paradas.map((p) => p.coordenadas.lng);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.01),
  };
}

/** Mismos tonos que StatusBadge (components/ui/status-badge.tsx). */
export function colorEstado(estado: EstadoEnvioAPI): string {
  if (estado === "entregado") return "#34C759";
  if (estado === "en_camino") return "#FF9F0A";
  if (estado === "no_entregado") return "#FF3B30";
  return "#8E8E93";
}
