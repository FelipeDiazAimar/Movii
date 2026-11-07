import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Dato del panel flotante de la vista 3D. */
export function Hud({ icono: Icono, etiqueta, valor, acento }: { icono: LucideIcon; etiqueta: string; valor: ReactNode; acento?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${acento ? "bg-movii-500 text-asfalto-900" : "bg-white/10 text-movii-500"}`}>
        <Icono className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[9.5px] font-bold uppercase tracking-wider text-gray-400">{etiqueta}</p>
        <p className="font-expandida truncate text-[13px] font-black text-white">{valor}</p>
      </div>
    </div>
  );
}

/** Punto que late (verde con GPS, amarillo en simulación). */
export function Latido({ verde }: { verde: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${verde ? "bg-green-400" : "bg-movii-500"}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${verde ? "bg-green-400" : "bg-movii-500"}`} />
    </span>
  );
}
