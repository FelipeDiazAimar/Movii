import { useEffect, useState } from "react";
import { urlStreamFlota } from "./api";
import type { PosicionVehiculo } from "./types";

export type EstadoConexion = "conectando" | "en_vivo" | "reconectando";

/**
 * Se suscribe al stream SSE de la flota y devuelve la última posición de cada
 * vehículo (por id). EventSource reconecta solo si se corta la conexión.
 */
export function useFlotaEnVivo(habilitado = true) {
  const [posiciones, setPosiciones] = useState<Record<string, PosicionVehiculo>>({});
  const [estado, setEstado] = useState<EstadoConexion>("conectando");

  useEffect(() => {
    if (!habilitado || typeof EventSource === "undefined") return;
    const es = new EventSource(urlStreamFlota());
    es.onopen = () => setEstado("en_vivo");
    es.onerror = () => setEstado("reconectando");
    es.addEventListener("posicion", (ev) => {
      try {
        const p = JSON.parse((ev as MessageEvent<string>).data) as PosicionVehiculo;
        setPosiciones((prev) => ({ ...prev, [p.vehiculo_id]: p }));
      } catch {
        // evento mal formado: se ignora
      }
    });
    return () => es.close();
  }, [habilitado]);

  return { posiciones, estado };
}
