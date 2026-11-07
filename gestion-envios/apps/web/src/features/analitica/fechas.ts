/** Hoy en hora local (YYYY-MM-DD). toISOString daría el día UTC, que después de las 21 h ya es mañana. */
export function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function primerDiaMesISO(): string {
  return `${hoyISO().slice(0, 8)}01`;
}
