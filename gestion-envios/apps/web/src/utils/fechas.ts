/** Fecha y hora legibles (es-UY) a partir de un ISO 8601; si no parsea, devuelve el original. */
export function formatearFecha(fecha: string): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleString("es-UY", { dateStyle: "medium", timeStyle: "short" });
}

/** Solo el día, para fechas "YYYY-MM-DD" (se arma en hora local para que no corra un día por zona horaria). */
export function formatearDia(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return fecha;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("es-UY", { dateStyle: "medium" });
}

/** Solo la hora (HH:MM) de un ISO 8601; "—" si no parsea. */
export function formatearHora(fecha: string | undefined | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
