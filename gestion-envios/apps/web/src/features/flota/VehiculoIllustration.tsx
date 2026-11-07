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
  furgon: { left: "9%", top: "29%", width: "54%", height: "44%" },
  utilitario: { left: "17%", top: "34%", width: "34%", height: "37%" },
  moto: { left: "10%", top: "16%", width: "25%", height: "28%" },
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

/** Arco de rueda: media luna oscura sobre la rueda. */
function Arco({ x, y, r }: { x: number; y: number; r: number }) {
  return <path d={`M ${x - r} ${y} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`} fill="#1d2125" />;
}

/** Furgón de reparto (tipo Sprinter): caja alta de una pieza, parabrisas inclinado y trompa corta. */
function Furgon({ codigo, color }: { codigo: string; color: string }) {
  const id = useId().replace(/:/g, "");
  const c = paletaCarroceria(color);
  const cuerpo = "M72 74 Q72 62 86 62 L568 62 Q598 62 616 82 L684 152 Q700 158 726 164 Q778 172 780 204 L780 236 Q780 250 766 250 L86 250 Q72 250 72 236 Z";
  return (
    <svg viewBox="0 0 820 330" className="h-auto w-full" role="img" aria-label={`Furgón ${codigo}`}>
      <DefsBase id={id} c={c} />
      <Piso id={id} />
      {/* Carrocería */}
      <path d={cuerpo} fill={`url(#${id}-caja)`} />
      <path d={cuerpo} fill={`url(#${id}-brillo-caja)`} />
      <path d="M86 62 L568 62 Q598 62 616 82 L626 94 L72 94 L72 74 Q72 62 86 62 Z" fill="#fff" opacity="0.18" />
      {/* Zócalo */}
      <path d="M72 226 L780 226 L780 236 Q780 250 766 250 L86 250 Q72 250 72 236 Z" fill="#000" opacity="0.22" />
      {/* Puerta corrediza y puerta del conductor */}
      <path d="M330 84 L330 226 M556 84 L556 226 M330 84 L556 84" stroke="#000" strokeOpacity="0.28" strokeWidth="2.5" fill="none" />
      <rect x="520" y="150" width="22" height="6" rx="3" fill={`url(#${id}-cromo)`} />
      <path d="M572 84 L572 226" stroke="#000" strokeOpacity="0.28" strokeWidth="2.5" />
      <rect x="578" y="160" width="20" height="6" rx="3" fill={`url(#${id}-cromo)`} />
      {/* Vidrio de la cabina */}
      <path d="M580 86 L606 86 Q616 86 624 96 L668 148 L580 148 Z" fill={`url(#${id}-vidrio)`} />
      <path d="M590 90 L604 90 L634 126 L620 126 Z" fill="#fff" opacity="0.25" />
      {/* Marca pintada en el lateral */}
      <Marca x={92} y={110} ancho={210} codigo={codigo} />
      {/* Espejo */}
      <rect x="686" y="124" width="8" height="22" rx="3" fill="#2a2f34" />
      <rect x="680" y="116" width="20" height="12" rx="4" fill="#2a2f34" />
      {/* Luces y paragolpes */}
      <path d="M752 176 L778 186 L778 204 L760 204 Z" fill="#fffbe6" stroke="#c9ced5" strokeWidth="1" />
      <circle cx="776" cy="190" r="26" fill={`url(#${id}-faro)`} opacity="0.7" />
      <rect x="776" y="210" width="8" height="22" rx="3" fill="#2a2f34" />
      <rect x="742" y="232" width="52" height="16" rx="6" fill={`url(#${id}-cromo)`} />
      <rect x="64" y="236" width="40" height="12" rx="4" fill={`url(#${id}-cromo)`} />
      <rect x="72" y="170" width="8" height="34" rx="3" fill="#dc2626" />
      {/* Ruedas */}
      <Arco x={190} y={250} r={52} />
      <Arco x={640} y={250} r={52} />
      <Rueda x={190} y={256} r={42} id={id} />
      <Rueda x={640} y={256} r={42} id={id} />
    </svg>
  );
}

/** Utilitario compacto (tipo Kangoo/Berlingo): techo redondeado, cabina y caja integradas. */
function Utilitario({ codigo, color }: { codigo: string; color: string }) {
  const id = useId().replace(/:/g, "");
  const c = paletaCarroceria(color);
  const cuerpo = "M132 232 L132 122 Q132 96 160 92 L470 86 Q520 84 548 104 L628 154 L712 166 Q748 172 750 202 L750 234 Q750 250 734 250 L150 250 Q132 250 132 232 Z";
  return (
    <svg viewBox="0 0 820 330" className="h-auto w-full" role="img" aria-label={`Utilitario ${codigo}`}>
      <DefsBase id={id} c={c} />
      <Piso id={id} cx={440} rx={310} />
      <path d={cuerpo} fill={`url(#${id}-caja)`} />
      <path d={cuerpo} fill={`url(#${id}-brillo-caja)`} />
      <path d="M160 92 L470 86 Q520 84 548 104 L560 112 L132 112 L132 122 Q132 96 160 92 Z" fill="#fff" opacity="0.2" />
      <path d="M132 230 L750 230 L750 234 Q750 250 734 250 L150 250 Q132 250 132 232 Z" fill="#000" opacity="0.22" />
      {/* Puertas */}
      <path d="M420 108 L420 228 M510 108 L510 228" stroke="#000" strokeOpacity="0.28" strokeWidth="2.5" />
      <rect x="486" y="160" width="18" height="6" rx="3" fill={`url(#${id}-cromo)`} />
      <rect x="436" y="160" width="18" height="6" rx="3" fill={`url(#${id}-cromo)`} />
      {/* Vidrio de la cabina */}
      <path d="M520 108 L544 108 Q556 108 566 116 L616 154 L520 154 Z" fill={`url(#${id}-vidrio)`} />
      <path d="M530 112 L544 112 L574 138 L560 138 Z" fill="#fff" opacity="0.25" />
      <Marca x={160} y={122} ancho={200} codigo={codigo} />
      {/* Espejo */}
      <rect x="632" y="132" width="8" height="20" rx="3" fill="#2a2f34" />
      <rect x="626" y="126" width="20" height="11" rx="4" fill="#2a2f34" />
      {/* Luces y paragolpes */}
      <path d="M720 176 L748 184 L748 202 L728 202 Z" fill="#fffbe6" stroke="#c9ced5" strokeWidth="1" />
      <circle cx="746" cy="190" r="24" fill={`url(#${id}-faro)`} opacity="0.7" />
      <rect x="746" y="208" width="8" height="20" rx="3" fill="#2a2f34" />
      <rect x="712" y="232" width="50" height="16" rx="6" fill={`url(#${id}-cromo)`} />
      <rect x="124" y="236" width="40" height="12" rx="4" fill={`url(#${id}-cromo)`} />
      <rect x="132" y="170" width="8" height="30" rx="3" fill="#dc2626" />
      <Arco x={250} y={250} r={50} />
      <Arco x={600} y={250} r={50} />
      <Rueda x={250} y={258} r={40} id={id} />
      <Rueda x={600} y={258} r={40} id={id} />
    </svg>
  );
}

/** Moto scooter de reparto con baúl trasero. */
function Moto({ codigo, color }: { codigo: string; color: string }) {
  const id = useId().replace(/:/g, "");
  const c = paletaCarroceria(color);
  return (
    <svg viewBox="0 0 820 330" className="h-auto w-full" role="img" aria-label={`Moto ${codigo}`}>
      <DefsBase id={id} c={c} />
      <Piso id={id} cx={420} rx={300} />
      {/* Rueda trasera (queda tapada por la carrocería) */}
      <Rueda x={250} y={258} r={40} id={id} />
      {/* Parrilla y baúl */}
      <rect x="110" y="148" width="190" height="12" rx="3" fill="#2a2f34" />
      <rect x="82" y="52" width="210" height="98" rx="16" fill={`url(#${id}-caja)`} />
      <rect x="82" y="52" width="210" height="98" rx="16" fill={`url(#${id}-brillo-caja)`} />
      <rect x="82" y="52" width="210" height="18" rx="9" fill="#fff" opacity="0.2" />
      <Marca x={106} y={74} ancho={166} codigo={codigo} />
      {/* Carrocería trasera y asiento */}
      <path d="M176 240 Q164 176 200 162 L440 158 Q462 162 464 190 L464 232 Q464 246 450 246 L192 246 Q178 246 176 240 Z" fill={`url(#${id}-caja)`} />
      <path d="M300 160 Q304 140 334 140 L426 140 Q452 142 458 160 Z" fill="#23272b" />
      <rect x="168" y="176" width="9" height="22" rx="3" fill="#dc2626" />
      {/* Estribo y escudo delantero */}
      <rect x="456" y="228" width="80" height="16" rx="6" fill={`url(#${id}-chasis)`} />
      <path d="M526 244 L548 112 Q552 100 566 102 L586 106 L572 232 Q570 244 556 244 Z" fill={`url(#${id}-caja)`} />
      {/* Horquilla, manubrio y faro */}
      <path d="M586 112 L624 258" stroke={`url(#${id}-cromo)`} strokeWidth="12" strokeLinecap="round" />
      <path d="M578 104 L540 90" stroke="#2a2f34" strokeWidth="9" strokeLinecap="round" />
      <rect x="520" y="82" width="26" height="14" rx="6" fill="#1a1a1a" />
      <path d="M548 90 L536 68" stroke="#2a2f34" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="528" cy="64" rx="16" ry="9" fill="#2a2f34" />
      <circle cx="604" cy="132" r="40" fill={`url(#${id}-faro)`} opacity="0.7" />
      <ellipse cx="598" cy="134" rx="14" ry="17" fill="#fffbe6" stroke="#c9ced5" strokeWidth="1.5" />
      {/* Escape */}
      <rect x="236" y="226" width="150" height="18" rx="9" fill={`url(#${id}-cromo)`} />
      {/* Rueda delantera y guardabarros */}
      <Rueda x={632} y={258} r={40} id={id} />
      <path d="M594 232 Q630 198 672 232" fill="none" stroke={c.base} strokeWidth="10" strokeLinecap="round" />
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
