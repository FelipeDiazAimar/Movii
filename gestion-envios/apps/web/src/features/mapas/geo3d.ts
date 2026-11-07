/** Geometría para la vista 3D: avanzar sobre la ruta y dibujar el camión como cajas extruidas. */

export type LngLat = [number, number];

const M_POR_GRADO = 111_320;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia aproximada en metros entre dos puntos (equirectangular: sobra para tramos de ciudad). */
export function distanciaM(a: LngLat, b: LngLat): number {
  const x = (b[0] - a[0]) * M_POR_GRADO * Math.cos(rad((a[1] + b[1]) / 2));
  const y = (b[1] - a[1]) * M_POR_GRADO;
  return Math.hypot(x, y);
}

/** Rumbo de a hacia b en grados (0 = norte, sentido horario). */
export function rumbo(a: LngLat, b: LngLat): number {
  const x = (b[0] - a[0]) * Math.cos(rad((a[1] + b[1]) / 2));
  const y = b[1] - a[1];
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

/** Distancia acumulada hasta cada vértice de la línea. */
export function acumulados(linea: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < linea.length; i++) out.push(out[i - 1] + distanciaM(linea[i - 1], linea[i]));
  return out;
}

/** Punto y rumbo a `metros` del inicio de la línea (se acota a la línea). */
export function puntoEnDistancia(linea: LngLat[], acum: number[], metros: number): { pos: LngLat; rumbo: number } {
  if (linea.length === 0) return { pos: [0, 0], rumbo: 0 };
  if (linea.length === 1) return { pos: linea[0], rumbo: 0 };
  const total = acum[acum.length - 1];
  const m = Math.min(Math.max(metros, 0), total);
  let i = 1;
  while (i < acum.length - 1 && acum[i] < m) i++;
  const tramo = acum[i] - acum[i - 1] || 1;
  const t = (m - acum[i - 1]) / tramo;
  const a = linea[i - 1];
  const b = linea[i];
  return { pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], rumbo: rumbo(a, b) };
}

/** Distancia sobre la línea del vértice más cercano a un punto (para ubicar la posición en vivo). */
export function distanciaSobreLinea(linea: LngLat[], acum: number[], p: LngLat): number {
  let mejor = 0;
  let min = Infinity;
  linea.forEach((v, i) => {
    const d = distanciaM(v, p);
    if (d < min) {
      min = d;
      mejor = acum[i];
    }
  });
  return mejor;
}

/**
 * Rectángulo (anillo cerrado) de largo × ancho metros, orientado según el rumbo
 * y corrido `adelante` metros hacia el frente. Sirve para extruir el camión.
 */
export function caja(centro: LngLat, rumboG: number, largo: number, ancho: number, adelante = 0): LngLat[] {
  const b = rad(rumboG);
  const f: [number, number] = [Math.sin(b), Math.cos(b)]; // este, norte
  const r: [number, number] = [Math.cos(b), -Math.sin(b)];
  const kx = 1 / (M_POR_GRADO * Math.cos(rad(centro[1])));
  const ky = 1 / M_POR_GRADO;
  const punto = (l: number, w: number): LngLat => [
    centro[0] + (f[0] * (l + adelante) + r[0] * w) * kx,
    centro[1] + (f[1] * (l + adelante) + r[1] * w) * ky,
  ];
  const ring = [punto(largo / 2, -ancho / 2), punto(largo / 2, ancho / 2), punto(-largo / 2, ancho / 2), punto(-largo / 2, -ancho / 2)];
  return [...ring, ring[0]];
}

/** Interpola ángulos por el camino corto (evita el giro de 350° al cruzar el norte). */
export function mezclarAngulo(desde: number, hasta: number, t: number): number {
  const d = ((hasta - desde + 540) % 360) - 180;
  return (desde + d * t + 360) % 360;
}
