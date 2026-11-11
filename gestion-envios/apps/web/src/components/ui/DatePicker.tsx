import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Popover } from "./Popover";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];

const pad = (n: number) => String(n).padStart(2, "0");
const aISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function deISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function legible(s: string): string {
  const d = deISO(s);
  return d ? `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}` : "";
}

interface Props {
  id?: string;
  /** YYYY-MM-DD, o "" si no hay fecha. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalido?: boolean;
  /** Muestra la "x" para dejar el campo vacío. */
  limpiable?: boolean;
  /** YYYY-MM-DD opcional: deshabilita los días anteriores. Sin `min`, no hay límite. */
  min?: string;
  /** YYYY-MM-DD opcional: deshabilita los días posteriores. */
  max?: string;
  "aria-label"?: string;
  className?: string;
  tamano?: "md" | "sm";
}

/**
 * Selector de fecha propio (sustituye a <input type="date">): calendario con
 * navegación por mes, acceso a "Hoy" y teclado (flechas, Enter, Esc, RePág/AvPág).
 */
export function DatePicker({ id, value, onChange, placeholder = "Elegí una fecha", disabled, invalido, limpiable, min, max, className = "", tamano = "md", ...aria }: Props) {
  const auto = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const seleccion = deISO(value);
  const hoy = useMemo(() => new Date(), []);
  const [vista, setVista] = useState(() => {
    const base = seleccion ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [foco, setFoco] = useState<Date>(seleccion ?? hoy);

  const cerrar = useCallback(() => setAbierto(false), []);

  function abrir() {
    if (disabled) return;
    const base = deISO(value) ?? new Date();
    setVista(new Date(base.getFullYear(), base.getMonth(), 1));
    setFoco(base);
    setAbierto(true);
  }

  const fueraDeRango = (d: Date) => (min ? aISO(d) < min : false) || (max ? aISO(d) > max : false);

  function elegir(d: Date) {
    if (fueraDeRango(d)) return;
    onChange(aISO(d));
    setAbierto(false);
    boton.current?.focus();
  }

  function irA(d: Date) {
    setFoco(d);
    setVista(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  const celdas = useMemo(() => {
    const primero = new Date(vista.getFullYear(), vista.getMonth(), 1);
    const offset = (primero.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => new Date(vista.getFullYear(), vista.getMonth(), 1 - offset + i));
  }, [vista]);

  function onKeyGrilla(e: KeyboardEvent<HTMLDivElement>) {
    const mover = (dias: number) => {
      e.preventDefault();
      irA(new Date(foco.getFullYear(), foco.getMonth(), foco.getDate() + dias));
    };
    switch (e.key) {
      case "ArrowLeft": return mover(-1);
      case "ArrowRight": return mover(1);
      case "ArrowUp": return mover(-7);
      case "ArrowDown": return mover(7);
      case "PageUp":
        e.preventDefault();
        return irA(new Date(foco.getFullYear(), foco.getMonth() - 1, foco.getDate()));
      case "PageDown":
        e.preventDefault();
        return irA(new Date(foco.getFullYear(), foco.getMonth() + 1, foco.getDate()));
      case "Enter":
      case " ":
        e.preventDefault();
        return elegir(foco);
    }
  }

  const cambiarMes = (delta: number) => setVista(new Date(vista.getFullYear(), vista.getMonth() + delta, 1));
  const tam = tamano === "sm" ? "min-h-[36px] px-2.5 py-1.5" : "min-h-[42px] px-3 py-2";

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          ref={boton}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={abierto}
          aria-controls={abierto ? `${auto}-cal` : undefined}
          aria-label={aria["aria-label"]}
          aria-invalid={invalido || undefined}
          disabled={disabled}
          onClick={() => (abierto ? cerrar() : abrir())}
          className={`flex w-full items-center gap-2 rounded-xl border bg-white text-left text-sm shadow-panel outline-none transition-[border-color,box-shadow] hover:border-hormigon-300 focus-visible:border-movii-500 focus-visible:ring-2 focus-visible:ring-movii-400/60 disabled:cursor-not-allowed disabled:bg-hormigon-100 disabled:text-gray-500 ${
            abierto ? "border-movii-500 ring-2 ring-movii-400/40" : invalido ? "border-red-400" : "border-hormigon-300"
          } ${tam} ${limpiable && value ? "pr-8" : ""}`}
        >
          <Calendar className={`h-4 w-4 shrink-0 ${abierto ? "text-movii-600" : "text-gray-400"}`} aria-hidden />
          <span className={`min-w-0 flex-1 truncate tabular ${seleccion ? "text-gray-900" : "text-gray-400"}`}>{seleccion ? legible(value) : placeholder}</span>
        </button>
        {limpiable && value && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            title="Quitar la fecha"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-hormigon-100 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Quitar la fecha</span>
          </button>
        )}
      </div>
      <Popover anchor={boton} abierto={abierto} onCerrar={cerrar} role="dialog" id={`${auto}-cal`} label="Calendario" className="w-[18.5rem] p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => cambiarMes(-1)} className="rounded-lg p-1.5 text-gray-500 hover:bg-hormigon-100 hover:text-gray-900" title="Mes anterior">
            <ChevronLeft className="h-4 w-4" aria-hidden />
            <span className="sr-only">Mes anterior</span>
          </button>
          <p className="font-expandida text-sm font-extrabold capitalize text-gray-900" aria-live="polite">
            {MESES[vista.getMonth()]} {vista.getFullYear()}
          </p>
          <button type="button" onClick={() => cambiarMes(1)} className="rounded-lg p-1.5 text-gray-500 hover:bg-hormigon-100 hover:text-gray-900" title="Mes siguiente">
            <ChevronRight className="h-4 w-4" aria-hidden />
            <span className="sr-only">Mes siguiente</span>
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-gray-400" aria-hidden>
          {DIAS.map((d) => (
            <span key={d} className="py-1">{d}</span>
          ))}
        </div>
        <div role="grid" tabIndex={0} aria-label={`${MESES[vista.getMonth()]} ${vista.getFullYear()}`} onKeyDown={onKeyGrilla} className="grid grid-cols-7 gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-movii-400/60 rounded-lg">
          {celdas.map((d) => {
            const delMes = d.getMonth() === vista.getMonth();
            const esSel = seleccion ? aISO(d) === aISO(seleccion) : false;
            const esHoy = aISO(d) === aISO(hoy);
            const esFoco = aISO(d) === aISO(foco);
            const bloqueado = fueraDeRango(d);
            return (
              <button
                key={aISO(d)}
                type="button"
                tabIndex={-1}
                role="gridcell"
                aria-selected={esSel}
                aria-label={legible(aISO(d))}
                disabled={bloqueado}
                onClick={() => elegir(d)}
                className={`tabular flex h-9 items-center justify-center rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:text-gray-200 ${
                  esSel
                    ? "bg-movii-500 font-bold text-asfalto-900 shadow-panel"
                    : esHoy
                      ? "font-bold text-movii-700 ring-1 ring-inset ring-movii-500"
                      : delMes
                        ? "text-gray-800 hover:bg-hormigon-100"
                        : "text-gray-300 hover:bg-hormigon-50"
                } ${esFoco && !esSel ? "bg-hormigon-100" : ""}`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-hormigon-100 pt-2">
          <button type="button" onClick={() => elegir(new Date())} disabled={fueraDeRango(new Date())} className="rounded-lg px-2 py-1 text-xs font-semibold text-movii-700 hover:bg-movii-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent">
            Hoy
          </button>
          {limpiable && (
            <button type="button" onClick={() => { onChange(""); setAbierto(false); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-hormigon-100">
              Quitar
            </button>
          )}
        </div>
      </Popover>
    </>
  );
}
