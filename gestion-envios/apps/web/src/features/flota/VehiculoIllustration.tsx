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
  furgon: { left: "8.5%", top: "23%", width: "60%", height: "46%" },
  utilitario: { left: "19.5%", top: "33%", width: "41%", height: "36%" },
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

/** Pasarrueda: hueco recto abajo y arco arriba, como el corte real de la chapa. */
function Pasarrueda({ x, r, piso = 244 }: { x: number; r: number; piso?: number }) {
  return <path d={`M ${x - r} ${piso} L ${x - r} ${piso - 6} A ${r} ${r} 0 0 1 ${x + r} ${piso - 6} L ${x + r} ${piso} Z`} fill="#15181b" />;
}

/** Furgón alto (tipo Sprinter): techo plano, parabrisas inclinado, trompa corta y puerta corrediza. */
function Furgon({ codigo, color }: { codigo: string; color: string }) {
  const id = useId().replace(/:/g, "");
  const c = paletaCarroceria(color);
  const cuerpo = "M66 58 L600 58 Q614 58 622 68 L698 156 L756 168 Q772 172 774 186 L778 236 Q778 244 770 244 L66 244 Q60 244 60 238 L60 64 Q60 58 66 58 Z";
  return (
    <svg viewBox="0 0 820 330" className="h-auto w-full" role="img" aria-label={`Furgón ${codigo}`}>
      <DefsBase id={id} c={c} />
      <Piso id={id} />
      <path d={cuerpo} fill={`url(#${id}-caja)`} />
      <path d={cuerpo} fill={`url(#${id}-brillo-caja)`} />
      {/* Línea de cintura y zócalo */}
      <path d="M60 64 Q60 58 66 58 L600 58 Q614 58 622 68 L628 75 L60 75 Z" fill="#fff" opacity="0.16" />
      <rect x="60" y="224" width="718" height="20" fill="#000" opacity="0.28" />
      <rect x="60" y="200" width="640" height="3" fill="#000" opacity="0.1" />
      {/* Puertas traseras, corrediza (con su riel) y del conductor */}
      <path d="M72 70 L72 224" stroke="#000" strokeOpacity="0.3" strokeWidth="2" />
      <rect x="76" y="132" width="6" height="26" rx="1" fill={`url(#${id}-cromo)`} />
      <path d="M360 72 L360 224 M574 72 L574 224 M360 72 L574 72" stroke="#000" strokeOpacity="0.3" strokeWidth="2" fill="none" />
      <rect x="360" y="90" width="214" height="3" fill="#000" opacity="0.22" />
      <rect x="548" y="148" width="18" height="5" rx="1" fill={`url(#${id}-cromo)`} />
      <path d="M584 72 L584 224 M690 160 L690 224" stroke="#000" strokeOpacity="0.3" strokeWidth="2" />
      <rect x="592" y="166" width="18" height="5" rx="1" fill={`url(#${id}-cromo)`} />
      {/* Ventanilla del conductor con marco */}
      <path d="M592 74 L620 74 L686 152 L592 152 Z" fill="#11161b" />
      <path d="M596 78 L618 78 L678 148 L596 148 Z" fill={`url(#${id}-vidrio)`} />
      <path d="M602 82 L614 82 L640 114 L628 114 Z" fill="#fff" opacity="0.22" />
      <Marca x={110} y={106} ancho={214} codigo={codigo} />
      {/* Luz de posición lateral */}
      <rect x="250" y="212" width="12" height="5" rx="1" fill="#ff9f1a" />
      <rect x="470" y="212" width="12" height="5" rx="1" fill="#ff9f1a" />
      {/* Espejo */}
      <path d="M690 128 L700 128 L700 140 L690 140 Z" fill="#2a2f34" />
      <rect x="696" y="112" width="10" height="30" rx="2" fill="#2a2f34" />
      {/* Óptica, parrilla y paragolpes */}
      <path d="M738 170 L770 178 L774 198 L744 198 Z" fill="#fffbe6" stroke="#8a939b" strokeWidth="1.5" />
      <path d="M744 186 L770 190" stroke="#ffb300" strokeWidth="3" />
      <circle cx="770" cy="188" r="26" fill={`url(#${id}-faro)`} opacity="0.6" />
      <rect x="752" y="202" width="26" height="20" rx="2" fill="#1d2125" />
      {[207, 212, 217].map((y) => (
        <rect key={y} x="755" y={y} width="20" height="2" fill="#4a5158" />
      ))}
      <path d="M724 226 L780 226 L784 244 L720 248 Z" fill="#2a2f34" />
      <rect x="54" y="228" width="58" height="18" rx="2" fill="#2a2f34" />
      <rect x="60" y="150" width="9" height="52" rx="1" fill="#c81e1e" />
      <rect x="60" y="186" width="9" height="10" fill="#ffb300" />
      {/* Ruedas */}
      <Pasarrueda x={182} r={49} />
      <Pasarrueda x={650} r={49} />
      <Rueda x={182} y={258} r={40} id={id} />
      <Rueda x={650} y={258} r={40} id={id} />
    </svg>
  );
}

/** Utilitario compacto (tipo Kangoo/Partner): techo bajo, capot corto y caja de carga sin ventanas. */
function Utilitario({ codigo, color }: { codigo: string; color: string }) {
  const id = useId().replace(/:/g, "");
  const c = paletaCarroceria(color);
  const cuerpo = "M156 96 L512 96 Q530 96 540 106 L606 160 L698 172 Q724 176 726 196 L728 236 Q728 244 720 244 L156 244 Q150 244 150 238 L150 102 Q150 96 156 96 Z";
  return (
    <svg viewBox="0 0 820 330" className="h-auto w-full" role="img" aria-label={`Utilitario ${codigo}`}>
      <DefsBase id={id} c={c} />
      <Piso id={id} cx={440} rx={310} />
      <path d={cuerpo} fill={`url(#${id}-caja)`} />
      <path d={cuerpo} fill={`url(#${id}-brillo-caja)`} />
      <path d="M150 102 Q150 96 156 96 L512 96 Q530 96 540 106 L548 113 L150 113 Z" fill="#fff" opacity="0.16" />
      <rect x="150" y="226" width="578" height="18" fill="#000" opacity="0.28" />
      <rect x="150" y="196" width="560" height="3" fill="#000" opacity="0.1" />
      {/* Barras de techo */}
      <rect x="200" y="88" width="300" height="5" rx="1" fill="#2a2f34" />
      <rect x="214" y="88" width="6" height="9" fill="#2a2f34" />
      <rect x="480" y="88" width="6" height="9" fill="#2a2f34" />
      {/* Puertas */}
      <path d="M162 104 L162 226" stroke="#000" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M404 106 L404 226 M506 106 L506 226 M600 166 L600 226" stroke="#000" strokeOpacity="0.3" strokeWidth="2" />
      <rect x="482" y="152" width="16" height="5" rx="1" fill={`url(#${id}-cromo)`} />
      <rect x="514" y="160" width="16" height="5" rx="1" fill={`url(#${id}-cromo)`} />
      {/* Ventanilla del conductor con marco */}
      <path d="M512 108 L536 108 L596 158 L512 158 Z" fill="#11161b" />
      <path d="M516 112 L534 112 L588 155 L516 155 Z" fill={`url(#${id}-vidrio)`} />
      <path d="M522 116 L532 116 L552 134 L542 134 Z" fill="#fff" opacity="0.22" />
      <Marca x={180} y={124} ancho={200} codigo={codigo} />
      {/* Espejo */}
      <rect x="600" y="138" width="10" height="24" rx="2" fill="#2a2f34" />
      {/* Óptica, parrilla y paragolpes */}
      <path d="M688 176 L722 184 L726 200 L694 200 Z" fill="#fffbe6" stroke="#8a939b" strokeWidth="1.5" />
      <circle cx="722" cy="190" r="24" fill={`url(#${id}-faro)`} opacity="0.6" />
      <rect x="706" y="204" width="22" height="16" rx="2" fill="#1d2125" />
      <path d="M676 226 L730 226 L734 244 L672 248 Z" fill="#2a2f34" />
      <rect x="144" y="228" width="52" height="18" rx="2" fill="#2a2f34" />
      <rect x="150" y="128" width="9" height="46" rx="1" fill="#c81e1e" />
      <rect x="150" y="160" width="9" height="9" fill="#ffb300" />
      <Pasarrueda x={238} r={47} />
      <Pasarrueda x={622} r={47} />
      <Rueda x={238} y={260} r={38} id={id} />
      <Rueda x={622} y={260} r={38} id={id} />
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
