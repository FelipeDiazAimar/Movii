import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover } from "./Popover";

export interface Opcion {
  value: string;
  label: ReactNode;
  /** Texto plano para buscar escribiendo y para lectores de pantalla. */
  texto?: string;
  disabled?: boolean;
  /** Línea secundaria (por ejemplo "ocupado en otra ruta"). */
  detalle?: string;
}

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  opciones: Opcion[];
  placeholder?: string;
  disabled?: boolean;
  invalido?: boolean;
  "aria-label"?: string;
  className?: string;
  /** Tamaño del disparador: "md" para formularios, "sm" para filtros en línea. */
  tamano?: "md" | "sm";
}

const textoDe = (o: Opcion) => o.texto ?? (typeof o.label === "string" ? o.label : o.value);

/**
 * Lista desplegable propia (sustituye al <select> nativo): mismo aspecto en todos
 * los navegadores, teclado completo (↑ ↓ Inicio Fin Enter Esc y escribir para
 * saltar a una opción) y panel en portal que no recortan las tarjetas.
 */
export function Select({ id, value, onChange, opciones, placeholder = "Seleccionar…", disabled, invalido, className = "", tamano = "md", ...aria }: Props) {
  const auto = useId();
  const listaId = `${auto}-lista`;
  const boton = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(-1);
  const busqueda = useRef({ texto: "", t: 0 });

  const actual = opciones.find((o) => o.value === value);
  const habilitadas = useMemo(() => opciones.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0), [opciones]);

  const cerrar = useCallback(() => setAbierto(false), []);
  const abrir = useCallback(() => {
    if (disabled) return;
    const i = opciones.findIndex((o) => o.value === value && !o.disabled);
    setActiva(i >= 0 ? i : (habilitadas[0] ?? -1));
    setAbierto(true);
  }, [disabled, opciones, value, habilitadas]);

  function elegir(i: number) {
    const o = opciones[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setAbierto(false);
    boton.current?.focus();
  }

  function mover(delta: number) {
    if (habilitadas.length === 0) return;
    const pos = habilitadas.indexOf(activa);
    const sig = pos === -1 ? (delta > 0 ? 0 : habilitadas.length - 1) : (pos + delta + habilitadas.length) % habilitadas.length;
    setActiva(habilitadas[sig]);
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (!abierto) abrir();
        else mover(e.key === "ArrowDown" ? 1 : -1);
        return;
      case "Home":
        if (abierto) {
          e.preventDefault();
          setActiva(habilitadas[0] ?? -1);
        }
        return;
      case "End":
        if (abierto) {
          e.preventDefault();
          setActiva(habilitadas[habilitadas.length - 1] ?? -1);
        }
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!abierto) abrir();
        else if (activa >= 0) elegir(activa);
        return;
      case "Tab":
        if (abierto) setAbierto(false);
        return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const b = busqueda.current;
      const ahora = Date.now();
      b.texto = ahora - b.t > 700 ? e.key.toLowerCase() : b.texto + e.key.toLowerCase();
      b.t = ahora;
      const i = opciones.findIndex((o) => !o.disabled && textoDe(o).toLowerCase().startsWith(b.texto));
      if (i >= 0) {
        if (!abierto) onChange(opciones[i].value);
        else setActiva(i);
      }
    }
  }

  // Mantiene visible la opción activa al navegar con el teclado.
  useEffect(() => {
    if (abierto && activa >= 0) document.getElementById(`${listaId}-${activa}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [abierto, activa, listaId]);

  const pad = tamano === "sm" ? "min-h-[36px] px-2.5 py-1.5" : "min-h-[42px] px-3 py-2";

  return (
    <>
      <button
        ref={boton}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? listaId : undefined}
        aria-activedescendant={abierto && activa >= 0 ? `${listaId}-${activa}` : undefined}
        aria-invalid={invalido || undefined}
        aria-label={aria["aria-label"]}
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={onKey}
        className={`group flex w-full items-center justify-between gap-2 rounded-xl border bg-white text-left text-sm shadow-panel outline-none transition-[border-color,box-shadow] hover:border-hormigon-300 focus-visible:border-movii-500 focus-visible:ring-2 focus-visible:ring-movii-400/60 disabled:cursor-not-allowed disabled:bg-hormigon-100 disabled:text-gray-500 ${
          abierto ? "border-movii-500 ring-2 ring-movii-400/40" : invalido ? "border-red-400" : "border-hormigon-300"
        } ${pad} ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate ${actual ? "text-gray-900" : "text-gray-400"}`}>{actual ? actual.label : placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${abierto ? "rotate-180 text-movii-600" : ""}`} aria-hidden />
      </button>
      <Popover anchor={boton} abierto={abierto} onCerrar={cerrar} igualarAncho role="listbox" id={listaId} className="max-w-[min(92vw,28rem)]">
        {opciones.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">Sin opciones</p>}
        {opciones.map((o, i) => {
          const seleccionada = o.value === value;
          return (
            <div
              key={o.value}
              id={`${listaId}-${i}`}
              role="option"
              aria-selected={seleccionada}
              aria-disabled={o.disabled || undefined}
              onPointerEnter={() => !o.disabled && setActiva(i)}
              onClick={() => elegir(i)}
              className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                o.disabled ? "cursor-not-allowed text-gray-300" : i === activa ? "bg-movii-50 text-gray-900" : "text-gray-700"
              } ${seleccionada ? "font-semibold" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.detalle && <span className="block truncate text-xs font-normal text-gray-400">{o.detalle}</span>}
              </span>
              {seleccionada && <Check className="h-4 w-4 shrink-0 text-movii-600" strokeWidth={2.6} aria-hidden />}
            </div>
          );
        })}
      </Popover>
    </>
  );
}
