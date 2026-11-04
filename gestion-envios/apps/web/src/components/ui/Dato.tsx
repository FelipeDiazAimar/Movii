import type { ReactNode } from "react";

/** Par etiqueta/valor para usar dentro de un <dl>. Única definición para todas las pantallas de detalle. */
export function Dato({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}
