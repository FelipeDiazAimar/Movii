import { useState } from "react";
import { Check, Pipette, Wand2 } from "lucide-react";
import { COLORES_VEHICULO, esHex, textoSobre } from "@/features/flota/colores";

interface Props {
  /** #RRGGBB, o "" para el color automático. */
  value: string;
  onChange: (hex: string) => void;
  /** Color que tendría en automático (se muestra en la opción "Automático"). */
  automatico?: string;
}

/** Elegir el color de un vehículo: paleta de la marca, automático o un hex propio. */
export function ColorPicker({ value, onChange, automatico }: Props) {
  const [hex, setHex] = useState(esHex(value) && !COLORES_VEHICULO.some((c) => c.hex === value.toLowerCase()) ? value : "");
  const personalizado = esHex(value) && !COLORES_VEHICULO.some((c) => c.hex === value.toLowerCase());

  function escribir(texto: string) {
    const limpio = "#" + texto.replace(/[^0-9a-f]/gi, "").slice(0, 6).toLowerCase();
    setHex(limpio.length > 1 ? limpio : "");
    if (limpio.length === 7) onChange(limpio);
  }

  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Color del vehículo">
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-12">
        <button
          type="button"
          role="radio"
          aria-checked={value === ""}
          title={`Automático${automatico ? "" : ""}`}
          onClick={() => onChange("")}
          className={`relative flex h-9 items-center justify-center rounded-xl border-2 transition-transform hover:scale-110 ${value === "" ? "border-asfalto-900" : "border-hormigon-200"}`}
          style={{ background: automatico ? `linear-gradient(135deg, ${automatico} 50%, #fff 50%)` : "#fff" }}
        >
          <Wand2 className="h-4 w-4 text-asfalto-900 drop-shadow-[0_0_2px_#fff]" aria-hidden />
          <span className="sr-only">Automático</span>
        </button>
        {COLORES_VEHICULO.map((c) => {
          const activo = value.toLowerCase() === c.hex;
          return (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={activo}
              title={c.nombre}
              onClick={() => onChange(c.hex)}
              className={`relative flex h-9 items-center justify-center rounded-xl border-2 shadow-panel transition-transform hover:scale-110 ${activo ? "scale-105 border-asfalto-900" : "border-white ring-1 ring-black/10"}`}
              style={{ backgroundColor: c.hex }}
            >
              {activo && <Check className="h-4 w-4" strokeWidth={3} style={{ color: textoSobre(c.hex) }} aria-hidden />}
              <span className="sr-only">{c.nombre}</span>
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-500">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 ${personalizado ? "border-asfalto-900" : "border-hormigon-200"}`}
          style={{ backgroundColor: personalizado ? value : "#f6f7f8" }}
        >
          <Pipette className="h-4 w-4" style={{ color: personalizado ? textoSobre(value) : "#9ca3af" }} aria-hidden />
        </span>
        <span className="sr-only">Color personalizado</span>
        <input
          value={hex}
          onChange={(e) => escribir(e.target.value)}
          placeholder="#F4B400"
          maxLength={7}
          spellCheck={false}
          aria-label="Color personalizado (hexadecimal)"
          className="w-28 rounded-xl border border-hormigon-300 bg-white px-3 py-2 font-mono text-sm uppercase text-gray-800 shadow-panel outline-none focus-visible:border-movii-500 focus-visible:ring-2 focus-visible:ring-movii-400/60"
        />
        <span>Otro color (hexadecimal)</span>
      </label>
    </div>
  );
}
