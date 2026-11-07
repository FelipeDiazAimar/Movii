import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { obtenerTrayecto } from "./api";
import { useFlotaEnVivo } from "./useFlotaEnVivo";
import { MapaMovii, type VehiculoEnMapa } from "./MapaMovii";
import type { LatLng } from "./types";

/**
 * Seguimiento del envío en un mapa real: el destino, el camión que lo lleva
 * moviéndose en vivo y el camino por las calles que le falta recorrer.
 */
export function SeguimientoEnvioCard({ envioId }: { envioId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["envios", envioId, "trayecto"],
    queryFn: () => obtenerTrayecto(envioId),
    refetchInterval: 15_000,
  });
  const enCurso = data?.estado === "asignado" || data?.estado === "en_camino";
  const { posiciones, estado } = useFlotaEnVivo(Boolean(data?.vehiculo) && enCurso);

  if (isLoading) {
    return (
      <Card>
        <Spinner label="Ubicando el envío…" />
      </Card>
    );
  }
  if (!data) return null;

  const v = data.vehiculo;
  const vivo = v ? posiciones[v.vehiculo_id] : undefined;
  const camiones: VehiculoEnMapa[] =
    v && enCurso
      ? [{ id: v.vehiculo_id, patente: v.patente, pos: [vivo?.lat ?? v.lat, vivo?.lng ?? v.lng], rumbo: vivo?.rumbo ?? v.rumbo, velocidad: vivo?.velocidad ?? v.velocidad, destacado: true }]
      : [];
  const destino: LatLng | null = data.destino ? [data.destino.lat, data.destino.lng] : null;

  let resumen = "";
  if (data.estado === "entregado") resumen = "El envío ya fue entregado.";
  else if (data.estado === "no_entregado") resumen = "La entrega falló: el envío vuelve al depósito.";
  else if (data.estado === "pendiente") resumen = "Todavía no tiene ruta asignada.";
  else if (!v) resumen = "La ruta todavía no tiene un vehículo asignado.";
  else if (data.recorrido) {
    const km = (data.recorrido.distancia_m / 1000).toFixed(1);
    const min = Math.max(1, Math.round(data.recorrido.duracion_s / 60));
    resumen = `${v.patente} está a ${km} km (~${min} min de manejo)` + (data.paradas_antes > 0 ? ` y tiene ${data.paradas_antes} entrega(s) antes.` : ". Es la próxima entrega.");
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Seguimiento en vivo</h2>
        {camiones.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
            <span className={`h-2 w-2 rounded-full ${estado === "en_vivo" ? "animate-pulse bg-green-500" : "bg-amber-500"}`} />
            {estado === "en_vivo" ? "En vivo" : "Conectando…"}
          </span>
        )}
      </div>
      {!destino ? (
        <EmptyState title="Ubicando la dirección en el mapa…" description="La geocodificación tarda unos segundos después del alta." />
      ) : (
        <MapaMovii
          className="h-80"
          paradas={[{ id: data.envio_id, orden: 1, estado: data.estado, pos: destino, titulo: data.codigo_guia, detalle: data.direccion, destacada: true }]}
          vehiculos={camiones}
          trayecto={enCurso ? (data.recorrido?.geometria ?? null) : null}
          encuadre={camiones.length ? "con-camion" : "solo-destino"}
        />
      )}
      {resumen && <p className="mt-2 text-sm text-gray-600">{resumen}</p>}
    </Card>
  );
}
