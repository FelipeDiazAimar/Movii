export type PuntoMaps = { lat: number; lng: number } | string;
export type ModoMaps = "proximo" | "completo";

const MAX_WAYPOINTS = 9;

const aTexto = (p: PuntoMaps) => (typeof p === "string" ? p : `${p.lat},${p.lng}`);

/**
 * URL de Google Maps Directions. "proximo": origen -> primera parada.
 * "completo": origen -> última parada pasando por las del medio (máx 9 waypoints).
 * Devuelve null si no hay paradas.
 */
export function urlGoogleMaps({
  origen,
  paradas,
  modo,
}: {
  origen?: PuntoMaps;
  paradas: PuntoMaps[];
  modo: ModoMaps;
}): string | null {
  if (paradas.length === 0) return null;
  const params = new URLSearchParams({ api: "1" });
  if (origen) params.set("origin", aTexto(origen));
  if (modo === "proximo" || paradas.length === 1) {
    params.set("destination", aTexto(paradas[0]));
  } else {
    params.set("destination", aTexto(paradas[paradas.length - 1]));
    params.set("waypoints", paradas.slice(0, -1).slice(0, MAX_WAYPOINTS).map(aTexto).join("|"));
  }
  params.set("travelmode", "driving");
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
