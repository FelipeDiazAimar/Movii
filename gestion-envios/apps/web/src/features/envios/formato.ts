/**
 * Formatos de fecha propios de las pantallas de envíos. Se arman a mano
 * (sin Intl) para que el texto sea siempre el mismo en todos los
 * navegadores: "12 nov. 2026", sin depender de la versión de ICU.
 */
const MESES_CORTOS = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."];

const FRANJAS: Record<string, string> = {
  manana: "mañana",
  tarde: "tarde",
  noche: "noche",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Hoy en hora local, como "YYYY-MM-DD" (mismo criterio que el alta de envíos). */
export function hoyISO(ahora: Date = new Date()): string {
  return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`;
}

/** "2026-11-12" → "12 nov. 2026". Si no tiene ese formato, devuelve el original. */
export function fechaLegible(dia: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return dia;
  const mes = MESES_CORTOS[Number(m[2]) - 1];
  if (!mes) return dia;
  return `${Number(m[3])} ${mes} ${m[1]}`;
}

/** Franja horaria con tilde ("manana" → "mañana"); la desconocida queda igual. */
export function franjaLegible(franja: string | null | undefined): string {
  if (!franja) return "";
  return FRANJAS[franja] ?? franja;
}

/** Fecha de alta compacta para tablas: día ("10 nov. 2026") y hora ("14:32") por separado, en hora local. */
export function altaCompacta(iso: string): { dia: string; hora: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { dia: iso, hora: "" };
  return {
    dia: `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * Comentarios viejos de reprogramación que guardó la API con la fecha cruda
 * ("reprogramado para 2026-11-12 (manana)") → "Reprogramado para el
 * 12 nov. 2026 (mañana)". Cualquier otro comentario queda igual.
 */
export function comentarioLegible(comentario: string): string {
  const m = /^reprogramado para (\d{4}-\d{2}-\d{2})(?: \((\w+)\))?$/i.exec(comentario.trim());
  if (!m) return comentario;
  const f = franjaLegible(m[2]);
  return `Reprogramado para el ${fechaLegible(m[1])}${f ? ` (${f})` : ""}`;
}

/** "Comprometido para 12 nov. 2026 (mañana)". */
export function textoCompromiso(dia: string, franja: string | null | undefined): string {
  const f = franjaLegible(franja);
  return `Comprometido para ${fechaLegible(dia)}${f ? ` (${f})` : ""}`;
}
