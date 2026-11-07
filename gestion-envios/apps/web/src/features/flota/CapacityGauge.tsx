type CapacityGaugeProps = {
  percentage: number;
  currentLoadKg: number;
  maxCapacityKg: number;
  label?: string;
};

export function CapacityGauge({
  percentage,
  currentLoadKg,
  maxCapacityKg,
  label = 'Capacidad y carga',
}: CapacityGaugeProps) {
  const clampedPercent = Math.min(Math.max(percentage, 0), 100);

  // Radio y geometría del arco
  const radius = 62;
  const strokeWidth = 10;
  // Ángulo de barrido: 220 grados (de 160° a 380° / 20°)
  const arcLength = (220 / 360) * 2 * Math.PI * radius;
  const strokeDashoffset = arcLength - (clampedPercent / 100) * arcLength;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          Ocupación
        </span>
      </div>

      <div className="relative flex flex-col items-center justify-center my-2">
        <svg width="170" height="110" viewBox="0 0 170 110" className="overflow-visible">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>
          </defs>

          {/* Arco de fondo (Gris claro) */}
          <path
            d="M 25 95 A 62 62 0 1 1 145 95"
            fill="none"
            stroke="#F3F4F6"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Arco activo coloreado (Gradiente Naranja/Ámbar) */}
          <path
            d="M 25 95 A 62 62 0 1 1 145 95"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
        </svg>

        {/* Texto central */}
        <div className="absolute top-10 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
            {clampedPercent.toFixed(0)}%
          </span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Ocupación
          </span>
        </div>
      </div>

      {/* Métricas al pie */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50 text-xs">
        <div>
          <span className="block text-gray-400 font-medium">Carga actual</span>
          <span className="text-gray-900 font-bold">
            {(currentLoadKg / 1000).toFixed(1)} t{' '}
            <span className="text-[10px] font-normal text-gray-500">({currentLoadKg} kg)</span>
          </span>
        </div>
        <div className="text-right">
          <span className="block text-gray-400 font-medium">Capacidad máx.</span>
          <span className="text-gray-900 font-bold">
            {(maxCapacityKg / 1000).toFixed(1)} t{' '}
            <span className="text-[10px] font-normal text-gray-500">({maxCapacityKg} kg)</span>
          </span>
        </div>
      </div>
    </div>
  );
}
