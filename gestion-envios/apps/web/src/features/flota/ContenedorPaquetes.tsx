import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Plus, Wine, X } from "lucide-react";
import type { PaqueteVehiculo } from "./types";
import { REGION_CARGA } from "./VehiculoIllustration";

const ESTADO: Record<string, string> = {
  asignado: "Asignado",
  en_camino: "En camino",
  entregado: "Entregado",
  no_entregado: "No entregado",
  pendiente: "Pendiente",
};

const ESCALA: Record<string, number> = { chico: 1, mediano: 1.25, grande: 1.55 };

/** Caja de cartón con cinta; el tamaño refleja chico / mediano / grande. */
function Caja({ p, onAbrir }: { p: PaqueteVehiculo; onAbrir: () => void }) {
  const lado = Math.round(30 * (ESCALA[p.tamano] ?? 1));
  const fallido = p.estado === "no_entregado";
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group/caja relative shrink-0 transition-transform duration-150 hover:z-20 hover:-translate-y-1 focus-visible:z-20"
      style={{ width: lado, height: lado * 0.86 }}
      aria-label={`${p.codigo_guia}, ${p.destinatario_nombre}. Ver detalle`}
    >
      <svg viewBox="0 0 40 34" className="h-full w-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)]" aria-hidden>
        <rect x="1" y="4" width="38" height="29" rx="2" fill={fallido ? "#b8836b" : "#c9955b"} />
        <rect x="1" y="4" width="38" height="7" rx="2" fill={fallido ? "#c99a84" : "#dcae76"} />
        <rect x="17" y="4" width="6" height="29" fill="#e9cf9f" opacity="0.85" />
        <rect x="1" y="30" width="38" height="3" fill="#000" opacity="0.12" />
        {/* Etiqueta de envío */}
        <rect x="25" y="16" width="11" height="8" rx="1" fill="#fff" />
        <rect x="26.5" y="18" width="8" height="1.2" fill="#6b7280" />
        <rect x="26.5" y="20.5" width="5" height="1.2" fill="#6b7280" />
        {p.urgente && <rect x="3" y="15" width="10" height="5" rx="1" fill="#dc2626" />}
      </svg>
      {p.fragil && (
        <span className="absolute -left-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-amber-700 shadow">
          <Wine className="h-2.5 w-2.5" aria-hidden />
        </span>
      )}
      {fallido && (
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-white shadow">
          <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
        </span>
      )}

      {/* Tooltip */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-xl bg-asfalto-900 p-3 text-left text-xs text-white opacity-0 shadow-lift transition-opacity duration-150 group-hover/caja:opacity-100 group-focus-visible/caja:opacity-100"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="font-bold">
            {p.orden}. {p.codigo_guia}
          </span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{ESTADO[p.estado] ?? p.estado}</span>
        </span>
        <span className="mt-1.5 block text-white/90">{p.destinatario_nombre}</span>
        <span className="block text-white/60">{p.direccion}</span>
        <span className="mt-1.5 block text-white/60">
          {p.peso} kg, {p.tamano}
          {p.tipo_contenido ? `, ${p.tipo_contenido}` : ""}
          {p.urgente ? ", urgente" : ""}
          {p.fragil ? ", frágil" : ""}
        </span>
        <span className="mt-1.5 block font-semibold text-movii-500">Tocá para ver el detalle</span>
        <span aria-hidden className="absolute left-1/2 top-full -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-asfalto-900" />
      </span>
    </button>
  );
}

/**
 * Capa sobre la caja del camión (TruckIllustration): un botón "+" abre la
 * caja en corte y muestra los paquetes que lleva, apilados desde el piso.
 * Las coordenadas coinciden con la caja del SVG (x 40–530, y 36–242 de 820×330).
 */
export function ContenedorPaquetes({ paquetes, region = REGION_CARGA.camion }: { paquetes: PaqueteVehiculo[]; region?: { left: string; top: string; width: string; height: string } }) {
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();
  const aBordo = paquetes.filter((p) => p.estado !== "entregado");
  const entregados = paquetes.length - aBordo.length;

  return (
    <div className="absolute" style={region}>
      {abierto && (
        <div className="absolute inset-0 overflow-visible rounded-md bg-[linear-gradient(180deg,#151515,#262626)] shadow-[inset_0_0_0_3px_rgba(244,180,0,0.55)]">
          {/* Piso y paredes del contenedor */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-3 rounded-b-md bg-[repeating-linear-gradient(90deg,#3b3b3b_0_10px,#303030_10px_20px)]" />
          <div aria-hidden className="absolute inset-y-0 left-0 w-2 bg-white/5" />
          <div className="absolute left-3 top-2 text-[11px] font-semibold text-white/70">
            {aBordo.length === 0 ? "Caja vacía" : `${aBordo.length} a bordo`}
            {entregados > 0 && <span className="text-white/40">, {entregados} entregados</span>}
          </div>
          <div className="absolute inset-x-3 bottom-3 top-8 flex flex-wrap-reverse content-start items-end gap-1.5">
            {aBordo.map((p) => (
              <Caja key={p.envio_id} p={p} onAbrir={() => navigate(`/envios/${p.envio_id}`)} />
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        title={abierto ? "Cerrar la caja" : "Ver los paquetes dentro de la caja"}
        className="absolute right-[6%] top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-asfalto-900 text-white shadow-lift ring-2 ring-white/70 transition-transform hover:scale-110"
      >
        {abierto ? <X className="h-5 w-5" aria-hidden /> : <Plus className="h-5 w-5" strokeWidth={2.6} aria-hidden />}
        <span className="sr-only">{abierto ? "Cerrar la caja" : "Ver los paquetes dentro de la caja"}</span>
      </button>
    </div>
  );
}
