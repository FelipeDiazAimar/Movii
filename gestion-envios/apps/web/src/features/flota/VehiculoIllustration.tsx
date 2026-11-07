import { useId } from "react";
import { Rueda, TruckIllustration } from "./TruckIllustration";
import { paletaCarroceria } from "./colores";
import type { TipoVehiculo } from "./types";

type Props = {
  tipo: TipoVehiculo;
  /** Patente, pintada en el vehículo. */
  containerCode?: string;
  /** Color de la carrocería (#RRGGBB). */
  color?: string;
  className?: string;
};

/**
 * Zona de carga de cada ilustración, en % del SVG (todas miden 820×330): sobre
 * ella se dibuja la caja en corte con los paquetes (ContenedorPaquetes).
 */
export const REGION_CARGA: Record<TipoVehiculo, { left: string; top: string; width: string; height: string }> = {
  camion: { left: "4.9%", top: "10.9%", width: "59.8%", height: "62.4%" },
  furgon: { left: "9%", top: "27%", width: "55%", height: "45%" },
  utilitario: { left: "9.5%", top: "33%", width: "46%", height: "38%" },
  moto: { left: "9.5%", top: "18%", width: "26%", height: "28%" },
};

const FUENTE = { fontFamily: "Archivo, system-ui, sans-serif", fontVariationSettings: '"wdth" 125' } as const;

/** Degradados y filtros comunes (cromo, vidrio, faro, ruedas, sombra). */
function DefsBase({ id, c }: { id: string; c: ReturnType<typeof paletaCarroceria> }) {
  return (
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
  );
}

/** Logo "movii" + patente pintados sobre la carrocería. */
function Marca({ x, y, ancho = 230, codigo }: { x: number; y: number; ancho?: number; codigo: string }) {
  const k = ancho / 250;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <rect width="250" height="86" rx="10" fill="#1a1a1a" opacity="0.92" />
      <g transform="translate(22 22)">
        <circle cx="20" cy="21" r="20" fill="#f4b400" />
        <path d="M15 11l10 10-10 10" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
      <text x="76" y="44" fill="#ffffff" fontSize="30" fontWeight="900" style={FUENTE}>
        movii
      </text>
      <text x="77" y="68" fill="#f4b400" fontSize="15" fontWeight="700" letterSpacing="2" style={{ fontFamily: "Archivo, system-ui, sans-serif" }}>
        {codigo}
      </text>
    </g>
  );
}

function Piso({ id, cx = 410, rx = 380 }: { id: string; cx?: number; rx?: number }) {
  return (
    <>
      <ellipse cx={cx} cy="300" rx={rx} ry="16" fill="#0b0d0f" opacity="0.32" filter={`url(#${id}-sombra)`} />
      <ellipse cx={cx} cy="298" rx={rx - 50} ry="6" fill="#0b0d0f" opacity="0.35" filter={`url(#${id}-sombra)`} />
    </>
  );
}

/** Furgón de reparto: carrocería de una pieza con el frente inclinado. */
function Furgon({ codigo, color }: { codigo: string; color: string }) {
  const id = useId().replace(/:/g, "");
  const c = paletaCarroceria(color);
  const nervios = Array.from({ length: 20 }, (_, i) => 78 + i * 24);
  return (
    <svg viewBox="0 0 820 330" className="h-auto w-full" role="img" aria-label={`Furgón ${codigo}`}>
      <DefsBase id={id} c={c} />
      <Piso id={id} />
      <rect x="62" y="240" width="716" height="14" rx="3" fill={`url(#${id}-chasis)`} />

      {/* Carrocería */}
      <path d="M60 84 Q60 66 80 66 L548 66 Q590 66 618 90 L690 148 Q722 158 750 170 Q778 182 778 208 L778 238 Q778 250 766 250 L72 250 Q60 250 60 238 Z" fill={`url(#${id}-caja)`} />
      {nervios.map((x) => (
        <g key={x}>
          <rect x={x} y="78" width="6" height="150" fill={c.nervio} opacity="0.4" />
          <rect x={x + 6} y="78" width="2" height="150" fill={c.claro} opacity="0.5" />
        </g>
      ))}
      <path d="M60 84 Q60 66 80 66 L548 66 Q590 66 618 90 L690 148 Q722 158 750 170 Q778 182 778 208 L778 238 Q778 250 766 250 L72 250 Q60 250 60 238 Z" fill={`url(#${id}-brillo-caja)`} />
      {/* Riel de techo y zócalo */}
      <rect x="60" y="66" width="500" height="9" rx="4" fill={`url(#${id}-cromo)`} opacity="0.85" />
      <rect x="60" y="232" width="718" height="18" rx="4" fill={`url(#${id}-chasis)`} opacity="0.85" />
      {/* Puertas traseras */}
      <rect x="62" y="78" width="4" height="150" fill="#000" opacity="0.18" />
      <rect x="74" y="90" width="3" height="130" rx="1.5" fill={`url(#${id}-cromo)`} />
      <rect x="64" y="148" width="9" height="22" rx="3" fill={`url(#${id}-cromo)`} />
      <Marca x={112} y={104} codigo={codigo} />

      {/* Cabina: ventanillas y parabrisas */}
      <path d="M560 92 L592 92 Q604 92 614 102 L664 148 L560 148 Z" fill={`url(#${id}-vidrio)`} />
      <path d="M574 96 L598 96 L620 130 L604 130 Z" fill={`url(#${id}-reflejo)`} opacity="0.7" />
      <path d="M548 80 L548 238" stroke="#000" strokeOpacity="0.28" strokeWidth="2" />
      <rect x="560" y="170" width="26" height="6" rx="3" fill={`url(#${id}-cromo)`} />
      {/* Espejo */}
      <rect x="716" y="118" width="6" height="30" rx="3" fill="#2a2f34" />
      <rect x="710" y="112" width="18" height="10" rx="3" fill="#2a2f34" />
      {/* Parrilla, paragolpes y faro */}
      <rect x="766" y="190" width="14" height="38" rx="3" fill="#2a2f34" />
      {[196, 204, 212, 220].map((y) => (
        <rect key={y} x="768" y={y} width="10" height="3" rx="1" fill="#59616a" />
      ))}
      <rect x="738" y="232" width="52" height="18" rx="6" fill={`url(#${id}-cromo)`} />
      <circle cx="778" cy="192" r="28" fill={`url(#${id}-faro)`} opacity="0.85" />
      <rect x="764" y="184" width="14" height="14" rx="4" fill="#fffbe6" stroke="#c9ced5" strokeWidth="1" />
      <rect x="60" y="196" width="8" height="14" rx="3" fill="#dc2626" />

      {/* Pasarruedas y ruedas */}
      <path d="M142 252 a50 50 0 0 1 96 0" fill="#1d2125" />
      <path d="M584 252 a50 50 0 0 1 96 0" fill="#1d2125" />
      <Rueda x={190} y={258} r={40} id={id} />
      <Rueda x={632} y={258} r={40} id={id} />
    </svg>
  );
}

/** Utilitario: pickup con cúpula de carga del color elegido y cabina blanca. */
function Utilitario({ codigo, color }: { codigo: string; color: string }) {
  const id = useId().replace(/:/g, "");
  const c = paletaCarroceria(color);
  return (
    <svg viewBox="0 0 820 330" className="h-auto w-full" role="img" aria-label={`Utilitario ${codigo}`}>
      <DefsBase id={id} c={c} />
      <Piso id={id} />
      <rect x="62" y="238" width="716" height="14" rx="3" fill={`url(#${id}-chasis)`} />

      {/* Caja abierta (batea) y cúpula */}
      <rect x="64" y="170" width="420" height="72" rx="6" fill={`url(#${id}-caja)`} />
      <rect x="64" y="166" width="420" height="10" rx="4" fill={`url(#${id}-cromo)`} opacity="0.85" />
      <path d="M84 170 L84 118 Q84 106 96 106 L446 106 Q460 106 464 120 L476 170 Z" fill={`url(#${id}-caja)`} />
      <path d="M84 170 L84 118 Q84 106 96 106 L446 106 Q460 106 464 120 L476 170 Z" fill={`url(#${id}-brillo-caja)`} />
      <rect x="84" y="106" width="392" height="8" rx="4" fill={`url(#${id}-cromo)`} opacity="0.7" />
      <Marca x={122} y={126} ancho={210} codigo={codigo} />
      <rect x="64" y="226" width="420" height="16" rx="4" fill={`url(#${id}-chasis)`} opacity="0.85" />
      <rect x="64" y="196" width="7" height="14" rx="3" fill="#dc2626" />

      {/* Cabina */}
      <path
        d="M484 170 L484 152 Q496 110 540 98 L640 92 Q672 92 690 122 L716 164 Q770 170 782 196 L782 236 Q782 248 770 248 L484 248 Z"
        fill={`url(#${id}-cabina)`}
        stroke="#9aa3ab"
        strokeWidth="1.2"
      />
      <path d="M606 108 Q640 106 652 126 L688 160 L606 160 Z" fill={`url(#${id}-vidrio)`} />
      <path d="M622 112 L640 114 L666 150 L648 150 Z" fill={`url(#${id}-reflejo)`} opacity="0.8" />
      <path d="M520 114 L592 108 L592 160 L506 160 Q498 160 500 150 Z" fill={`url(#${id}-vidrio)`} />
      <path d="M500 168 L592 168 L592 236 L500 236" fill="none" stroke="#8a939b" strokeWidth="1.3" opacity="0.8" />
      <rect x="566" y="184" width="20" height="6" rx="3" fill={`url(#${id}-cromo)`} />
      {/* Franja del color de la cúpula */}
      <rect x="484" y="226" width="298" height="8" fill={c.base} opacity="0.9" />
      {/* Espejo, parrilla, paragolpes y faro */}
      <rect x="698" y="124" width="6" height="30" rx="3" fill="#2a2f34" />
      <rect x="692" y="118" width="18" height="10" rx="3" fill="#2a2f34" />
      <rect x="772" y="190" width="12" height="34" rx="3" fill="#2a2f34" />
      {[196, 204, 212].map((y) => (
        <rect key={y} x="774" y={y} width="8" height="3" rx="1" fill="#59616a" />
      ))}
      <rect x="740" y="230" width="52" height="18" rx="6" fill={`url(#${id}-cromo)`} />
      <circle cx="780" cy="192" r="28" fill={`url(#${id}-faro)`} opacity="0.85" />
      <rect x="768" y="184" width="14" height="14" rx="4" fill="#fffbe6" stroke="#c9ced5" strokeWidth="1" />

      <path d="M130 252 a50 50 0 0 1 96 0" fill="#1d2125" />
      <path d="M586 252 a50 50 0 0 1 96 0" fill="#1d2125" />
      <Rueda x={178} y={258} r={40} id={id} />
      <Rueda x={634} y={258} r={40} id={id} />
    </svg>
  );
}

/** Moto de reparto con baúl trasero del color elegido. */
function Moto({ codigo, color }: { codigo: string; color: string }) {
  const id = useId().replace(/:/g, "");
  const c = paletaCarroceria(color);
  return (
    <svg viewBox="0 0 820 330" className="h-auto w-full" role="img" aria-label={`Moto ${codigo}`}>
      <DefsBase id={id} c={c} />
      <Piso id={id} cx={410} rx={330} />

      {/* Baúl */}
      <rect x="96" y="160" width="190" height="10" rx="3" fill="#2a2f34" />
      <rect x="150" y="168" width="14" height="42" fill="#2a2f34" />
      <rect x="78" y="62" width="226" height="102" rx="18" fill={`url(#${id}-caja)`} />
      <rect x="78" y="62" width="226" height="102" rx="18" fill={`url(#${id}-brillo-caja)`} />
      <rect x="78" y="62" width="226" height="16" rx="8" fill="#fff" opacity="0.22" />
      <rect x="78" y="136" width="226" height="28" rx="12" fill="#000" opacity="0.1" />
      <Marca x={104} y={86} ancho={174} codigo={codigo} />
      <rect x="82" y="122" width="10" height="14" rx="3" fill="#dc2626" />

      {/* Rueda trasera, guardabarros y amortiguador */}
      <path d="M140 236 a70 70 0 0 1 140 0" fill="none" stroke="#2a2f34" strokeWidth="10" strokeLinecap="round" />
      <path d="M214 236 L368 224" stroke={`url(#${id}-chasis)`} strokeWidth="16" strokeLinecap="round" />
      <path d="M322 168 L296 220" stroke={`url(#${id}-cromo)`} strokeWidth="9" strokeLinecap="round" />
      <path d="M322 168 L296 220" stroke="#dc2626" strokeWidth="4" strokeDasharray="5 4" />

      {/* Motor y escape */}
      <rect x="340" y="196" width="130" height="62" rx="18" fill={`url(#${id}-chasis)`} />
      <rect x="352" y="206" width="52" height="38" rx="10" fill={`url(#${id}-cromo)`} opacity="0.85" />
      <path d="M470 248 L260 252 Q236 252 228 240" fill="none" stroke={`url(#${id}-cromo)`} strokeWidth="14" strokeLinecap="round" />

      {/* Asiento y carenado */}
      <path d="M296 164 Q300 144 330 144 L424 144 Q440 144 442 160 L442 172 L296 172 Z" fill="#23272b" />
      <path d="M424 152 L478 150 Q512 150 528 176 L548 232 L458 232 Q440 208 424 182 Z" fill={`url(#${id}-cabina)`} stroke="#9aa3ab" strokeWidth="1.2" />
      <path d="M486 166 L512 168 L526 200" fill="none" stroke={c.base} strokeWidth="8" strokeLinecap="round" />
      <rect x="440" y="226" width="86" height="8" rx="4" fill="#2a2f34" />

      {/* Horquilla delantera, manubrio y faro */}
      <path d="M610 236 L548 118" stroke={`url(#${id}-cromo)`} strokeWidth="14" strokeLinecap="round" />
      <path d="M600 218 L560 142" stroke="#59616a" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <path d="M548 112 L492 100" stroke="#2a2f34" strokeWidth="9" strokeLinecap="round" />
      <rect x="474" y="92" width="26" height="14" rx="5" fill="#1a1a1a" />
      <path d="M546 108 L534 78" stroke="#2a2f34" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="528" cy="72" rx="16" ry="9" fill="#2a2f34" />
      <circle cx="590" cy="142" r="44" fill={`url(#${id}-faro)`} opacity="0.85" />
      <path d="M552 124 Q582 112 600 132 Q604 154 580 160 Q552 154 552 124 Z" fill="#23272b" stroke="#59616a" strokeWidth="1.5" />
      <ellipse cx="584" cy="138" rx="11" ry="13" fill="#fffbe6" stroke="#c9ced5" strokeWidth="1" />
      {/* Guardabarros delantero */}
      <path d="M568 212 Q612 178 660 214" fill="none" stroke={c.base} strokeWidth="10" strokeLinecap="round" />

      <Rueda x={210} y={236} r={62} id={id} />
      <Rueda x={610} y={236} r={62} id={id} />
    </svg>
  );
}

/**
 * Ilustración del vehículo según su tipo (camión, furgón, utilitario o moto),
 * en el color elegido para él. Todas ocupan el mismo cuadro de 820×330.
 */
export function VehiculoIllustration({ tipo, containerCode = "MOVII", color = "#f4b400", className = "" }: Props) {
  if (tipo === "camion") return <TruckIllustration containerCode={containerCode} color={color} className={className} />;
  return (
    <div className={`relative select-none ${className}`}>
      {tipo === "furgon" && <Furgon codigo={containerCode} color={color} />}
      {tipo === "utilitario" && <Utilitario codigo={containerCode} color={color} />}
      {tipo === "moto" && <Moto codigo={containerCode} color={color} />}
    </div>
  );
}
