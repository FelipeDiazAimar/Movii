import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { obtenerMapaRuta } from "@/features/analitica/api";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { Card, EmptyState } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { getApiErrorMessage } from "@/services/api-client";

const COLORES: Record<string, string> = {
  entregado: "#16a34a",
  en_camino: "#d97706",
  asignado: "#2563eb",
  no_entregado: "#dc2626",
  pendiente: "#6b7280",
};

// divIcon evita los íconos por defecto de Leaflet, que Vite no resuelve.
function iconoParada(orden: number, estado: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${COLORES[estado] ?? COLORES.pendiente};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${orden}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function AjustarVista({ puntos }: { puntos: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(puntos, { padding: [30, 30], maxZoom: 16 });
  }, [map, puntos]);
  return null;
}

export function RutaMapaPage() {
  const { id } = useParams<{ id: string }>();
  const rutaId = id as string;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["rutas", rutaId, "mapa"],
    queryFn: () => obtenerMapaRuta(rutaId),
    enabled: Boolean(rutaId),
  });

  if (isLoading) return <Spinner label="Cargando mapa…" />;
  if (isError) return <Alert variant="error">{getApiErrorMessage(error, "No se pudo cargar el mapa")}</Alert>;
  if (!data) return null;

  const paradas = [...data.paradas].sort((a, b) => a.orden - b.orden);
  const conCoords = paradas.flatMap((p) => (p.coordenadas ? [{ ...p, pos: [p.coordenadas.lat, p.coordenadas.lng] as [number, number] }] : []));
  const puntos = conCoords.map((p) => p.pos);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to={`/rutas/${rutaId}`} className="text-sm text-movii-600 hover:underline">
          ← Volver a la ruta
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">
          {data.nombre}{" "}
          <span className="text-sm font-normal text-gray-500">
            {data.fecha} · {data.repartidor.nombre}
          </span>
        </h1>
      </div>

      {puntos.length === 0 ? (
        <EmptyState title="Ninguna parada tiene ubicación geográfica" description="No se puede mostrar el mapa de esta ruta." />
      ) : (
        <div className="h-96 overflow-hidden rounded-lg border border-gray-200">
          <MapContainer center={puntos[0]} zoom={13} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <AjustarVista puntos={puntos} />
            <Polyline positions={puntos} />
            {conCoords.map((p) => (
              <Marker key={p.envio_id} position={p.pos} icon={iconoParada(p.orden, p.estado)}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{p.codigo_guia}</p>
                    <p>{p.destinatario_nombre}</p>
                    <p>{p.direccion}</p>
                    <p>Estado: {p.estado}</p>
                    <Link to={`/envios/${p.envio_id}`} className="text-movii-600 underline">
                      Ver envío
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Paradas</h2>
        {paradas.length === 0 ? (
          <EmptyState title="La ruta no tiene paradas" />
        ) : (
          <ol className="divide-y divide-gray-100 text-sm">
            {paradas.map((p) => (
              <li key={p.envio_id} className="flex items-center justify-between py-2">
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
