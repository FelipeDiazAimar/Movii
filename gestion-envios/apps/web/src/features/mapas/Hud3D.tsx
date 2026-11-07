import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Dato del panel flotante de la vista 3D. */
export function Hud({ icono: Icono, etiqueta, valor, acento }: { icono: LucideIcon; etiqueta: string; valor: ReactNode; acento?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${acento ? "bg-movii-500 text-asfalto-900" : "bg-white/10 text-movii-500"}`}>
        <Icono className="h-4 w-4" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{etiqueta}</p>
        <p className="font-expandida text-sm font-black text-white">{valor}</p>
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
