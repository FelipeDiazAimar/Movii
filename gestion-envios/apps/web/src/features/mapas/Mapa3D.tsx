import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gauge, Package, Route, Timer } from "lucide-react";
import { obtenerMapaRuta } from "@/features/analitica/api";
import { listarFlota } from "@/features/flota/api";
import { useFlotaEnVivo } from "@/features/flota/useFlotaEnVivo";
import { colorDeFlota } from "@/features/flota/colores";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Escena3D, type Parada3D } from "./Escena3D";
import { Hud, Latido } from "./Hud3D";
import { COLOR_PARADA, type LngLat } from "./geo3d";

/** Vista 3D de una ruta en el panel: datos de la ruta, GPS por SSE o simulación. */
export function Mapa3D({ rutaId }: { rutaId: string }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ["rutas", rutaId, "mapa"], queryFn: () => obtenerMapaRuta(rutaId), refetchInterval: 30_000 });
  const flota = useQuery({ queryKey: ["operaciones", "flota"], queryFn: () => listarFlota() });
  const { posiciones } = useFlotaEnVivo(Boolean(data?.vehiculo));

  const linea = useMemo<LngLat[]>(() => (data?.recorrido?.geometria ?? []).map(([lat, lng]) => [lng, lat]), [data?.recorrido?.geometria]);
  const paradas = useMemo<Parada3D[]>(
    () => (data?.paradas ?? []).flatMap((p) => (p.coordenadas ? [{ pos: [p.coordenadas.lng, p.coordenadas.lat] as LngLat, estado: p.estado, etiqueta: String(p.orden) }] : [])),
    [data?.paradas],
  );
  const vehiculoId = data?.vehiculo?.vehiculo_id;
  const color = (vehiculoId && flota.data ? colorDeFlota(flota.data)[vehiculoId] : undefined) ?? "#f4b400";
  const gps = vehiculoId ? posiciones[vehiculoId] : undefined;
  const vivo = useMemo(() => (gps ? { lng: gps.lng, lat: gps.lat, rumbo: gps.rumbo, velocidad: gps.velocidad } : null), [gps]);

  // Spinner centrado en el lugar del mapa.
  if (isLoading)
    return (
      <div className="flex h-[calc(100vh-180px)] min-h-[560px] items-center justify-center rounded-[28px] border border-hormigon-200 bg-white">
        <Spinner label="Cargando mapa 3D…" />
      </div>
    );
  // Si falla un refresco se sigue mostrando lo último que llegó.
  if (!data) return <Alert variant="error">{isError ? "No se pudo cargar el mapa" : "Sin datos de la ruta"}</Alert>;
  if (linea.length === 0 && paradas.length === 0) return <Alert variant="info">La ruta todavía no tiene paradas con ubicación.</Alert>;

  const total = data.paradas.length;
  const entregados = data.paradas.filter((p) => p.estado === "entregado").length;
  const proxima = data.paradas.find((p) => p.estado === "en_camino") ?? data.paradas.find((p) => p.estado === "asignado");
  const km = data.recorrido ? (data.recorrido.distancia_m / 1000).toFixed(1).replace(".", ",") : "–";
  const minutos = data.recorrido ? Math.round(data.recorrido.duracion_s / 60) : null;

  return (
    <div className="relative">
      <Escena3D
        linea={linea}
        paradas={paradas}
        color={color}
        vivo={vivo}
        simular
        hud={(velocidad) => (
          <div className="rounded-2xl border border-white/10 bg-asfalto-900/85 p-4 text-white shadow-lift backdrop-blur-md">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-movii-500">
              <Latido verde={Boolean(vivo)} />
              {vivo ? "GPS en vivo" : "Recorrido simulado"}
            </p>
            <p className="font-expandida mt-1 truncate text-lg font-black">{data.nombre}</p>
            <p className="truncate text-xs text-gray-400">
              {data.repartidor.nombre}
              {data.vehiculo ? ` · ${data.vehiculo.patente}` : ""}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-movii-500 transition-[width] duration-700" style={{ width: `${total ? (entregados / total) * 100 : 0}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Hud icono={Package} etiqueta="Entregas" valor={`${entregados} / ${total}`} acento />
              <Hud icono={Gauge} etiqueta="Velocidad" valor={`${velocidad} km/h`} />
              <Hud icono={Route} etiqueta="Recorrido" valor={`${km} km`} />
              <Hud icono={Timer} etiqueta="Manejo" valor={minutos !== null ? `${minutos} min` : "–"} />
            </div>
            {proxima && (
              <div className="mt-3 rounded-xl bg-white/5 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Próxima parada · {proxima.orden}</p>
                <p className="truncate text-sm font-semibold">{proxima.destinatario_nombre}</p>
                <p className="truncate text-xs text-gray-400">{proxima.direccion}</p>
              </div>
            )}
          </div>
        )}
      />
      {/* Leyenda */}
      <div className="pointer-events-none absolute right-3 top-[132px] hidden flex-col gap-1.5 rounded-xl bg-asfalto-900/80 p-3 text-[11px] font-semibold text-gray-200 backdrop-blur md:flex">
        {[
          ["Pendiente", COLOR_PARADA.asignado],
          ["En camino", COLOR_PARADA.en_camino],
          ["Entregado", COLOR_PARADA.entregado],
          ["No entregado", COLOR_PARADA.no_entregado],
        ].map(([t, c]) => (
          <span key={t} className="flex items-center gap-2">
            <span className="h-3 w-1.5 rounded-sm" style={{ background: c }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
