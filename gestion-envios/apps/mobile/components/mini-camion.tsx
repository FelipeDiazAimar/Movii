import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

import { M } from "@/constants/movii-design";

/** Camión de reparto de perfil, chico, con el logo en la caja. Mira hacia la derecha. */
export function MiniCamion({ ancho = 96, color = M.amarillo }: { ancho?: number; color?: string }) {
  const alto = (ancho * 52) / 110;
  return (
    <Svg width={ancho} height={alto} viewBox="0 0 110 52">
      <Defs>
        <LinearGradient id="mc-caja" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
          <Stop offset="0.25" stopColor={color} />
          <Stop offset="1" stopColor={color} />
        </LinearGradient>
        <LinearGradient id="mc-cab" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#C9CED5" />
        </LinearGradient>
      </Defs>
      <Rect x="2" y="4" width="68" height="34" rx="4" fill="url(#mc-caja)" />
      <Rect x="2" y="32" width="68" height="6" rx="2" fill="#000" opacity="0.18" />
      <SvgText x="36" y="25" fontSize="11" fontWeight="900" fill={M.asfalto} textAnchor="middle">movii</SvgText>
      <Path d="M72 12 L92 12 Q97 12 100 18 L106 28 Q108 31 108 34 L108 38 L72 38 Z" fill="url(#mc-cab)" />
      <Path d="M90 15 L96 15 Q98 15 99.5 18.5 L102 25 L90 25 Z" fill="#1c2a36" />
      <Path d="M77 15 L87 15 L87 25 L77 25 Z" fill="#1c2a36" />
      <Rect x="104" y="29" width="4" height="4" rx="1" fill="#FFE58A" />
      <Rect x="0" y="37" width="110" height="3" rx="1.5" fill="#15181b" />
      <Circle cx="22" cy="42" r="7.5" fill="#15181b" />
      <Circle cx="22" cy="42" r="3.2" fill="#C9CED5" />
      <Circle cx="40" cy="42" r="7.5" fill="#15181b" />
      <Circle cx="40" cy="42" r="3.2" fill="#C9CED5" />
      <Circle cx="92" cy="42" r="7.5" fill="#15181b" />
      <Circle cx="92" cy="42" r="3.2" fill="#C9CED5" />
    </Svg>
  );
}
