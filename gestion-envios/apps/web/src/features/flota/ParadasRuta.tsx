import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Navigation, Truck, X } from "lucide-react";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { MarcaParada } from "./paradas";
import { distanciaM } from "@/features/mapas/geo3d";
import type { PaqueteVehiculo, TrayectoEnvio } from "./types";

const PENDIENTE = new Set(["asignado", "en_camino"]);

function duracion(seg: number) {
  const min = Math.max(1, Math.round(seg / 60));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

interface Props {
  paquetes: PaqueteVehiculo[];
  elegido: string | null;
  onElegir: (envioId: string | null) => void;
  /** Camino del camión hasta el envío elegido (si está pendiente). */
  trayecto?: TrayectoEnvio;
  cargando?: boolean;
  className?: string;
  /** La ruta salió del depósito: la próxima parada es a la que el camión está yendo ahora. */
  enCurso?: boolean;
  /** Posición del camión, para saber si ya está en la puerta. */
  camion?: { lat: number; lng: number; velocidad: number };
  /** Camino del camión hasta la próxima parada (distancia y tiempo). */
  trayectoProxima?: TrayectoEnvio;
}

/**
 * Las paradas de la ruta del camión, en orden de entrega. Elegir una la
 * marca en el mapa (y el mapa traza el camino del camión hasta ahí); elegirla
 * en el mapa o en la caja del camión la abre acá.
 */
export function ParadasRuta({ paquetes, elegido, onElegir, trayecto, cargando, className = "", enCurso = false, camion, trayectoProxima }: Props) {
  const lista = useRef<HTMLOListElement>(null);
  const resueltas = paquetes.filter((p) => !PENDIENTE.has(p.estado)).length;
  const proxima = paquetes.find((p) => PENDIENTE.has(p.estado))?.envio_id;
  const paqueteProximo = paquetes.find((p) => p.envio_id === proxima);
  // ¿El camión ya está en la puerta de la próxima parada?
  const enLaPuerta = Boolean(
    enCurso &&
      camion &&
      paqueteProximo?.coordenadas &&
      camion.velocidad < 1 &&
      distanciaM([camion.lng, camion.lat], [paqueteProximo.coordenadas.lng, paqueteProximo.coordenadas.lat]) < 60,
  );
  const llegada =
    trayectoProxima?.envio_id === proxima && trayectoProxima?.recorrido
      ? `Llega en ~${duracion(trayectoProxima.recorrido.duracion_s)} · ${(trayectoProxima.recorrido.distancia_m / 1000).toFixed(1).replace(".", ",")} km`
      : "En viaje hacia acá";

  // Sin nada elegido, la lista se ubica sola: las dos últimas paradas resueltas
  // arriba, la próxima en tercer lugar y el resto abajo. Se reacomoda cada vez
  // que se resuelve una parada (o se cambia de camión), no mientras se mira.
  const ruta = paquetes[0]?.envio_id ?? "";
  const indiceProxima = paquetes.findIndex((p) => PENDIENTE.has(p.estado));
  useEffect(() => {
    const ol = lista.current;
    if (!ol || elegido || indiceProxima < 0) return;
    const desde = Math.max(0, indiceProxima - 2);
    const li = ol.querySelectorAll<HTMLElement>("li[data-envio]")[desde];
    if (!li) return;
    ol.scrollTo({ top: li.getBoundingClientRect().top - ol.getBoundingClientRect().top + ol.scrollTop, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, indiceProxima, resueltas]);

  // La parada elegida (desde el mapa o el camión) se ve en la lista, sin mover la página.
  useEffect(() => {
    const ol = lista.current;
    const li = elegido ? ol?.querySelector<HTMLElement>(`[data-envio="${elegido}"]`) : null;
    if (!ol || !li) return;
    const arriba = li.getBoundingClientRect().top - ol.getBoundingClientRect().top + ol.scrollTop;
    if (arriba < ol.scrollTop || arriba + li.offsetHeight > ol.scrollTop + ol.clientHeight) {
      ol.scrollTo({ top: Math.max(0, arriba - 8), behavior: "smooth" });
    }
  }, [elegido]);

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <p className="text-sm font-bold text-gray-900">Paradas de la ruta</p>
        <p className="text-xs text-gray-500">
          {resueltas} de {paquetes.length} resueltas
        </p>
      </div>
      <div className="mx-1 mt-2 h-1.5 overflow-hidden rounded-full bg-hormigon-100">
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${paquetes.length ? (resueltas / paquetes.length) * 100 : 0}%` }} />
      </div>

      {cargando ? (
        <p className="px-1 py-6 text-sm text-gray-500">Cargando paradas…</p>
      ) : paquetes.length === 0 ? (
        <p className="px-1 py-6 text-sm text-gray-500">Este vehículo no tiene ruta hoy.</p>
      ) : (
        <ol ref={lista} className="relative mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {paquetes.map((p, i) => {
            const abierto = p.envio_id === elegido;
            const esProxima = p.envio_id === proxima;
            const ahora = esProxima && enCurso;
            const ultimo = i === paquetes.length - 1;
            return (
              <li key={p.envio_id} data-envio={p.envio_id} className="relative pl-10">
                {/* Línea que une las paradas, como un recorrido */}
                {!ultimo && <span aria-hidden className={`absolute bottom-0 left-[18px] top-7 w-0.5 ${PENDIENTE.has(p.estado) ? "bg-hormigon-200" : "bg-emerald-300"}`} />}
                <span className="absolute left-1 top-2">
                  <MarcaParada orden={p.orden} estado={p.estado} ahora={ahora} />
                </span>
                <div
                  className={`mb-2 rounded-xl border transition-colors ${
                    abierto ? "border-movii-500 bg-movii-50/60 shadow-panel" : ahora ? "border-amber-300 bg-amber-50/70" : "border-transparent hover:bg-hormigon-50"
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={abierto}
                    onClick={() => onElegir(abierto ? null : p.envio_id)}
                    className="flex w-full items-start justify-between gap-2 px-2.5 py-2 text-left"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="tabular text-sm font-semibold text-gray-900">{p.codigo_guia}</span>
                        {esProxima && !enCurso && <span className="rounded-full bg-hormigon-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">Primera parada</span>}
                        {p.urgente && <span className="text-[10px] font-bold text-red-600">URGENTE</span>}
                        {p.fragil && <span className="text-[10px] font-bold text-amber-700">FRÁGIL</span>}
                      </span>
                      <span className="block truncate text-xs text-gray-600">{p.destinatario_nombre}</span>
                      <span className="block truncate text-xs text-gray-500">{p.direccion}</span>
                      {ahora && (
                        <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                          </span>
                          {enLaPuerta ? "En la puerta, entregando" : llegada}
                        </span>
                      )}
                    </span>
                    {ahora ? (
                      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">
                        <Truck className="h-3.5 w-3.5" aria-hidden />
                        {enLaPuerta ? "Entregando" : "Yendo ahora"}
                      </span>
                    ) : (
                      <EstadoEnvioBadge estado={p.estado} />
                    )}
                  </button>
                  {abierto && (
                    <div className="border-t border-movii-500/20 px-2.5 pb-2.5 pt-2 text-xs text-gray-700">
                      <dl className="grid grid-cols-3 gap-2">
                        <div>
                          <dt className="text-gray-500">Peso</dt>
                          <dd className="font-semibold">{p.peso} kg</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Tamaño</dt>
                          <dd className="font-semibold capitalize">{p.tamano}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-gray-500">Contenido</dt>
                          <dd className="truncate font-semibold" title={p.tipo_contenido}>{p.tipo_contenido || "—"}</dd>
                        </div>
                      </dl>
                      {PENDIENTE.has(p.estado) && (
                        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-gray-700 ring-1 ring-hormigon-200">
                          <Navigation className="h-3.5 w-3.5 shrink-0 text-movii-600" aria-hidden />
                          {trayecto?.envio_id === p.envio_id && trayecto.recorrido
                            ? `A ${(trayecto.recorrido.distancia_m / 1000).toFixed(1).replace(".", ",")} km del camión, ~${duracion(trayecto.recorrido.duracion_s)}${
                                trayecto.paradas_antes > 0 ? ` · ${trayecto.paradas_antes} ${trayecto.paradas_antes === 1 ? "parada" : "paradas"} antes` : " · es la próxima"
                              }`
                            : "Calculando el camino desde el camión…"}
                        </p>
                      )}
                      {!p.coordenadas && <p className="mt-2 text-amber-700">Sin ubicación en el mapa (dirección no encontrada).</p>}
                      <div className="mt-2 flex items-center justify-between">
                        <Link to={`/envios/${p.envio_id}`} className="inline-flex items-center gap-1 font-semibold text-movii-700 hover:underline">
                          Abrir el envío
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                        <button type="button" onClick={() => onElegir(null)} className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900">
                          <X className="h-3.5 w-3.5" aria-hidden />
                          Quitar selección
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
