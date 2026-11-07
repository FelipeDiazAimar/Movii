type TruckIllustrationProps = {
  containerCode?: string;
  className?: string;
};

export function TruckIllustration({
  containerCode = '#MOV-20261021-0001',
  className = '',
}: TruckIllustrationProps) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 680 280"
        className="w-full h-auto drop-shadow-md"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Sombra proyectada en el piso */}
        <ellipse cx="340" cy="245" rx="320" ry="14" fill="#000000" fillOpacity="0.10" />

        {/* ======================================================== */}
        {/* CONTENEDOR DE CARGA (NARANJA VIBRANTE FLEETTRACK)        */}
        {/* ======================================================== */}
        {/* Caja principal del contenedor */}
        <rect x="50" y="45" width="370" height="150" rx="4" fill="#F97316" />
        
        {/* Ranuras verticales corrugadas del contenedor */}
        {Array.from({ length: 15 }).map((_, i) => (
          <g key={i}>
            <line
              x1={68 + i * 23}
              y1={47}
              x2={68 + i * 23}
              y2={193}
              stroke="#EA580C"
              strokeWidth="4"
            />
            <line
              x1={70 + i * 23}
              y1={47}
              x2={70 + i * 23}
              y2={193}
              stroke="#FB923C"
              strokeWidth="1.5"
            />
          </g>
        ))}

        {/* Marco y bordes del contenedor */}
        <rect x="48" y="43" width="374" height="154" rx="5" stroke="#C2410C" strokeWidth="3" fill="none" />

        {/* Letras de identificación en el contenedor */}
        <g opacity="0.9">
          <rect x="62" y="60" width="130" height="24" rx="3" fill="#C2410C" fillOpacity="0.8" />
          <text x="70" y="76" fill="#FFFFFF" fontSize="11" fontWeight="800" fontFamily="sans-serif" letterSpacing="1">
            {containerCode}
          </text>
          <text x="64" y="96" fill="#FFFFFF" fontSize="9" fontWeight="700" fontFamily="sans-serif" opacity="0.8">
            MOVII LOGISTICS FLEET
          </text>
        </g>

        {/* Botón central del contenedor (como en el mockup) */}
        <circle cx="235" cy="120" r="14" fill="#1C1917" fillOpacity="0.8" />
        <path d="M 230 120 L 240 120 M 235 115 L 235 125" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />

        {/* ======================================================== */}
        {/* CHASIS Y ACOPLADO                                        */}
        {/* ======================================================== */}
        <rect x="35" y="195" width="580" height="16" rx="3" fill="#27272A" />
        <rect x="180" y="208" width="120" height="18" rx="2" fill="#3F3F46" />
        {/* Tanque de combustible metálico */}
        <rect x="330" y="200" width="80" height="25" rx="5" fill="#71717A" />
        <rect x="335" y="202" width="70" height="21" rx="4" fill="#A1A1AA" />
        <line x1="355" y1="200" x2="355" y2="225" stroke="#52525B" strokeWidth="2" />
        <line x1="385" y1="200" x2="385" y2="225" stroke="#52525B" strokeWidth="2" />

        {/* ======================================================== */}
        {/* CABINA TRACTORA (BLANCA / MODERNA)                      */}
        {/* ======================================================== */}
        {/* Cuerpo de la cabina */}
        <path
          d="M 430 195 L 430 75 Q 430 45 455 45 L 490 45 Q 530 45 550 85 L 575 145 L 575 195 Z"
          fill="#F8FAFC"
          stroke="#CBD5E1"
          strokeWidth="3"
        />
        {/* Parabrisas frontal y ventanilla lateral */}
        <path
          d="M 445 105 L 445 65 Q 445 55 460 55 L 485 55 Q 515 55 530 90 L 540 120 L 445 120 Z"
          fill="#1E293B"
          stroke="#475569"
          strokeWidth="2"
        />
        {/* Reflejo en el vidrio */}
        <path d="M 460 62 L 490 62 L 455 115 L 450 115 Z" fill="#94A3B8" fillOpacity="0.4" />
        
        {/* Manija de puerta y molduras */}
        <rect x="450" y="135" width="18" height="6" rx="2" fill="#64748B" />
        <line x1="435" y1="125" x2="520" y2="125" stroke="#E2E8F0" strokeWidth="2" />
        <line x1="435" y1="170" x2="550" y2="170" stroke="#E2E8F0" strokeWidth="2" />

        {/* Espejo retrovisor */}
        <rect x="525" y="70" width="8" height="40" rx="3" fill="#0F172A" />
        <line x1="510" y1="80" x2="525" y2="78" stroke="#334155" strokeWidth="3" />
        <line x1="510" y1="100" x2="525" y2="102" stroke="#334155" strokeWidth="3" />

        {/* Ópticas frontales */}
        <polygon points="565,160 575,165 575,185 565,180" fill="#FEF08A" stroke="#EAB308" strokeWidth="1" />
        <polygon points="562,178 574,183 573,190 562,185" fill="#F97316" />

        {/* Escalones de acceso a la cabina */}
        <rect x="440" y="200" width="30" height="4" fill="#334155" />
        <rect x="440" y="208" width="30" height="4" fill="#334155" />

        {/* ======================================================== */}
        {/* RUEDAS DETALLADAS CON LLANTAS DE ALEACIÓN                */}
        {/* ======================================================== */}
        {/* Rueda Trasera 1 */}
        <g transform="translate(100, 222)">
          <circle cx="0" cy="0" r="26" fill="#18181B" />
          <circle cx="0" cy="0" r="18" fill="#52525B" stroke="#A1A1AA" strokeWidth="2" />
          <circle cx="0" cy="0" r="7" fill="#18181B" />
          {Array.from({ length: 8 }).map((_, i) => (
            <circle
              key={i}
              cx={13 * Math.cos((i * Math.PI) / 4)}
              cy={13 * Math.sin((i * Math.PI) / 4)}
              r="2"
              fill="#D4D4D8"
            />
          ))}
        </g>

        {/* Rueda Trasera 2 */}
        <g transform="translate(155, 222)">
          <circle cx="0" cy="0" r="26" fill="#18181B" />
          <circle cx="0" cy="0" r="18" fill="#52525B" stroke="#A1A1AA" strokeWidth="2" />
          <circle cx="0" cy="0" r="7" fill="#18181B" />
          {Array.from({ length: 8 }).map((_, i) => (
            <circle
              key={i}
              cx={13 * Math.cos((i * Math.PI) / 4)}
              cy={13 * Math.sin((i * Math.PI) / 4)}
              r="2"
              fill="#D4D4D8"
            />
          ))}
        </g>

        {/* Rueda Trasera 3 */}
        <g transform="translate(210, 222)">
          <circle cx="0" cy="0" r="26" fill="#18181B" />
          <circle cx="0" cy="0" r="18" fill="#52525B" stroke="#A1A1AA" strokeWidth="2" />
          <circle cx="0" cy="0" r="7" fill="#18181B" />
          {Array.from({ length: 8 }).map((_, i) => (
            <circle
              key={i}
              cx={13 * Math.cos((i * Math.PI) / 4)}
              cy={13 * Math.sin((i * Math.PI) / 4)}
              r="2"
              fill="#D4D4D8"
            />
          ))}
        </g>

        {/* Rueda Delantera Tractor */}
        <g transform="translate(505, 222)">
          <circle cx="0" cy="0" r="26" fill="#18181B" />
          <circle cx="0" cy="0" r="18" fill="#52525B" stroke="#A1A1AA" strokeWidth="2" />
          <circle cx="0" cy="0" r="7" fill="#18181B" />
          {Array.from({ length: 8 }).map((_, i) => (
            <circle
              key={i}
              cx={13 * Math.cos((i * Math.PI) / 4)}
              cy={13 * Math.sin((i * Math.PI) / 4)}
              r="2"
              fill="#D4D4D8"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
