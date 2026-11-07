import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";

/**
 * Tarjeta con "spotlight": un halo suave sigue al cursor (estilo React Bits).
 * El efecto es solo decorativo y respeta prefers-reduced-motion vía CSS global.
 */
export function SpotlightCard({
  children,
  className = "",
  color = "rgba(244, 180, 0, 0.16)",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  const ref = useRef<HTMLElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  function mover(e: MouseEvent<HTMLElement>) {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  }

  const estilo: CSSProperties | undefined = pos
    ? { background: `radial-gradient(420px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 60%)` }
    : undefined;

  return (
    <Tag
      ref={ref as never}
      onMouseMove={mover}
      onMouseLeave={() => setPos(null)}
      className={`relative overflow-hidden rounded-panel border border-hormigon-200 bg-white shadow-panel ${className}`}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 transition-opacity duration-300" style={{ ...estilo, opacity: pos ? 1 : 0 }} />
      <div className="relative">{children}</div>
    </Tag>
  );
}

/** Número que cuenta hasta su valor cuando cambia (estilo React Bits "CountUp"). */
export function CountUp({ value, decimals = 0, duration = 900, suffix = "" }: { value: number; decimals?: number; duration?: number; suffix?: string }) {
  const [mostrado, setMostrado] = useState(value);
  const desde = useRef(value);

  useEffect(() => {
    const inicio = performance.now();
    const origen = desde.current;
    let frame = 0;
    const paso = (t: number) => {
      const f = Math.min(1, (t - inicio) / duration);
      const suave = 1 - Math.pow(1 - f, 3);
      const v = origen + (value - origen) * suave;
      setMostrado(v);
      if (f < 1) frame = requestAnimationFrame(paso);
      else desde.current = value;
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span className="tabular">
      {mostrado.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** Punto "en vivo" con pulso. */
export function PuntoVivo({ activo = true }: { activo?: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {activo && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${activo ? "bg-emerald-500" : "bg-amber-500"}`} />
    </span>
  );
}
