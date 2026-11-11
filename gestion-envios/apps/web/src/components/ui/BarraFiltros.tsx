import { Select } from "./Select";
import { opcionesDe } from "./Field";
import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

interface Props {
  /** Texto del buscador. */
  busqueda: string;
  onBusqueda: (valor: string) => void;
  placeholder?: string;
  /** Filtros extra (selects, fechas…): se muestran a la derecha del buscador. */
  children?: ReactNode;
  /** Si hay algún filtro activo, aparece "Limpiar" y se llama a esto. */
  hayFiltros?: boolean;
  onLimpiar?: () => void;
  /** Texto de resultados, ej. "12 de 40". */
  resumen?: string;
}

/** Barra común de buscador + filtros para los listados (sin card contenedora). */
export function BarraFiltros({ busqueda, onBusqueda, placeholder = "Buscar…", children, hayFiltros, onLimpiar, resumen }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3" role="search">
      <label className="relative min-w-[220px] flex-1">
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder={placeholder}
          maxLength={100}
          className="w-full rounded-xl border border-hormigon-300 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm transition-shadow focus:border-movii-500 focus:shadow-[0_0_0_3px_rgba(244,180,0,0.2)] focus:outline-none"
        />
        {busqueda && (
          <button type="button" onClick={() => onBusqueda("")} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </label>
      {children}
      {hayFiltros && onLimpiar && (
        <button type="button" onClick={onLimpiar} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-movii-700 hover:bg-movii-50">
          Limpiar filtros
        </button>
      )}
      {resumen && <span className="ml-auto self-center text-xs text-gray-500">{resumen}</span>}
    </div>
  );
}

/** Normaliza para buscar sin importar mayúsculas ni tildes. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** true si algún campo contiene la búsqueda. */
export function coincide(busqueda: string, ...campos: Array<string | number | null | undefined>): boolean {
  const q = normalizar(busqueda.trim());
  return !q || campos.some((c) => normalizar(String(c ?? "")).includes(q));
}

/** Select compacto para usar dentro de BarraFiltros. */
export function FiltroSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-gray-500">
      {label}
      <Select tamano="sm" aria-label={label} value={value} onChange={onChange} opciones={opcionesDe(children)} className="min-w-[9rem] font-normal" />
    </div>
  );
}
