import type { TipoVehiculo } from "./types";

/** Velocidad del camión cuando no hay GPS y se simula el recorrido (m/s), la misma que en 3D. */
export const VELOCIDAD_SIMULADA = 55;

function hexARgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [244, 180, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mezcla lineal de dos colores #RRGGBB (t = 0 → a, t = 1 → b). */
export function mezclarColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexARgb(a);
  const [r2, g2, b2] = hexARgb(b);
  const k = Math.min(1, Math.max(0, t));
  const c = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** Medidas del modelo visto desde arriba (px) según el tipo de vehículo. */
export const MEDIDAS_MODELO: Record<TipoVehiculo, { ancho: number; largo: number }> = {
  camion: { ancho: 20, largo: 46 },
  furgon: { ancho: 18, largo: 38 },
  utilitario: { ancho: 16, largo: 32 },
  moto: { ancho: 10, largo: 24 },
};

/**
 * SVG del vehículo visto desde arriba, apuntando al norte (se rota con CSS
 * según el rumbo). La caja de carga lleva el color del vehículo; la cabina,
 * blanca con parabrisas oscuro, como el camión 3D.
 */
export function svgVehiculoArriba(tipo: TipoVehiculo, color: string): string {
  const { ancho: w, largo: h } = MEDIDAS_MODELO[tipo];
  const borde = mezclarColor(color, "#000000", 0.35);
  if (tipo === "moto") {
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${w / 2 - 2}" y="0.5" width="4" height="6" rx="2" fill="#1f2937"/>
      <rect x="0.5" y="6" width="${w - 1}" height="3" rx="1.5" fill="#374151"/>
      <rect x="${w / 2 - 3}" y="8" width="6" height="${h - 14}" rx="3" fill="#f3f5f7" stroke="#1f2937" stroke-width="1"/>
      <rect x="1" y="${h - 11}" width="${w - 2}" height="10" rx="2" fill="${color}" stroke="${borde}" stroke-width="1"/>
    </svg>`;
  }
  const cabina = Math.round(h * 0.27);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="-1.5" y="${cabina * 0.35}" width="3" height="4" rx="1" fill="#1f2937"/>
    <rect x="${w - 1.5}" y="${cabina * 0.35}" width="3" height="4" rx="1" fill="#1f2937"/>
    <rect x="1" y="0.5" width="${w - 2}" height="${cabina}" rx="${Math.min(5, w / 3)}" fill="#f3f5f7" stroke="#1f2937" stroke-width="1"/>
    <rect x="3" y="2.5" width="${w - 6}" height="${cabina * 0.36}" rx="2" fill="#1c2a36"/>
    <rect x="0.5" y="${cabina + 1.5}" width="${w - 1}" height="${h - cabina - 2}" rx="2.5" fill="${color}" stroke="${borde}" stroke-width="1.2"/>
    <line x1="${w / 2}" y1="${cabina + 4}" x2="${w / 2}" y2="${h - 3}" stroke="${borde}" stroke-opacity=".35" stroke-width="1"/>
  </svg>`;
}
