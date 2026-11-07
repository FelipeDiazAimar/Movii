import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { obtenerDashboard } from "@/features/analitica/api";
import { listarFlota, obtenerTrayecto, obtenerVehiculo } from "@/features/flota/api";
import { useFlotaEnVivo } from "@/features/flota/useFlotaEnVivo";
import { MapaMovii, type ParadaEnMapa, type VehiculoEnMapa } from "@/features/flota/MapaMovii";
import { TruckIllustration } from "@/features/flota/TruckIllustration";
import { CapacityGauge } from "@/features/flota/CapacityGauge";
import { VehicleSlider } from "@/features/flota/VehicleSlider";
import { LineaDeParadas } from "@/features/flota/LineaDeParadas";
import { ETIQUETA_ESTADO_VEHICULO, ETIQUETA_TIPO_VEHICULO, type LatLng, type Vehiculo } from "@/features/flota/types";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { getApiErrorMessage } from "@/services/api-client";
import { formatearFecha, formatearHora } from "@/utils/fechas";

function Kpi({ titulo, valor, detalle, icono }: { titulo: string; valor: string | number; detalle?: string; icono: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-xl" aria-hidden>
        {icono}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-gray-500">{titulo}</p>
        <p className="text-2xl font-black leading-tight text-gray-900">{valor}</p>
        {detalle && <p className="truncate text-[11px] text-gray-400">{detalle}</p>}
      </div>
    </div>
  );
}

function Tile({ titulo, valor, unidad, icono }: { titulo: string; valor: string | number; unidad?: string; icono: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-500">{titulo}</p>
        <span aria-hidden className="text-base">
          {icono}
        </span>
      </div>
      <p className="mt-3 text-3xl font-black text-gray-900">
        {valor}
        {unidad && <span className="ml-0.5 text-sm font-semibold text-gray-400">{unidad}</span>}
      </p>
    </div>
  );
}

function duracion(seg: number) {
  const min = Math.round(seg / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

/** Centro de operaciones (HU-11 + HU-18): la flota alrededor del camión, con su carga, ruta y posición en vivo. */
export function OperacionesPage() {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [envioElegido, setEnvioElegido] = useState<string | null>(null);
  const { posiciones, estado: conexion } = useFlotaEnVivo();

  const dashboard = useQuery({ queryKey: ["operaciones", "dashboard"], queryFn: () => obtenerDashboard(), refetchInterval: 30_000 });
  const flota = useQuery({ queryKey: ["operaciones", "flota"], queryFn: () => listarFlota(), refetchInterval: 30_000 });

  const vehiculos = useMemo(() => flota.data ?? [], [flota.data]);
  const seleccionado: Vehiculo | undefined = vehiculos.find((v) => v.id === seleccionadoId) ?? vehiculos.find((v) => v.ruta_id) ?? vehiculos[0];

  useEffect(() => setEnvioElegido(null), [seleccionado?.id]);

  const detalle = useQuery({
    queryKey: ["operaciones", "flota", seleccionado?.id],
    queryFn: () => obtenerVehiculo(seleccionado!.id),
    enabled: Boolean(seleccionado),
    refetchInterval: 20_000,
  });

  const trayecto = useQuery({
    queryKey: ["envios", envioElegido, "trayecto"],
    queryFn: () => obtenerTrayecto(envioElegido!),
    enabled: Boolean(envioElegido),
    refetchInterval: 15_000,
  });

  const enMapa = useMemo<VehiculoEnMapa[]>(
    () =>
      vehiculos.map((v) => {
        const vivo = posiciones[v.id];
        return {
          id: v.id,
          patente: v.patente,
          pos: [vivo?.lat ?? v.latitud, vivo?.lng ?? v.longitud] as LatLng,
          rumbo: vivo?.rumbo ?? v.rumbo,
          velocidad: vivo?.velocidad ?? v.velocidad,
          destacado: v.id === seleccionado?.id,
        };
      }),
    [vehiculos, posiciones, seleccionado?.id],
  );

  const paquetes = useMemo(() => detalle.data?.paquetes ?? [], [detalle.data]);
  const paradas = useMemo<ParadaEnMapa[]>(
    () =>
      paquetes.flatMap((p) =>
        p.coordenadas
          ? [
              {
                id: p.envio_id,
                orden: p.orden,
                estado: p.estado,
                pos: [p.coordenadas.lat, p.coordenadas.lng] as LatLng,
                titulo: `${p.orden}. ${p.codigo_guia}`,
                detalle: `${p.destinatario_nombre} · ${p.direccion}`,
                destacada: p.envio_id === envioElegido,
              },
            ]
          : [],
      ),
    [paquetes, envioElegido],
  );

  if (dashboard.isLoading || flota.isLoading) return <Spinner label="Cargando el centro de operaciones…" />;
  if (flota.isError) return <Alert variant="error">{getApiErrorMessage(flota.error, "No se pudo cargar la flota")}</Alert>;

  const m = dashboard.data?.metricas;
  const enServicio = vehiculos.filter((v) => v.estado === "activo").length;
  const enTaller = vehiculos.filter((v) => v.estado === "mantenimiento").length;
  const vivoSel = seleccionado ? posiciones[seleccionado.id] : undefined;
  const velocidad = Math.round(vivoSel?.velocidad ?? seleccionado?.velocidad ?? 0);
  const aBordo = paquetes.filter((p) => p.estado === "asignado" || p.estado === "en_camino").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Centro de operaciones</h1>
          <p className="text-sm text-gray-500">La flota del día, su carga y dónde está cada camión.</p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            conexion === "en_vivo" ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${conexion === "en_vivo" ? "animate-pulse bg-green-500" : "bg-amber-500"}`} />
          {conexion === "en_vivo" ? "En vivo" : "Conectando…"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Vehículos en servicio" valor={enServicio} detalle={`de ${vehiculos.length} en la flota`} icono="🚚" />
        <Kpi titulo="En mantenimiento" valor={enTaller} detalle="fuera de servicio" icono="🔧" />
        <Kpi
          titulo="Efectividad del día"
          valor={`${Math.round(m?.porcentaje_efectividad ?? 0)}%`}
          detalle={`${m?.entregados ?? 0} entregados · ${m?.no_entregados ?? 0} fallidos`}
          icono="📈"
        />
        <Kpi titulo="Envíos en tránsito" valor={(m?.en_camino ?? 0) + (m?.asignados ?? 0)} detalle={`${m?.en_camino ?? 0} en camino`} icono="📦" />
      </div>

      {vehiculos.length === 0 ? (
        <EmptyState title="No hay vehículos en la flota" description="Cargá el primero desde Vehículos." />
      ) : (
        seleccionado && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
              {/* Camión protagonista */}
              <section className="relative overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-gray-50 via-white to-amber-50/60 p-4 shadow-sm sm:p-6">
                <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-5">
                  <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-md backdrop-blur md:col-span-2">
                    <p className="text-xs font-medium text-gray-500">Detalle de carga</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-gray-400">Patente</p>
                    <p className="text-2xl font-black text-gray-900">#{seleccionado.patente}</p>
                    <dl className="mt-3 divide-y divide-gray-100 text-sm">
                      <div className="flex justify-between py-1.5">
                        <dt className="text-gray-500">Tipo</dt>
                        <dd className="font-medium text-gray-900">
                          {ETIQUETA_TIPO_VEHICULO[seleccionado.tipo]} · {seleccionado.modelo}
                        </dd>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <dt className="text-gray-500">Estado</dt>
                        <dd className="flex items-center gap-1.5 font-medium text-gray-900">
                          <span className={`h-2 w-2 rounded-full ${seleccionado.estado === "activo" ? "bg-green-500" : seleccionado.estado === "mantenimiento" ? "bg-red-500" : "bg-gray-400"}`} />
                          {ETIQUETA_ESTADO_VEHICULO[seleccionado.estado]}
                        </dd>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <dt className="text-gray-500">Ruta</dt>
                        <dd className="truncate pl-2 font-medium text-gray-900">
                          {seleccionado.ruta_id ? (
                            <Link to={`/rutas/${seleccionado.ruta_id}`} className="hover:underline">
                              {seleccionado.ruta_nombre}
                            </Link>
                          ) : (
                            "Sin ruta hoy"
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <dt className="text-gray-500">A bordo</dt>
                        <dd className="font-medium text-gray-900">
                          {aBordo} de {seleccionado.total_paquetes} paquetes
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="md:col-span-3">
                    <TruckIllustration containerCode={`#${seleccionado.patente}`} />
                  </div>
                </div>
              </section>

              <VehicleSlider vehiculos={vehiculos} selectedId={seleccionado.id} onSelect={(v) => setSeleccionadoId(v.id)} />

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Tile titulo="Paquetes a bordo" valor={aBordo} unidad={`/${seleccionado.total_paquetes}`} icono="📦" />
                <Tile titulo="Entregados" valor={seleccionado.paquetes_entregados} unidad={seleccionado.paquetes_fallidos ? ` · ${seleccionado.paquetes_fallidos} fallidos` : ""} icono="✅" />
                <Tile titulo="Temperatura de carga" valor={seleccionado.temperatura} unidad="°C" icono="🌡️" />
                <Tile titulo="Velocidad" valor={velocidad} unidad="km/h" icono="⏱️" />
              </div>

              <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Seguimiento en vivo</h2>
                    <p className="text-xs text-gray-500">
                      Tocá un camión para inspeccionarlo o un paquete de la lista para ver el camino por las calles hasta su destino.
                    </p>
                  </div>
                  {detalle.data?.recorrido && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      Resta {(detalle.data.recorrido.distancia_m / 1000).toFixed(1)} km · ~{duracion(detalle.data.recorrido.duracion_s)}
                    </span>
                  )}
                </div>
                <MapaMovii
                  className="h-[420px]"
                  vehiculos={enMapa}
                  paradas={paradas}
                  recorrido={trayecto.data?.recorrido ? null : (detalle.data?.recorrido?.geometria ?? null)}
                  trayecto={trayecto.data?.recorrido?.geometria ?? null}
                  onVehiculoClick={(id) => setSeleccionadoId(id)}
                  onParadaClick={(id) => setEnvioElegido(id)}
                  encuadre={`${seleccionado.id}-${envioElegido ?? ""}-${detalle.data ? "ok" : ""}`}
                />
                {trayecto.data && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm">
                    <span>
                      Camino a <strong>{trayecto.data.codigo_guia}</strong> — {trayecto.data.direccion}
                      {trayecto.data.recorrido &&
                        ` · ${(trayecto.data.recorrido.distancia_m / 1000).toFixed(1)} km, ~${duracion(trayecto.data.recorrido.duracion_s)}`}
                      {trayecto.data.paradas_antes > 0 && ` · ${trayecto.data.paradas_antes} parada(s) antes`}
                    </span>
                    <button type="button" className="text-xs font-semibold text-gray-700 hover:underline" onClick={() => setEnvioElegido(null)}>
                      Ver recorrido completo
                    </button>
                  </div>
                )}
              </section>
            </div>

            <aside className="flex min-w-0 flex-col gap-4">
              <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold text-gray-900">Información del camión</h2>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-movii-900 text-sm font-bold text-movii-500">
                    {(seleccionado.repartidor_nombre || "—").slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">Chofer</p>
                    <p className="truncate font-semibold text-gray-900">{seleccionado.repartidor_nombre || "Sin asignar"}</p>
                  </div>
                  {seleccionado.repartidor_id && (
                    <Link
                      to={`/repartidores/${seleccionado.repartidor_id}`}
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Perfil
                    </Link>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-y border-gray-100 py-3 text-center text-xs">
                  <div>
                    <p className="text-gray-500">Patente</p>
                    <p className="font-bold text-gray-900">{seleccionado.patente}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Zona</p>
                    <p className="truncate font-bold text-gray-900">{seleccionado.ruta_zona || "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Última señal</p>
                    <p className="font-bold text-gray-900">{formatearHora(vivoSel?.en ?? seleccionado.posicion_at)}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <LineaDeParadas paquetes={paquetes} seleccionado={envioElegido} onSeleccionar={setEnvioElegido} />
                </div>
                {seleccionado.ruta_id && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link to={`/rutas/${seleccionado.ruta_id}`} className="rounded-xl border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-800 hover:bg-gray-50">
                      Cambiar chofer
                    </Link>
                    <Link to={`/rutas/${seleccionado.ruta_id}/mapa`} className="rounded-xl border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-800 hover:bg-gray-50">
                      Ver ruta en mapa
                    </Link>
                  </div>
                )}
              </section>

              <CapacityGauge
                percentage={seleccionado.capacidad_porcentaje}
                currentLoadKg={seleccionado.carga_actual_peso}
                maxCapacityKg={seleccionado.capacidad_peso}
              />

              <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-bold text-gray-900">Paquetes del camión</h2>
                {detalle.isLoading ? (
                  <Spinner label="Cargando paquetes…" />
                ) : paquetes.length === 0 ? (
                  <EmptyState title="Sin paquetes" description="El vehículo no tiene ruta asignada hoy." />
                ) : (
                  <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto text-sm">
                    {paquetes.map((p) => (
                      <li key={p.envio_id}>
                        <button
                          type="button"
                          onClick={() => setEnvioElegido(p.envio_id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-gray-50 ${envioElegido === p.envio_id ? "bg-amber-50" : ""}`}
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold text-gray-900">
                              {p.orden}. {p.codigo_guia}
                              {p.urgente && <span className="ml-1 text-[10px] font-bold text-red-600">URGENTE</span>}
                              {p.fragil && <span className="ml-1 text-[10px] font-bold text-amber-700">FRÁGIL</span>}
                            </span>
                            <span className="block truncate text-xs text-gray-500">
                              {p.destinatario_nombre} · {p.direccion} · {p.peso} kg
                            </span>
                          </span>
                          <EstadoEnvioBadge estado={p.estado} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {envioElegido && (
                  <Link to={`/envios/${envioElegido}`} className="mt-2 block text-right text-xs font-semibold text-movii-600 hover:underline">
                    Abrir el envío →
                  </Link>
                )}
              </section>
            </aside>
          </div>
        )
      )}

      {dashboard.data && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-gray-900">Rutas del día</h2>
            {dashboard.data.rutas_activas.length === 0 ? (
              <EmptyState title="Sin rutas para hoy" />
            ) : (
              <ul className="flex flex-col gap-3">
                {dashboard.data.rutas_activas.map((r) => (
                  <li key={r.ruta_id}>
                    <div className="flex items-center justify-between text-sm">
                      <Link to={`/rutas/${r.ruta_id}`} className="font-semibold text-gray-900 hover:underline">
                        {r.nombre}
                      </Link>
                      <span className="text-xs text-gray-500">
                        {r.repartidor_nombre} · {r.completadas}/{r.total_paradas}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-movii-500" style={{ width: `${r.porcentaje_avance}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-gray-900">Últimas incidencias</h2>
            {dashboard.data.ultimas_alertas.length === 0 ? (
              <EmptyState title="Sin incidencias hoy" />
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {dashboard.data.ultimas_alertas.map((a) => (
                  <li key={a.envio_id + a.fecha} className="flex items-center justify-between py-2">
                    <Link to={`/envios/${a.envio_id}`} className="font-semibold text-movii-600 hover:underline">
                      {a.codigo_guia}
                    </Link>
                    <span className="text-gray-600">{a.descripcion}</span>
                    <span className="text-xs text-gray-400">{formatearFecha(a.fecha)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
