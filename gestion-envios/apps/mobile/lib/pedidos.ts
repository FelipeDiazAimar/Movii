import type { EstadoEnvioAPI } from "@/lib/api-client";
import { M } from "@/constants/movii-design";
import type { ShipmentStatus } from "@/types/logistics";

/** Un código de guía completo, como MOV-20261111-0002 (para ir directo al detalle). */
export const CODIGO_COMPLETO = /^MOV-\d{8}-\d{4}$/i;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function aDias(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(a, m - 1, d) / 86400000);
}

/** "Hoy", "Mañana", "Ayer", "hace 5 días" o "en 3 días", según la distancia a `hoy` (ambos YYYY-MM-DD). */
export function etiquetaRelativa(fecha: string, hoy: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{4}-\d{2}-\d{2}$/.test(hoy)) return fecha;
  const dif = aDias(fecha) - aDias(hoy);
  if (dif === 0) return "Hoy";
  if (dif === 1) return "Mañana";
  if (dif === -1) return "Ayer";
  return dif < 0 ? `Hace ${-dif} días` : `En ${dif} días`;
}

/** "11 nov 2026" a partir de YYYY-MM-DD. */
export function fechaCorta(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : fecha;
}

/** El badge visual no distingue "asignado" de "pendiente". */
export function estadoVisual(e: EstadoEnvioAPI): ShipmentStatus {
  return e === "asignado" ? "pendiente" : (e as ShipmentStatus);
}

/** Color de la cinta de la caja según el estado: amarillo en curso, verde entregado, rojo fallido. */
export function colorCinta(e: EstadoEnvioAPI): string {
  if (e === "entregado") return M.verde;
  if (e === "no_entregado") return M.rojo;
  return M.amarillo;
}

export const ETIQUETA_ESTADO: Record<EstadoEnvioAPI, string> = {
  pendiente: "Pendiente",
  asignado: "Asignado",
  en_camino: "En camino",
  entregado: "Entregado",
  no_entregado: "No entregado",
};

export const ETIQUETA_TAMANO: Record<string, string> = { chico: "Chico", mediano: "Mediano", grande: "Grande" };
