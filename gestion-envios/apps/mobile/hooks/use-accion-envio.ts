import { useState } from "react";

import { useMovii } from "@/lib/movii-context";
import { mensajeDeError } from "@/lib/seguimiento";

/**
 * Ejecuta una acción del repartidor contra la API (cambio de estado,
 * incidencia, confirmación, reprogramación) y, si sale bien, recarga la ruta
 * del día para que la lista y el detalle muestren el estado real del servidor.
 * Devuelve true si la acción se aplicó.
 */
export function useAccionEnvio() {
  const { recargarEnviosDelDia } = useMovii();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ejecutar = async (accion: () => Promise<void>): Promise<boolean> => {
    setEnviando(true);
    setError(null);
    try {
      await accion();
      await recargarEnviosDelDia();
      return true;
    } catch (e) {
      setError(mensajeDeError(e));
      return false;
    } finally {
      setEnviando(false);
    }
  };

  return { ejecutar, enviando, error, setError };
}
