import { COLOR_ESTADO } from "./colores";
import type { PaqueteVehiculo } from "./types";

/**
 * La ruta como una línea de paradas (en vez de un mapa que hay que leer):
 * depósito a la izquierda, última entrega a la derecha y el camión en la
 * primera parada pendiente.
 */
export function LineaDeParadas({
  paquetes,
  seleccionado,
  onSeleccionar,
}: {
  paquetes: PaqueteVehiculo[];
  seleccionado?: string | null;
  onSeleccionar?: (envioId: string) => void;
}) {
  if (paquetes.length === 0) {
    return <p className="text-xs text-gray-500">Sin paradas asignadas.</p>;
  }
  const resueltos = paquetes.filter((p) => p.estado === "entregado" || p.estado === "no_entregado").length;
  const avance = resueltos / paquetes.length;
  const ultimo = paquetes[paquetes.length - 1];

  return (
    <div>
      <div className="flex items-end justify-between text-xs">
        <div>
          <p className="text-base font-black text-gray-900">DEP</p>
          <p className="text-gray-500">Depósito</p>
        </div>
        <div className="text-right">
          <p className="text-base font-black text-gray-900">#{paquetes.length}</p>
          <p className="max-w-[9rem] truncate text-gray-500">{ultimo.direccion}</p>
        </div>
      </div>
      <div className="relative mt-3 h-8">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gray-200" />
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-movii-500 transition-all duration-700"
          style={{ width: `${avance * 100}%` }}
        />
        {paquetes.map((p, i) => {
          const left = ((i + 1) / paquetes.length) * 100;
          const activo = seleccionado === p.envio_id;
          return (
            <button
              key={p.envio_id}
              type="button"
              title={`${p.orden}. ${p.codigo_guia} — ${p.destinatario_nombre}`}
              onClick={() => onSeleccionar?.(p.envio_id)}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-all ${
                activo ? "h-5 w-5 ring-2 ring-movii-500" : "h-3.5 w-3.5 hover:scale-125"
              }`}
              style={{ left: `calc(${left}% - ${i === paquetes.length - 1 ? 8 : 0}px)`, background: COLOR_ESTADO[p.estado] ?? COLOR_ESTADO.pendiente }}
            />
          );
        })}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
          style={{ left: `${Math.max(avance * 100, 3)}%` }}
          aria-hidden
        >
          <div className="h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-gray-900" />
        </div>
      </div>
      <p className="mt-1 text-center text-[11px] text-gray-500">
        {resueltos} de {paquetes.length} paradas resueltas
      </p>
    </div>
  );
}
