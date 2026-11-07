import { useId } from "react";
import { aclarar, esColorHex } from "./colores";

type TruckIllustrationProps = {
  /** Texto pintado en la caja (la patente). */
  containerCode?: string;
  className?: string;
  /** Color de la caja de carga. */
  color?: "amarillo" | "naranja" | "blanco";
  /** #RRGGBB propio del vehículo: pisa a `color`. */
  colorHex?: string;
};

const CAJAS = {
  amarillo: { base: "#F4B400", claro: "#FFD452", oscuro: "#B98600", nervio: "#D99E00" },
  naranja: { base: "#F07A1A", claro: "#FFA552", oscuro: "#B4520A", nervio: "#D9640F" },
  blanco: { base: "#E9ECEF", claro: "#FFFFFF", oscuro: "#AEB5BD", nervio: "#CFD4DA" },
};

/** Rueda con cubierta, llanta de aluminio, cubo y bulones. */
function Rueda({ x, y, r, id }: { x: number; y: number; r: number; id: string }) {
  const bulones = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return { cx: x + Math.cos(a) * r * 0.33, cy: y + Math.sin(a) * r * 0.33 };
  });
  const rayos = Array.from({ length: 10 }, (_, i) => (i / 10) * 360);
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={`url(#${id}-cubierta)`} />
      {/* Dibujo de la cubierta */}
      <circle cx={x} cy={y} r={r - 2} fill="none" stroke="#2b2f33" strokeWidth="3" strokeDasharray="3 4" opacity="0.6" />
      <circle cx={x} cy={y} r={r * 0.66} fill={`url(#${id}-llanta)`} stroke="#5d646b" strokeWidth="1.2" />
      {rayos.map((g) => (
        <rect key={g} x={x - 1.6} y={y - r * 0.62} width="3.2" height={r * 0.3} rx="1.5" fill="#8d959d" opacity="0.7" transform={`rotate(${g} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r={r * 0.42} fill={`url(#${id}-llanta)`} stroke="#6f777e" strokeWidth="1" />
      {bulones.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r={r * 0.045} fill="#3d4349" />
      ))}
      <circle cx={x} cy={y} r={r * 0.16} fill={`url(#${id}-cubo)`} stroke="#4b5157" strokeWidth="1" />
      {/* Brillo de la llanta */}
      <path d={`M ${x - r * 0.5} ${y - r * 0.28} A ${r * 0.6} ${r * 0.6} 0 0 1 ${x + r * 0.2} ${y - r * 0.58}`} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  );
}

/**
 * Camión de reparto en vista lateral, con volumen y luces (SVG, sin imágenes
 * externas). La caja lleva la patente pintada.
 */
export function TruckIllustration({ containerCode = "MOVII", className = "", color = "amarillo", colorHex }: TruckIllustrationProps) {
  const id = useId().replace(/:/g, "");
  const c = esColorHex(colorHex)
    ? { base: colorHex, claro: aclarar(colorHex, 0.35), oscuro: aclarar(colorHex, -0.3), nervio: aclarar(colorHex, -0.15) }
    : CAJAS[color];
  const nervios = Array.from({ length: 22 }, (_, i) => 62 + i * 20.5);

  return (
    <div className={`relative select-none ${className}`}>
      <svg viewBox="0 0 820 330" className="h-auto w-full" role="img" aria-label={`Camión ${containerCode}`}>
        <defs>
          <linearGradient id={`${id}-caja`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.claro} />
            <stop offset="0.18" stopColor={c.base} />
            <stop offset="0.82" stopColor={c.base} />
            <stop offset="1" stopColor={c.oscuro} />
          </linearGradient>
          <linearGradient id={`${id}-brillo-caja`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-cabina`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#eef1f4" />
            <stop offset="1" stopColor="#b9c0c7" />
          </linearGradient>
          <linearGradient id={`${id}-cabina-lado`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity="0.08" />
            <stop offset="0.3" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id={`${id}-vidrio`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3a5266" />
            <stop offset="0.5" stopColor="#1c2a36" />
            <stop offset="1" stopColor="#0d151c" />
          </linearGradient>
          <linearGradient id={`${id}-reflejo`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-cromo`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7f9fa" />
            <stop offset="0.45" stopColor="#9aa3ab" />
            <stop offset="0.55" stopColor="#d9dee2" />
            <stop offset="1" stopColor="#6c757d" />
          </linearGradient>
          <linearGradient id={`${id}-chasis`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3f44" />
            <stop offset="1" stopColor="#15181b" />
          </linearGradient>
          <radialGradient id={`${id}-cubierta`}>
            <stop offset="0.6" stopColor="#24282c" />
            <stop offset="0.92" stopColor="#111315" />
            <stop offset="1" stopColor="#060708" />
          </radialGradient>
          <radialGradient id={`${id}-llanta`} cx="0.4" cy="0.35">
            <stop offset="0" stopColor="#f2f4f6" />
            <stop offset="0.55" stopColor="#b6bdc4" />
            <stop offset="1" stopColor="#7b848c" />
          </radialGradient>
          <radialGradient id={`${id}-cubo`} cx="0.4" cy="0.35">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#8a939b" />
          </radialGradient>
          <radialGradient id={`${id}-faro`}>
            <stop offset="0" stopColor="#fffbe6" />
            <stop offset="0.5" stopColor="#ffe58a" />
            <stop offset="1" stopColor="#f4b400" stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-sombra`} x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        {/* Sombra en el piso */}
        <ellipse cx="410" cy="300" rx="380" ry="16" fill="#0b0d0f" opacity="0.32" filter={`url(#${id}-sombra)`} />
        <ellipse cx="410" cy="298" rx="330" ry="6" fill="#0b0d0f" opacity="0.35" filter={`url(#${id}-sombra)`} />

        {/* Chasis y largueros */}
        <rect x="48" y="238" width="700" height="16" rx="3" fill={`url(#${id}-chasis)`} />

        {/* ===== Caja de carga ===== */}
        <g>
          <rect x="40" y="36" width="490" height="206" rx="6" fill={`url(#${id}-caja)`} />
          {nervios.map((x) => (
            <g key={x}>
              <rect x={x} y="44" width="7" height="190" fill={c.nervio} opacity="0.55" />
              <rect x={x + 7} y="44" width="2" height="190" fill={c.claro} opacity="0.6" />
            </g>
          ))}
          {/* Rieles superior e inferior */}
          <rect x="40" y="36" width="490" height="10" rx="4" fill={`url(#${id}-cromo)`} opacity="0.9" />
          <rect x="40" y="230" width="490" height="12" rx="3" fill={`url(#${id}-chasis)`} />
          {/* Puertas traseras: bisagras y trabas */}
          <rect x="42" y="46" width="22" height="184" fill="#000" opacity="0.07" />
          {[70, 130, 190].map((y) => (
            <rect key={y} x="44" y={y} width="14" height="7" rx="2" fill={`url(#${id}-cromo)`} />
          ))}
          <rect x="60" y="60" width="4" height="160" rx="2" fill={`url(#${id}-cromo)`} />
          {/* Brillo general */}
          <rect x="40" y="36" width="490" height="206" rx="6" fill={`url(#${id}-brillo-caja)`} />
          {/* Marca y patente pintadas */}
          <g transform="translate(118 92)">
            <rect width="250" height="86" rx="10" fill="#1a1a1a" opacity="0.92" />
            <g transform="translate(22 22)">
              <circle cx="20" cy="21" r="20" fill="#f4b400" />
              <path d="M15 11l10 10-10 10" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
            <text x="76" y="44" fill="#ffffff" fontSize="30" fontWeight="900" style={{ fontFamily: "Archivo, system-ui, sans-serif", fontVariationSettings: '"wdth" 125' }}>
              movii
            </text>
            <text x="77" y="68" fill="#f4b400" fontSize="15" fontWeight="700" letterSpacing="2" style={{ fontFamily: "Archivo, system-ui, sans-serif" }}>
              {containerCode}
            </text>
          </g>
          {/* Luces laterales */}
          {[90, 250, 410].map((x) => (
            <rect key={x} x={x} y="222" width="10" height="5" rx="2" fill="#ff9f1a" />
          ))}
        </g>

        {/* Paragolpes lateral y guardabarros traseros */}
        <rect x="250" y="252" width="120" height="8" rx="3" fill={`url(#${id}-cromo)`} />
        <path d="M84 250 a52 52 0 0 1 150 0" fill="#1d2125" />

        {/* Tanque de combustible */}
        <g>
          <rect x="560" y="226" width="78" height="34" rx="16" fill={`url(#${id}-cromo)`} />
          <rect x="574" y="226" width="4" height="34" fill="#7d868e" opacity="0.6" />
          <rect x="620" y="226" width="4" height="34" fill="#7d868e" opacity="0.6" />
        </g>

        {/* ===== Cabina ===== */}
        <g>
          {/* Carrocería */}
          <path
            d="M540 78 Q540 62 556 60 L700 58 Q724 58 736 80 L772 158 Q780 172 780 190 L780 238 Q780 246 772 246 L540 246 Z"
            fill={`url(#${id}-cabina)`}
            stroke="#9aa3ab"
            strokeWidth="1.2"
          />
          <path
            d="M540 78 Q540 62 556 60 L700 58 Q724 58 736 80 L772 158 Q780 172 780 190 L780 238 Q780 246 772 246 L540 246 Z"
            fill={`url(#${id}-cabina-lado)`}
          />
          {/* Deflector de techo */}
          <path d="M548 60 Q552 30 600 28 L690 28 Q710 30 712 58 Z" fill={`url(#${id}-cabina)`} stroke="#a3abb2" strokeWidth="1" />
          {/* Parabrisas y ventanilla */}
          <path d="M688 72 Q712 72 722 90 L752 154 L688 154 Z" fill={`url(#${id}-vidrio)`} />
          <path d="M700 76 L716 82 L736 130 L722 130 Z" fill={`url(#${id}-reflejo)`} opacity="0.8" />
          <path d="M600 74 L676 74 L676 150 L600 150 Q590 150 590 140 L590 84 Q590 74 600 74 Z" fill={`url(#${id}-vidrio)`} />
          <path d="M604 80 L640 80 L612 144 L604 144 Z" fill={`url(#${id}-reflejo)`} opacity="0.7" />
          {/* Puerta */}
          <path d="M584 70 L682 70 L682 236 L584 236 Z" fill="none" stroke="#8a939b" strokeWidth="1.3" opacity="0.8" />
          <rect x="652" y="166" width="22" height="6" rx="3" fill={`url(#${id}-cromo)`} />
          {/* Escalón */}
          <rect x="596" y="232" width="70" height="8" rx="3" fill={`url(#${id}-chasis)`} />
          {/* Espejo */}
          <rect x="752" y="70" width="6" height="40" rx="3" fill="#2a2f34" />
          <rect x="746" y="66" width="18" height="10" rx="3" fill="#2a2f34" />
          {/* Parrilla y paragolpes */}
          <rect x="770" y="176" width="14" height="46" rx="3" fill="#2a2f34" />
          {[182, 190, 198, 206, 214].map((y) => (
            <rect key={y} x="772" y={y} width="10" height="3" rx="1" fill="#59616a" />
          ))}
          <rect x="736" y="232" width="56" height="18" rx="6" fill={`url(#${id}-cromo)`} />
          {/* Faro y halo */}
          <circle cx="784" cy="166" r="30" fill={`url(#${id}-faro)`} opacity="0.85" />
          <rect x="772" y="158" width="14" height="14" rx="4" fill="#fffbe6" stroke="#c9ced5" strokeWidth="1" />
          {/* Escape vertical */}
          <rect x="560" y="70" width="9" height="150" rx="4" fill={`url(#${id}-cromo)`} />
          <rect x="558" y="64" width="13" height="10" rx="3" fill="#3a3f44" />
        </g>

        {/* Guardabarros delantero */}
        <path d="M640 252 a58 58 0 0 1 112 0" fill="#1d2125" />

        {/* Ruedas: tándem trasero de la caja + eje delantero */}
        <Rueda x={120} y={258} r={40} id={id} />
        <Rueda x={202} y={258} r={40} id={id} />
        <Rueda x={696} y={258} r={42} id={id} />
      </svg>
    </div>
  );
}
