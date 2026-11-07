import type { Vehiculo } from './types';
import { ETIQUETA_ESTADO_VEHICULO } from './types';

type VehicleSliderProps = {
  vehiculos: Vehiculo[];
  selectedId: string;
  onSelect: (vehiculo: Vehiculo) => void;
};

export function VehicleSlider({ vehiculos, selectedId, onSelect }: VehicleSliderProps) {
  return (
    <div className="w-full bg-white/80 backdrop-blur-md rounded-2xl p-3 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Flota en Operación ({vehiculos.length})
        </span>
        <span className="text-xs text-gray-400">Seleccioná un vehículo para inspeccionar</span>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {vehiculos.map((v) => {
          const isSelected = v.id === selectedId;
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left min-w-[200px] flex-shrink-0 ${
                isSelected
                  ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
              }`}
            >
              {/* Icono de camión / furgón */}
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
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
              </div>

              {/* Datos del vehículo */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 truncate">{v.patente}</span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                      v.estado === 'activo'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {ETIQUETA_ESTADO_VEHICULO[v.estado] ?? v.estado}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 truncate">{v.modelo}</p>
                <p className="text-[10px] text-amber-700 font-medium">
                  {v.ruta_nombre || 'Sin ruta hoy'} · {v.total_paquetes} paq.
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
