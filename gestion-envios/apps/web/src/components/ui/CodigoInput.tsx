import { useEffect, useRef, useState } from "react";
import { Check, ClipboardPaste } from "lucide-react";

interface Props {
  value: string;
  onChange: (valor: string) => void;
  /** Cantidad de dígitos (6 por defecto). */
  largo?: number;
  /** Texto del error: sacude las celdas cada vez que cambia. */
  error?: string | null;
  /** true cuando el código fue aceptado: las celdas se vuelven verdes en ola. */
  ok?: boolean;
  disabled?: boolean;
  label?: string;
  /** Se llama una vez cuando se completan todas las cifras. */
  onCompleto?: (valor: string) => void;
}

const soloDigitos = (s: string, largo: number) => s.replace(/\D/g, "").slice(0, largo);

/**
 * Entrada de código OTP: una celda por cifra, pegar desde el portapapeles con un
 * botón, y animaciones (entrada escalonada, resorte al tipear, cursor parpadeante,
 * sacudida en error, ola verde al aceptar). Debajo hay un <input> real y transparente
 * que recibe el teclado, el pegado y el autocompletado del SMS (one-time-code),
 * así que sigue siendo accesible y funciona igual en el celular.
 */
export function CodigoInput({ value, onChange, largo = 6, error, ok, disabled, label = "Código de verificación", onCompleto }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [foco, setFoco] = useState(false);
  const [pegado, setPegado] = useState(false);
  const [pegadoFallo, setPegadoFallo] = useState(false);
  const completoAvisado = useRef(false);
  // Al volver a escribir, las celdas dejan de verse en rojo (el mensaje lo maneja la página).
  const [descartado, setDescartado] = useState<string | null>(null);
  const errorActivo = error && error !== descartado ? error : null;

  function cambiar(texto: string) {
    if (error) setDescartado(error);
    onChange(soloDigitos(texto, largo));
  }

  useEffect(() => {
    if (value.length === largo) {
      if (!completoAvisado.current) onCompleto?.(value);
      completoAvisado.current = true;
    } else {
      completoAvisado.current = false;
    }
  }, [value, largo, onCompleto]);

  function marcarPegado() {
    setPegado(true);
    window.setTimeout(() => setPegado(false), 1400);
  }

  async function pegar() {
    ref.current?.focus();
    try {
      const texto = soloDigitos(await navigator.clipboard.readText(), largo);
      if (!texto) throw new Error("vacío");
      onChange(texto);
      setPegadoFallo(false);
      marcarPegado();
    } catch {
      // Sin permiso o portapapeles sin dígitos: se deja pegar con Ctrl+V / mantener presionado.
      setPegadoFallo(true);
      window.setTimeout(() => setPegadoFallo(false), 2600);
    }
  }

  const activa = foco ? Math.min(value.length, largo - 1) : -1;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>

      <div className="relative" key={error ?? "sin-error"}>
        <div className={`flex justify-between gap-2 sm:gap-2.5 ${errorActivo ? "otp-sacudir" : ""}`} aria-hidden>
          {Array.from({ length: largo }, (_, i) => {
            const digito = value[i];
            const esActiva = i === activa;
            const lleno = digito !== undefined;
            const estilo = errorActivo
              ? "border-red-400 bg-red-50 text-red-700"
              : ok
                ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                : esActiva
                  ? "border-movii-500 bg-movii-50 text-movii-900 shadow-[0_0_0_4px_rgba(244,180,0,0.22)]"
                  : lleno
                    ? "border-movii-600/60 bg-white text-movii-900"
                    : "border-hormigon-300 bg-white text-gray-400";
            return (
              <div
                key={i}
                style={{ animationDelay: ok ? `${i * 70}ms` : `${i * 45}ms` }}
                className={`otp-celda relative flex h-14 min-w-0 flex-1 items-center justify-center rounded-xl border-2 font-display text-2xl font-extrabold tabular-nums transition-[border-color,background-color,box-shadow,transform] duration-200 sm:h-16 sm:text-3xl ${estilo} ${esActiva ? "-translate-y-0.5" : ""} ${ok ? "otp-ola" : ""}`}
              >
                {lleno && (
                  <span key={`${i}-${digito}`} className="otp-digito">
                    {digito}
                  </span>
                )}
                {esActiva && !lleno && <span className="otp-cursor h-6 w-0.5 rounded-full bg-movii-600" />}
                {ok && <Check className="otp-check absolute -right-1 -top-1 h-4 w-4 rounded-full bg-emerald-500 p-0.5 text-white" aria-hidden />}
              </div>
            );
          })}
        </div>

        <input
          ref={ref}
          aria-label={label}
          name="codigo"
          value={value}
          onChange={(e) => cambiar(e.target.value)}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          onPaste={(e) => {
            const t = soloDigitos(e.clipboardData.getData("text"), largo);
            if (t) {
              e.preventDefault();
              cambiar(t);
              marcarPegado();
            }
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={largo}
          autoFocus
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <button
          type="button"
          onClick={() => void pegar()}
          disabled={disabled}
          className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
            pegado
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-hormigon-300 bg-white text-gray-600 hover:-translate-y-0.5 hover:border-movii-500 hover:text-movii-700 hover:shadow-sm"
          }`}
        >
          {pegado ? <Check className="otp-digito h-3.5 w-3.5" aria-hidden /> : <ClipboardPaste className="h-3.5 w-3.5 transition-transform group-hover:-rotate-6" aria-hidden />}
          {pegado ? "¡Pegado!" : "Pegar código"}
        </button>
        <span className={`transition-opacity duration-300 ${pegadoFallo ? "text-amber-600 opacity-100" : "text-gray-400 opacity-80"}`}>
          {pegadoFallo ? "No pude leer el portapapeles: pegalo con Ctrl+V" : `${value.length}/${largo}`}
        </span>
      </div>
    </div>
  );
}
