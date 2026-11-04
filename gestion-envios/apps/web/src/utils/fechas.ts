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
