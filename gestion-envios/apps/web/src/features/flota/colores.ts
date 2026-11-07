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
