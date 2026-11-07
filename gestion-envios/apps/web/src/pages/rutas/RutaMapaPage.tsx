import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { obtenerMapaRuta } from "@/features/analitica/api";
import { obtenerTrayecto } from "@/features/flota/api";
import { useFlotaEnVivo } from "@/features/flota/useFlotaEnVivo";
import { MapaMovii, type ParadaEnMapa, type VehiculoEnMapa } from "@/features/flota/MapaMovii";
import type { LatLng } from "@/features/flota/types";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { Card, EmptyState } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Toggle2D3D } from "@/components/ui/Toggle2D3D";
import { BotonAbrirMaps } from "@/features/mapas/BotonAbrirMaps";
import { getApiErrorMessage } from "@/services/api-client";

/** HU-12: la ruta en un mapa real con paradas numeradas, recorrido por calles y el camión en vivo. */
export function RutaMapaPage() {
  const { id } = useParams<{ id: string }>();
  const rutaId = id as string;
  const [elegido, setElegido] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["rutas", rutaId, "mapa"],
    queryFn: () => obtenerMapaRuta(rutaId),
    enabled: Boolean(rutaId),
    refetchInterval: 30_000,
  });
  const { posiciones } = useFlotaEnVivo(Boolean(data?.vehiculo));
  const trayecto = useQuery({
    queryKey: ["envios", elegido, "trayecto"],
    queryFn: () => obtenerTrayecto(elegido!),
    enabled: Boolean(elegido),
    refetchInterval: 15_000,
  });

  const paradas = useMemo(() => [...(data?.paradas ?? [])].sort((a, b) => a.orden - b.orden), [data]);
  const enMapa = useMemo<ParadaEnMapa[]>(
    () =>
      paradas.flatMap((p) =>
        p.coordenadas
          ? [
              {
                id: p.envio_id,
                orden: p.orden,
                estado: p.estado,
                pos: [p.coordenadas.lat, p.coordenadas.lng] as LatLng,
                titulo: `${p.orden}. ${p.codigo_guia}`,
                detalle: `${p.destinatario_nombre} · ${p.direccion}`,
                destacada: p.envio_id === elegido,
              },
            ]
          : [],
      ),
    [paradas, elegido],
  );

  if (isLoading) return <Spinner label="Cargando mapa…" />;
  if (isError) return <Alert variant="error">{getApiErrorMessage(error, "No se pudo cargar el mapa")}</Alert>;
  if (!data) return null;

  const v = data.vehiculo;
  const vivo = v ? posiciones[v.vehiculo_id] : undefined;
  const camiones: VehiculoEnMapa[] = v
    ? [{ id: v.vehiculo_id, patente: v.patente, pos: [vivo?.lat ?? v.lat, vivo?.lng ?? v.lng], rumbo: vivo?.rumbo ?? v.rumbo, velocidad: vivo?.velocidad ?? v.velocidad, destacado: true }]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to={`/rutas/${rutaId}`} className="text-sm text-movii-600 hover:underline">
            ← Volver a la ruta
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">
            {data.nombre}{" "}
            <span className="text-sm font-normal text-gray-500">
              {data.fecha} · {data.repartidor.nombre}
              {v && ` · ${v.patente}`}
            </span>
          </h1>
          {data.recorrido && (
            <p className="text-sm text-gray-500">
              Recorrido por calles: {(data.recorrido.distancia_m / 1000).toFixed(1)} km · ~{Math.round(data.recorrido.duracion_s / 60)} min de manejo
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle2D3D rutaId={rutaId} modo="2d" />
          <BotonAbrirMaps rutaId={rutaId} />
        </div>
      </div>

      {enMapa.length === 0 ? (
        <EmptyState title="Ninguna parada tiene ubicación geográfica" description="No se puede mostrar el mapa de esta ruta." />
      ) : (
        <div>
          <MapaMovii
            className="h-[480px]"
            paradas={enMapa}
            vehiculos={camiones}
            deposito={data.deposito ? [data.deposito.lat, data.deposito.lng] : null}
            recorrido={trayecto.data?.recorrido ? null : (data.recorrido?.geometria ?? null)}
            trayecto={trayecto.data?.recorrido?.geometria ?? null}
            onParadaClick={setElegido}
            encuadre={elegido ?? "ruta"}
          />
          <p className="mt-2 text-xs text-gray-500">
            Tocá una parada para ver el camino por las calles desde el camión hasta ese destino.
            {elegido && (
              <button type="button" className="ml-2 font-semibold text-movii-600 hover:underline" onClick={() => setElegido(null)}>
                Ver recorrido completo
              </button>
            )}
          </p>
        </div>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Paradas</h2>
        {paradas.length === 0 ? (
          <EmptyState title="La ruta no tiene paradas" />
        ) : (
          <ol className="divide-y divide-gray-100 text-sm">
            {paradas.map((p) => (
              <li key={p.envio_id} className={`flex items-center justify-between py-2 ${p.envio_id === elegido ? "bg-amber-50" : ""}`}>
                <div>
                  <span className="mr-2 font-semibold text-gray-900">{p.orden}.</span>
                  <Link to={`/envios/${p.envio_id}`} className="font-medium text-movii-600 hover:underline">
                    {p.codigo_guia}
                  </Link>
                  <span className="ml-2 text-gray-700">
                    {p.destinatario_nombre} — {p.direccion}, {p.localidad}
                  </span>
                  {!p.coordenadas && <span className="ml-2 text-xs text-gray-500">Sin ubicación geográfica</span>}
                </div>
                <EstadoEnvioBadge estado={p.estado} />
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
