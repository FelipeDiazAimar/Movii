import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/services/api-client";
import { actualizarTelefono, formatearTelefono } from "./api";
import { TELEFONO_ERROR, formatearTelefonoAR, limpiarTelefonoAlEscribir, normalizarTelefonoAR } from "@/utils/mascaras";

/** Celda de tabla para ver y cargar el celular de un usuario (acceso y avisos por WhatsApp). */
export function TelefonoEditable({ usuarioId, telefono }: { usuarioId: string; telefono: string }) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(telefono);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const tel = valor.trim();
    // Error propio antes de llamar a la API: vacío = sin teléfono (se borra).
    if (tel && normalizarTelefonoAR(tel) === null) {
      setError(TELEFONO_ERROR);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await actualizarTelefono(usuarioId, tel);
      await queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setEditando(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo guardar"));
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    return (
      <button type="button" className="text-left hover:underline" onClick={() => setEditando(true)} title="Editar celular">
        {telefono ? formatearTelefono(telefono) : <span className="text-gray-400">+ Agregar</span>}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="tel"
          aria-label="Celular"
          className="w-36 rounded-md border border-gray-300 px-2 py-1 text-sm"
          placeholder="3564 41-2345"
          maxLength={20}
          inputMode="tel"
          value={valor}
          onChange={(e) => {
            setValor(limpiarTelefonoAlEscribir(e.target.value));
            setError(null);
          }}
          onBlur={() => setValor((v) => formatearTelefonoAR(v))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void guardar();
            if (e.key === "Escape") setEditando(false);
          }}
        />
        <button type="button" disabled={guardando} className="rounded-md bg-movii-500 px-2 py-1 text-xs font-semibold" onClick={() => void guardar()}>
          OK
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
