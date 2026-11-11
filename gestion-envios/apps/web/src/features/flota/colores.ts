/** Color de cada estado de envío en el mapa y en la línea de paradas. */
export const COLOR_ESTADO: Record<string, string> = {
  entregado: "#16a34a",
  en_camino: "#d97706",
  asignado: "#2563eb",
  no_entregado: "#dc2626",
  pendiente: "#6b7280",
};

/** Paleta de rutas en el mapa: distinta de los colores de estado de las paradas. */
export const COLORES_RUTA = ["#f4b400", "#7c3aed", "#0ea5e9", "#ec4899", "#10b981", "#f97316", "#6366f1", "#14b8a6"];

/** Colores a elegir para un vehículo (caja, ruta en el mapa, aro del marcador). */
export const COLORES_VEHICULO: { nombre: string; hex: string }[] = [
  { nombre: "Amarillo", hex: "#f4b400" },
  { nombre: "Naranja", hex: "#f97316" },
  { nombre: "Rojo", hex: "#dc2626" },
  { nombre: "Rosa", hex: "#ec4899" },
  { nombre: "Violeta", hex: "#7c3aed" },
  { nombre: "Índigo", hex: "#6366f1" },
  { nombre: "Celeste", hex: "#0ea5e9" },
  { nombre: "Turquesa", hex: "#14b8a6" },
  { nombre: "Verde", hex: "#10b981" },
  { nombre: "Blanco", hex: "#e9ecef" },
  { nombre: "Gris", hex: "#6b7280" },
  { nombre: "Negro", hex: "#2a2f34" },
];

const HEX = /^#[0-9a-f]{6}$/i;

export function esHex(c: string | undefined | null): c is string {
  return Boolean(c) && HEX.test(c as string);
}

/**
 * Color "automático" de un vehículo: sale de un hash de su patente (o de su id),
 * así es siempre el mismo sin importar el orden en que llegue la flota.
 */
export function colorAutomatico(clave: string): string {
  // FNV-1a de 32 bits: simple, estable y bien repartido para textos cortos.
  let h = 0x811c9dc5;
  for (const ch of clave.trim().toUpperCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }
  return COLORES_RUTA[(h >>> 0) % COLORES_RUTA.length];
}

/**
 * Color de cada vehículo: el que se eligió al editarlo o, si es "automático",
 * uno de la paleta derivado de su patente (o de su id si no la tiene).
 */
export function colorDeFlota(vehiculos: { id: string; patente?: string; color?: string }[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const v of vehiculos) m[v.id] = esHex(v.color) ? v.color.toLowerCase() : colorAutomatico(v.patente || v.id);
  return m;
}

function mezclar(hex: string, con: [number, number, number], t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v + (con[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Tonos de la carrocería a partir de un color base. */
export function paletaCarroceria(hex: string) {
  const base = esHex(hex) ? hex : "#f4b400";
  return {
    base,
    claro: mezclar(base, [255, 255, 255], 0.35),
    oscuro: mezclar(base, [0, 0, 0], 0.28),
    nervio: mezclar(base, [0, 0, 0], 0.14),
  };
}

/** Negro o blanco, el que se lea mejor sobre ese color. */
export function textoSobre(hex: string): "#1a1a1a" | "#ffffff" {
  const n = parseInt((esHex(hex) ? hex : "#f4b400").slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? "#1a1a1a" : "#ffffff";
}

/** Paleta ofrecida al elegir el color de un vehículo. */
export const PALETA_VEHICULO = ["#f4b400", "#f97316", "#dc2626", "#ec4899", "#7c3aed", "#2563eb", "#0ea5e9", "#14b8a6", "#16a34a", "#6b7280"];

export const esColorHex = (c: string | null | undefined): c is string => /^#[0-9a-fA-F]{6}$/.test(c ?? "");

/** Color propio del vehículo si lo tiene; si no, el automático por posición. */
export function colorDeVehiculo(propio: string | null | undefined, indice: number): string {
  return esColorHex(propio) ? propio : COLORES_RUTA[indice % COLORES_RUTA.length];
}

/** Mezcla un #RRGGBB con blanco (t > 0) o negro (t < 0), t en [-1, 1]. */
export function aclarar(hex: string, t: number): string {
  const destino = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  return (
    "#" +
    [1, 3, 5]
      .map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + destino * k).toString(16).padStart(2, "0"))
      .join("")
  );
}
