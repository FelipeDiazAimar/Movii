import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Popover } from "./Popover";

export interface AccionMenu {
  etiqueta: string;
  icono: LucideIcon;
  /** Navega a esta ruta… */
  to?: string;
  /** …o ejecuta esto. */
  onClick?: () => void;
  /** Acción destructiva: va al final, separada y en rojo. */
  peligro?: boolean;
  oculta?: boolean;
}

interface Props {
  /** Nombre del elemento, para el texto accesible del botón ("Acciones de Ruta Norte"). */
  nombre: string;
  acciones: AccionMenu[];
  className?: string;
  /** Contenido extra (diálogos que abren las acciones). */
  children?: ReactNode;
}

const ITEM = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors focus:outline-none";

/** Botón "⋯" con un menú de acciones secundarias (ver, abrir en mapa, eliminar…). */
export function MenuAcciones({ nombre, acciones, className = "", children }: Props) {
  const boton = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const visibles = acciones.filter((a) => !a.oculta);
  const normales = visibles.filter((a) => !a.peligro);
  const peligrosas = visibles.filter((a) => a.peligro);
  if (visibles.length === 0) return <>{children}</>;

  const item = (a: AccionMenu) => {
    const Icono = a.icono;
    const clase = `${ITEM} ${a.peligro ? "text-red-600 hover:bg-red-50 focus:bg-red-50" : "text-gray-700 hover:bg-hormigon-100 focus:bg-hormigon-100"}`;
    const contenido = (
      <>
        <Icono className="h-4 w-4 shrink-0" aria-hidden />
        {a.etiqueta}
      </>
    );
    return (
      <li key={a.etiqueta} role="none">
        {a.to ? (
          <Link role="menuitem" to={a.to} className={clase} onClick={() => setAbierto(false)}>
            {contenido}
          </Link>
        ) : (
          <button
            role="menuitem"
            type="button"
            className={clase}
            onClick={() => {
              setAbierto(false);
              a.onClick?.();
            }}
          >
            {contenido}
          </button>
        )}
      </li>
    );
  };

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Acciones de ${nombre}`}
        title="Más acciones"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-hormigon-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-movii-400 ${abierto ? "bg-hormigon-100 text-gray-900" : ""} ${className}`}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      <Popover anchor={boton} abierto={abierto} onCerrar={() => setAbierto(false)} className="w-max min-w-[200px]">
        <ul role="menu" aria-label={`Acciones de ${nombre}`} className="flex flex-col">
          {normales.map(item)}
          {peligrosas.length > 0 && normales.length > 0 && <li role="separator" className="my-1 border-t border-hormigon-100" />}
          {peligrosas.map(item)}
        </ul>
      </Popover>
      {children}
    </>
  );
}
