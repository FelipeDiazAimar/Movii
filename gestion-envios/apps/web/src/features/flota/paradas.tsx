import { COLOR_ESTADO } from "./colores";

/**
 * Cómo se dibuja una parada (el mismo código en el mapa, la lista y las
 * referencias): ✓ entregada, ! no entregada, naranja la que el camión está
 * yendo a entregar ahora y azul (con su número de orden) el resto por entregar,
 * estén todavía en el depósito o ya a bordo.
 */
export function marcaParada(orden: number, estado: string, ahora = false): { fondo: string; texto: string; titulo: string } {
  if (estado === "entregado") return { fondo: COLOR_ESTADO.entregado, texto: "✓", titulo: "Entregado" };
  if (estado === "no_entregado") return { fondo: COLOR_ESTADO.no_entregado, texto: "!", titulo: "No entregado" };
  if (ahora) return { fondo: COLOR_ESTADO.en_camino, texto: String(orden), titulo: "Yendo a entregar ahora" };
  return { fondo: COLOR_ESTADO.asignado, texto: String(orden), titulo: estado === "en_camino" ? "En camino (a bordo, por entregar)" : "Por entregar" };
}

/** HTML del marcador de Leaflet. La próxima parada lleva un anillo que late. */
export function htmlParada(orden: number, estado: string, opciones: { destacada?: boolean; proxima?: boolean } = {}): { html: string; tam: number } {
  const { fondo, texto } = marcaParada(orden, estado, opciones.proxima);
  const resuelta = estado === "entregado" || estado === "no_entregado";
  const tam = opciones.destacada ? 34 : resuelta ? 22 : opciones.proxima ? 30 : 26;
  const anillo = opciones.proxima
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${fondo};animation:movii-pulso 1.8s ease-out infinite"></div>`
    : "";
  const sombra = opciones.destacada ? `0 0 0 4px ${fondo}55, 0 2px 8px rgba(0,0,0,.4)` : "0 2px 6px rgba(0,0,0,.35)";
  return {
    tam,
    html: `<div style="position:relative;width:${tam}px;height:${tam}px">${anillo}<div style="position:absolute;inset:0;background:${fondo};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 ${opciones.destacada ? 14 : resuelta ? 12 : 12}px system-ui;border:${resuelta ? 2 : 3}px solid #fff;box-shadow:${sombra};opacity:${resuelta && !opciones.destacada ? 0.85 : 1}">${texto}</div></div>`,
  };
}

/** La misma marca, como componente (lista de paradas y referencias del mapa). */
export function MarcaParada({ orden, estado, chica = false, ahora = false }: { orden: number; estado: string; chica?: boolean; ahora?: boolean }) {
  const { fondo, texto, titulo } = marcaParada(orden, estado, ahora);
  return (
    <span
      title={titulo}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-white font-bold text-white shadow ${chica ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs"}`}
      style={{ background: fondo }}
    >
      {texto}
    </span>
  );
}
