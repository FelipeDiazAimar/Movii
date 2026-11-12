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

/** Dónde está un punto sobre la ruta: el tramo (`indice` = vértice de salida), el punto proyectado y qué tan lejos quedó. */
export interface PuntoEnRuta {
  indice: number;
  punto: LatLng;
  distanciaM: number;
}

/**
 * Proyecta un punto sobre la polilínea: el tramo más cercano a partir del tramo `desde`.
 * Se proyecta sobre el segmento (no solo sobre los vértices) porque entre dos paradas el
 * trazado puede ser una recta larga y el camión va por la mitad.
 */
export function proyectarEnRuta(linea: LatLng[], p: LatLng, desde = 0): PuntoEnRuta | null {
  if (linea.length < 2) return null;
  let mejor: PuntoEnRuta | null = null;
  for (let i = Math.max(0, desde); i < linea.length - 1; i++) {
    const a = linea[i];
    const b = linea[i + 1];
    const kx = M_POR_GRADO * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
    const abx = (b[1] - a[1]) * kx;
    const aby = (b[0] - a[0]) * M_POR_GRADO;
    const apx = (p[1] - a[1]) * kx;
    const apy = (p[0] - a[0]) * M_POR_GRADO;
    const largo2 = abx * abx + aby * aby;
    const t = largo2 === 0 ? 0 : Math.min(1, Math.max(0, (apx * abx + apy * aby) / largo2));
    const q: LatLng = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const d = distanciaM(q, p);
    if (!mejor || d < mejor.distanciaM) mejor = { indice: i, punto: q, distanciaM: d };
  }
  return mejor;
}

/** Hasta dónde se tolera que el camión se aparte de la ruta para seguir buscándolo "hacia adelante". */
const TOLERANCIA_M = 80;

/**
 * Ubica al camión sobre la ruta completa sin saltar hacia atrás: si ya se sabía en qué tramo
 * estaba (`previo`), se busca desde ahí, así una calle que la ruta recorre dos veces (ida y vuelta)
 * no confunde el avance. Si el camión quedó lejos de ese tramo (la demo se reinició, el GPS saltó),
 * se vuelve a buscar en toda la ruta.
 */
export function ubicarEnRuta(linea: LatLng[], camion: LatLng, previo?: number): PuntoEnRuta | null {
  if (previo !== undefined && previo > 0) {
    const adelante = proyectarEnRuta(linea, camion, previo);
    if (adelante && adelante.distanciaM <= TOLERANCIA_M) return adelante;
  }
  return proyectarEnRuta(linea, camion, 0);
}

function mismoPunto(a: LatLng, b: LatLng): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * Parte el recorrido donde está el camión: lo ya andado y lo que falta. Los dos tramos comparten
 * el punto del camión (sin hueco) y juntos cubren la ruta entera. `indice` es el tramo en que está.
 */
export function partirRecorrido(linea: LatLng[], camion: LatLng, previo?: number): { hecho: LatLng[]; resto: LatLng[]; indice: number } {
  const u = ubicarEnRuta(linea, camion, previo);
  if (!u) return { hecho: [], resto: linea, indice: 0 };
  const antes = linea.slice(0, u.indice + 1);
  const despues = linea.slice(u.indice + 1);
  const hecho = mismoPunto(antes[antes.length - 1], u.punto) ? antes : [...antes, u.punto];
  const resto = despues.length > 0 && mismoPunto(despues[0], u.punto) ? despues : [u.punto, ...despues];
  return { hecho, resto, indice: u.indice };
}
