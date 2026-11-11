import type { LatLng } from "./types";

const M_POR_GRADO = 111_320;

/** Distancia aproximada en metros entre dos puntos cercanos (ciudad): sobra para dibujar y estimar. */
export function distanciaM(a: LatLng, b: LatLng): number {
  const dLat = (a[0] - b[0]) * M_POR_GRADO;
  const dLng = (a[1] - b[1]) * M_POR_GRADO * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

/** Índice del vértice de la polilínea más cercano a un punto (-1 si está vacía). */
export function indiceMasCercano(linea: LatLng[], p: LatLng, desde = 0): number {
  let mejor = -1;
  let dMejor = Infinity;
  for (let i = Math.max(0, desde); i < linea.length; i++) {
    const d = distanciaM(linea[i], p);
    if (d < dMejor) {
      dMejor = d;
      mejor = i;
    }
  }
  return mejor;
}

/** Parte el recorrido donde está el camión: lo ya andado y lo que falta. */
export function partirRecorrido(linea: LatLng[], camion: LatLng): { hecho: LatLng[]; resto: LatLng[] } {
  const i = indiceMasCercano(linea, camion);
  if (i < 0) return { hecho: [], resto: linea };
  return { hecho: [...linea.slice(0, i + 1), camion], resto: [camion, ...linea.slice(i + 1)] };
}
