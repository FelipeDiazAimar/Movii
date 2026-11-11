/** Kilos legibles: hasta 2 decimales y coma decimal ("105,65"), sin los restos de la suma en coma flotante. */
export function formatearKg(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}
