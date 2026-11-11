import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { urlStreamFlota } from "./api";
import type { PosicionVehiculo } from "./types";

export type EstadoConexion = "conectando" | "en_vivo" | "reconectando";

/**
 * Se suscribe al stream SSE de la flota y devuelve la última posición de cada
 * vehículo (por id). EventSource reconecta solo si se corta la conexión.
 * Cuando la API avisa un "cambio" (un envío entregado, una ruta iniciada...)
 * vuelve a pedir los datos de operaciones, envíos y rutas al instante.
 */
export function useFlotaEnVivo(habilitado = true) {
  const [posiciones, setPosiciones] = useState<Record<string, PosicionVehiculo>>({});
  const [estado, setEstado] = useState<EstadoConexion>("conectando");
  const queryClient = useQueryClient();

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
    // Varios cambios seguidos (una ruta que se inicia) se juntan en una sola recarga.
    let espera: number | undefined;
    es.addEventListener("cambio", () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["operaciones"] });
        void queryClient.invalidateQueries({ queryKey: ["envios"] });
        void queryClient.invalidateQueries({ queryKey: ["rutas"] });
      }, 400);
    });
    return () => {
      window.clearTimeout(espera);
      es.close();
    };
  }, [habilitado, queryClient]);

  return { posiciones, estado };
}
