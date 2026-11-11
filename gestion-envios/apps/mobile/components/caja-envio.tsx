import { useId } from "react";
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

import { M } from "@/constants/movii-design";

type Props = {
  /** Ancho en px; el alto sale solo (proporción 4:3.4). */
  ancho?: number;
  /** Código de guía impreso en la etiqueta. */
  codigo?: string;
  fragil?: boolean;
  urgente?: boolean;
  /** Color de la cinta (por ejemplo, según el estado del envío). */
  cinta?: string;
};

/**
 * Caja de cartón en perspectiva con cinta, etiqueta con el código y, si
 * corresponde, sellos de "frágil" y "urgente". SVG puro: sin imágenes.
 */
export function CajaEnvio({ ancho = 120, codigo, fragil = false, urgente = false, cinta = M.amarillo }: Props) {
  // Ids únicos por instancia: si dos pantallas montadas repiten el id, el navegador usa el degradado de la oculta (display:none) y la caja queda vacía.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const alto = (ancho * 170) / 200;
  const etiqueta = codigo ? codigo.slice(-8) : "";
  return (
    <Svg width={ancho} height={alto} viewBox="0 0 200 170" accessibilityLabel={codigo ? `Paquete ${codigo}` : "Paquete"}>
      <Defs>
        <LinearGradient id={`cj-izq-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D9A566" />
          <Stop offset="1" stopColor="#B9803F" />
        </LinearGradient>
        <LinearGradient id={`cj-der-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#C48F4F" />
          <Stop offset="1" stopColor="#9C6A31" />
        </LinearGradient>
        <LinearGradient id={`cj-tapa-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F0C48A" />
          <Stop offset="1" stopColor="#DFAE70" />
        </LinearGradient>
      </Defs>
      {/* Sombra */}
      <Path d="M22 140 L100 166 L180 140 L100 120 Z" fill="#000" opacity="0.13" />
      {/* Cara izquierda y derecha */}
      <Path d="M20 58 L100 86 L100 158 L20 128 Z" fill={`url(#cj-izq-${uid})`} />
      <Path d="M180 58 L100 86 L100 158 L180 128 Z" fill={`url(#cj-der-${uid})`} />
      {/* Tapa */}
      <Path d="M20 58 L100 30 L180 58 L100 86 Z" fill={`url(#cj-tapa-${uid})`} />
      {/* Solapas: línea central de la tapa */}
      <Path d="M60 44 L140 72" stroke="#B98644" strokeWidth="1.2" opacity="0.6" />
      {/* Cinta sobre la tapa y la cara izquierda */}
      <Path d="M88 34.5 L108 41.5 L148 69 L128 76 Z" fill={cinta} opacity="0.95" />
      <Path d="M88 80 L108 87 L108 160 L88 153 Z" fill={cinta} opacity="0.95" />
      <Path d="M88 34.5 L108 41.5" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
      {/* Etiqueta en la cara izquierda */}
      <G>
        <Path d="M30 96 L82 114 L82 142 L30 124 Z" fill="#FFFFFF" />
        <Path d="M30 96 L82 114 L82 118 L30 100 Z" fill="#E6E9EC" />
        <Path d="M36 106 L48 110.3 M36 112 L60 120.5 M36 117 L56 124" stroke="#9AA3AB" strokeWidth="1.6" strokeLinecap="round" />
        {etiqueta ? (
          <SvgText x="0" y="0" transform="translate(37 134) rotate(19)" fontSize="7.4" fontWeight="900" fill={M.asfalto}>
            {etiqueta}
          </SvgText>
        ) : null}
      </G>
      {/* Logo en la cara derecha */}
      <G transform="translate(118 96) skewY(-19)">
        <Rect x="0" y="0" width="52" height="20" rx="4" fill="#1A1A1A" opacity="0.92" />
        <SvgText x="8" y="14.5" fontSize="11" fontWeight="900" fill="#FFFFFF">
          movii
        </SvgText>
        <Rect x="38" y="6" width="8" height="8" rx="4" fill={M.amarillo} />
      </G>
      {fragil ? (
        <G transform="translate(118 124) skewY(-19)">
          <Rect x="0" y="0" width="52" height="15" rx="3" fill="#DC2626" />
          <SvgText x="26" y="11" fontSize="8" fontWeight="900" fill="#FFFFFF" textAnchor="middle">
            FRÁGIL
          </SvgText>
        </G>
      ) : null}
      {urgente ? (
        <G>
          <Path d="M132 44 L160 54 L160 66 L132 56 Z" fill="#F4B400" />
          <SvgText x="0" y="0" transform="translate(135 57) rotate(19)" fontSize="7" fontWeight="900" fill={M.asfalto}>
            URGENTE
          </SvgText>
        </G>
      ) : null}
    </Svg>
  );
}
