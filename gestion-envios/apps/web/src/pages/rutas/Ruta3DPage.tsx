import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { hayWebGL } from "@/features/mapas/webgl";
import { RutaMapaPage } from "@/pages/rutas/RutaMapaPage";
import { obtenerMapaRuta } from "@/features/analitica/api";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Card, EmptyState } from "@/components/ui/Card";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { Toggle2D3D } from "@/components/ui/Toggle2D3D";
import { BotonAbrirMaps } from "@/features/mapas/BotonAbrirMaps";
import { getApiErrorMessage } from "@/services/api-client";

// maplibre-gl pesa: se baja solo al entrar a la vista 3D.
const Mapa3D = lazy(() => import("@/features/mapas/Mapa3D").then((m) => ({ default: m.Mapa3D })));

function Ruta3DContent() {
  const { id } = useParams<{ id: string }>();
  const rutaId = id as string;
  const [elegido, setElegido] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["rutas", rutaId, "mapa"],
    queryFn: () => obtenerMapaRuta(rutaId),
    enabled: Boolean(rutaId),
    refetchInterval: 30_000,
  });

  const paradas = useMemo(
    () => [...(data?.paradas ?? [])].sort((a, b) => a.orden - b.orden),
    [data?.paradas],
  );

  if (isLoading) return <Spinner label="Cargando vista 3D…" />;
  if (isError) return <Alert variant="error">{getApiErrorMessage(error, "No se pudo cargar la ruta")}</Alert>;
  if (!data) return null;

  const v = data.vehiculo;

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado con información de ruta y barra de herramientas (Toggle 2D/3D + Abrir en Maps) */}
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
          <Toggle2D3D rutaId={rutaId} modo="3d" />
          <BotonAbrirMaps rutaId={rutaId} />
        </div>
      </div>

      {/* Contenedor del Mapa 3D */}
      <Suspense fallback={<Spinner label="Cargando motor de mapa 3D…" />}>
        <Mapa3D rutaId={rutaId} paradaDestacadaId={elegido} />
      </Suspense>

      {/* Listado interactivo de paradas */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Paradas de la ruta</h2>
          {elegido && (
            <button
              type="button"
              className="text-xs font-semibold text-movii-600 hover:underline"
              onClick={() => setElegido(null)}
            >
              Ver todas las paradas
            </button>
          )}
        </div>

        {paradas.length === 0 ? (
          <EmptyState title="La ruta no tiene paradas" />
        ) : (
          <ol className="divide-y divide-gray-100 text-sm">
            {paradas.map((p) => (
              <li
                key={p.envio_id}
                onClick={() => p.coordenadas && setElegido(p.envio_id)}
                className={`flex items-center justify-between py-2.5 px-2 rounded-lg transition-colors cursor-pointer ${
                  p.envio_id === elegido ? "bg-amber-50" : "hover:bg-gray-50"
                }`}
              >
                <div>
                  <span className="mr-2 font-semibold text-gray-900">{p.orden}.</span>
                  <Link
                    to={`/envios/${p.envio_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-movii-600 hover:underline"
                  >
                    {p.codigo_guia}
                  </Link>
                  <span className="ml-2 text-gray-700">
                    {p.destinatario_nombre} — {p.direccion}, {p.localidad}
                  </span>
                  {!p.coordenadas && (
                    <span className="ml-2 text-xs text-gray-500">Sin ubicación geográfica</span>
                  )}
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

/** Spike T5: ruta en 3D. Sin WebGL cae a la vista 2D existente. */
export function Ruta3DPage() {
  if (!hayWebGL()) {
    return <RutaMapaPage />;
  }
  return <Ruta3DContent />;
}
