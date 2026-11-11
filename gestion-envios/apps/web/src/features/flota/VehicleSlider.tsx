import type { Vehiculo } from './types';
import { contarSituaciones, situacionVehiculo, type CodigoSituacion } from './situacion';

const ESTILO: Record<CodigoSituacion, { chip: string; borde: string; punto: string }> = {
  en_camino: { chip: 'bg-amber-100 text-amber-900', borde: 'border-l-amber-500', punto: 'bg-amber-500' },
  esperando: { chip: 'bg-blue-100 text-blue-800', borde: 'border-l-blue-500', punto: 'bg-blue-500' },
  terminada: { chip: 'bg-emerald-100 text-emerald-800', borde: 'border-l-emerald-500', punto: 'bg-emerald-500' },
  sin_paquetes: { chip: 'bg-gray-100 text-gray-600', borde: 'border-l-gray-300', punto: 'bg-gray-400' },
  sin_ruta: { chip: 'bg-gray-100 text-gray-600', borde: 'border-l-gray-300', punto: 'bg-gray-400' },
  mantenimiento: { chip: 'bg-red-100 text-red-700', borde: 'border-l-red-500', punto: 'bg-red-500' },
};

type VehicleSliderProps = {
  vehiculos: Vehiculo[];
  selectedId: string;
  onSelect: (vehiculo: Vehiculo) => void;
};

export function VehicleSlider({ vehiculos, selectedId, onSelect }: VehicleSliderProps) {
  // Primero lo que está en la calle, después lo que espera salir; a igual situación, por patente.
  const ordenados = [...vehiculos].sort(
    (a, b) => situacionVehiculo(a).prioridad - situacionVehiculo(b).prioridad || a.patente.localeCompare(b.patente),
  );
  const cuenta = contarSituaciones(vehiculos);
  const resumen: { codigo: CodigoSituacion; n: number; texto: string }[] = [
    { codigo: 'en_camino', n: cuenta.en_camino, texto: 'en camino' },
    { codigo: 'esperando', n: cuenta.esperando, texto: 'sin salir' },
    { codigo: 'terminada', n: cuenta.terminada, texto: 'terminaron' },
    { codigo: 'sin_ruta', n: cuenta.sin_ruta + cuenta.sin_paquetes, texto: 'sin ruta' },
    { codigo: 'mantenimiento', n: cuenta.mantenimiento, texto: 'en taller' },
  ];

  return (
    <div className="w-full bg-white/80 backdrop-blur-md rounded-2xl p-3 border border-gray-100 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Flota en Operación ({vehiculos.length})</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-600">
          {resumen
            .filter((r) => r.n > 0)
            .map((r) => (
              <span key={r.codigo} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${ESTILO[r.codigo].punto}`} />
                {r.n} {r.texto}
              </span>
            ))}
        </span>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {ordenados.map((v) => {
          const isSelected = v.id === selectedId;
          const sit = situacionVehiculo(v);
          const est = ESTILO[sit.codigo];
          const enCalle = sit.codigo === 'en_camino';
          const apagado = sit.codigo === 'mantenimiento' || sit.codigo === 'sin_ruta';
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              aria-pressed={isSelected}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border border-l-4 ${est.borde} transition-all text-left min-w-[220px] flex-shrink-0 ${
                isSelected
                  ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                  : apagado
                    ? 'bg-gray-50 border-gray-200 hover:border-gray-300 opacity-80'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
              }`}
            >
              <div
                className={`relative w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  enCalle || isSelected ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3h3.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-1M5 17h10"
                  />
                </svg>
                {enCalle && <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-emerald-500" aria-hidden />}
                {enCalle && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" aria-hidden />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-900 truncate">{v.patente}</span>
                  <span className={`whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full ${est.chip}`}>{sit.etiqueta}</span>
                </div>
                <p className="text-[11px] text-gray-500 truncate">{v.modelo}</p>
                <p className="text-[10px] text-amber-700 font-medium truncate">
                  {v.ruta_nombre ? `${v.ruta_nombre} · ` : ''}
                  {sit.detalle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
