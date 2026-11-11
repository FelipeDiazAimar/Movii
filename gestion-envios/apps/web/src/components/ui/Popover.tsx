import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** Elemento al que se ancla (el botón que lo abre). */
  anchor: RefObject<HTMLElement | null>;
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
  /** Ancho mínimo = ancho del ancla (listas) o el que pida el contenido (calendario). */
  igualarAncho?: boolean;
  className?: string;
  role?: string;
  id?: string;
  label?: string;
}

const SEPARACION = 8;
// Nace fijo y oculto: si se monta sin posicionar queda al final del <body> y cualquier
// scrollIntoView (la opción activa de una lista) arrastra la página hasta abajo.
const OCULTO: CSSProperties = { position: "fixed", top: 0, left: 0, visibility: "hidden" };
const MARGEN = 12;

/**
 * Panel flotante anclado a un elemento. Se dibuja en un portal (no lo recortan
 * los `overflow-hidden` de las tarjetas), se abre hacia arriba si abajo no hay
 * lugar y se cierra con Esc, al tocar afuera o al desplazar la página.
 */
export function Popover({ anchor, abierto, onCerrar, children, igualarAncho = false, className = "", role, id, label }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const [estilo, setEstilo] = useState<CSSProperties>(OCULTO);
  const [arriba, setArriba] = useState(false);

  const posicionar = useCallback(() => {
    const a = anchor.current;
    const p = panel.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    const alto = p.offsetHeight;
    const ancho = Math.max(p.offsetWidth, igualarAncho ? r.width : 0);
    const abajoLibre = window.innerHeight - r.bottom - MARGEN;
    const arribaLibre = r.top - MARGEN;
    const haciaArriba = alto + SEPARACION > abajoLibre && arribaLibre > abajoLibre;
    const left = Math.min(Math.max(MARGEN, r.left), Math.max(MARGEN, window.innerWidth - ancho - MARGEN));
    const maxAlto = Math.max(160, (haciaArriba ? arribaLibre : abajoLibre) - SEPARACION);
    setArriba(haciaArriba);
    setEstilo({
      position: "fixed",
      left,
      top: haciaArriba ? Math.max(MARGEN, r.top - SEPARACION - Math.min(alto, maxAlto)) : r.bottom + SEPARACION,
      minWidth: igualarAncho ? r.width : undefined,
      maxHeight: maxAlto,
      visibility: "visible",
    });
  }, [anchor, igualarAncho]);

  useLayoutEffect(() => {
    if (abierto) posicionar();
    else setEstilo(OCULTO);
  }, [abierto, posicionar, children]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      onCerrar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCerrar();
        anchor.current?.focus();
      }
    };
    const scroll = (e: Event) => {
      if (panel.current?.contains(e.target as Node)) return;
      posicionar();
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla, true);
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla, true);
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [abierto, anchor, onCerrar, posicionar]);

  if (!abierto) return null;
  return createPortal(
    <div
      ref={panel}
      id={id}
      role={role}
      aria-label={label}
      style={estilo}
      className={`z-[1000] overflow-auto rounded-2xl border border-hormigon-200 bg-white p-1.5 shadow-lift ring-1 ring-black/5 ${arriba ? "origin-bottom" : "origin-top"} animate-[popover-in_140ms_ease-out] ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
