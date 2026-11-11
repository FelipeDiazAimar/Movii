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

/**
 * Hora estimada de llegada a cada parada: se recorre la polilínea desde el camión
 * (a la velocidad media del recorrido) y cada parada cuenta con el tramo hasta su
 * vértice más cercano. Las paradas van en el orden del recorrido, así que se busca
 * siempre hacia adelante. Devuelve el id → fecha de llegada.
 */
export function etaParadas(
  linea: LatLng[],
  camion: LatLng,
  paradas: { id: string; pos: LatLng }[],
  distanciaTotalM: number,
  duracionTotalS: number,
  ahora: Date,
): Record<string, Date> {
  const eta: Record<string, Date> = {};
  if (linea.length < 2 || duracionTotalS <= 0 || distanciaTotalM <= 0) return eta;
  const velocidadMs = distanciaTotalM / duracionTotalS;

  const acumulada = [0];
  for (let i = 1; i < linea.length; i++) acumulada.push(acumulada[i - 1] + distanciaM(linea[i - 1], linea[i]));
  const largo = acumulada[acumulada.length - 1];
  // La polilínea parte del camión: lo que mide de más o de menos que lo informado se reparte proporcionalmente.
  const escala = largo > 0 ? distanciaTotalM / largo : 1;
  const iCamion = indiceMasCercano(linea, camion);

  let desde = Math.max(0, iCamion);
  for (const p of paradas) {
    const i = indiceMasCercano(linea, p.pos, desde);
    if (i < 0) continue;
    desde = i;
    const metros = Math.max(0, (acumulada[i] - acumulada[Math.max(0, iCamion)]) * escala);
    eta[p.id] = new Date(ahora.getTime() + (metros / velocidadMs) * 1000);
  }
  return eta;
}

/** "14:35" en hora local. */
export function horaCorta(d: Date): string {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}
