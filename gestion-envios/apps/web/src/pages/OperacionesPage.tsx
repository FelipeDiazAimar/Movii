import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { obtenerDashboard } from "@/features/analitica/api";
import { listarFlota, obtenerTrayecto, obtenerVehiculo } from "@/features/flota/api";
import { useFlotaEnVivo } from "@/features/flota/useFlotaEnVivo";
import { MapaMovii, type ParadaEnMapa, type RutaEnMapa, type VehiculoEnMapa } from "@/features/flota/MapaMovii";
import { TruckIllustration } from "@/features/flota/TruckIllustration";
import { ContenedorPaquetes } from "@/features/flota/ContenedorPaquetes";
import { COLORES_RUTA } from "@/features/flota/colores";
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
import { CountUp, PuntoVivo, SpotlightCard } from "@/components/ui/Efectos";
import {
  AlertTriangle,
  CircleCheck,
  Gauge,
  LayoutDashboard,
  MapPinned,
  Package,
  PackageOpen,
  Phone,
  Route,
  Thermometer,
  TrendingUp,
  Truck,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

function Kpi({ titulo, valor, sufijo, detalle, icono: Icono, tono = "neutro" }: { titulo: string; valor: number; sufijo?: string; detalle?: string; icono: LucideIcon; tono?: "neutro" | "alerta" | "marca" }) {
  const fondo = tono === "marca" ? "bg-movii-500 text-movii-900" : tono === "alerta" ? "bg-red-50 text-red-600" : "bg-hormigon-100 text-gray-700";
  return (
    <SpotlightCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{titulo}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${fondo}`}>
          <Icono className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
        </span>
      </div>
      <p className="font-expandida mt-3 text-3xl font-black leading-none text-gray-900">
        <CountUp value={valor} suffix={sufijo} />
      </p>
      {detalle && <p className="mt-2 truncate text-xs text-gray-500">{detalle}</p>}
    </SpotlightCard>
  );
}

function Tile({ titulo, valor, unidad, icono: Icono }: { titulo: string; valor: number; unidad?: string; icono: LucideIcon }) {
  return (
    <SpotlightCard className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{titulo}</p>
        <Icono className="h-[18px] w-[18px] text-gray-400" aria-hidden />
      </div>
      <p className="font-expandida mt-3 text-3xl font-black text-gray-900">
        <CountUp value={valor} />
        {unidad && <span className="ml-1 text-sm font-semibold text-gray-400">{unidad}</span>}
      </p>
    </SpotlightCard>
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

  // Recorrido de cada camión con ruta hoy: un color por ruta para verlas todas a la vez.
  const conRuta = useMemo(() => vehiculos.filter((v) => v.ruta_id), [vehiculos]);
  const colorDe = useMemo(() => {
    const m: Record<string, string> = {};
    conRuta.forEach((v, i) => (m[v.id] = COLORES_RUTA[i % COLORES_RUTA.length]));
    return m;
  }, [conRuta]);
  const detalles = useQueries({
    queries: conRuta.map((v) => ({
      queryKey: ["operaciones", "flota", v.id],
      queryFn: () => obtenerVehiculo(v.id),
      refetchInterval: 20_000,
    })),
  });
  const rutasEnMapa = useMemo<RutaEnMapa[]>(
    () =>
      conRuta.flatMap((v, i) => {
        const geo = detalles[i]?.data?.recorrido?.geometria;
        return geo
          ? [{ id: v.id, nombre: `${v.ruta_nombre} (${v.patente})`, color: colorDe[v.id], geometria: geo, destacada: v.id === seleccionado?.id }]
          : [];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conRuta, colorDe, seleccionado?.id, ...detalles.map((d) => d.dataUpdatedAt)],
  );

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
          color: colorDe[v.id],
        };
      }),
    [vehiculos, posiciones, seleccionado?.id, colorDe],
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
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-asfalto-900 text-movii-500 shadow-panel">
            <LayoutDashboard className="h-5 w-5" strokeWidth={2.2} aria-hidden />
          </span>
          <div>
            <h1 className="font-expandida text-2xl font-extrabold text-gray-900">Centro de operaciones</h1>
            <p className="text-sm text-gray-500">La flota del día, su carga y dónde está cada camión.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-hormigon-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-panel">
          <PuntoVivo activo={conexion === "en_vivo"} />
          {conexion === "en_vivo" ? "En vivo" : "Conectando…"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Vehículos en servicio" valor={enServicio} detalle={`de ${vehiculos.length} en la flota`} icono={Truck} tono="marca" />
        <Kpi titulo="En mantenimiento" valor={enTaller} detalle="Fuera de servicio" icono={Wrench} tono={enTaller > 0 ? "alerta" : "neutro"} />
        <Kpi
          titulo="Efectividad del día"
          valor={Math.round(m?.porcentaje_efectividad ?? 0)}
          sufijo="%"
          detalle={`${m?.entregados ?? 0} entregados, ${m?.no_entregados ?? 0} fallidos`}
          icono={TrendingUp}
        />
        <Kpi titulo="Envíos en tránsito" valor={(m?.en_camino ?? 0) + (m?.asignados ?? 0)} detalle={`${m?.en_camino ?? 0} en camino ahora`} icono={Package} />
      </div>

      {vehiculos.length === 0 ? (
        <EmptyState title="No hay vehículos en la flota" description="Cargá el primero desde Vehículos." />
      ) : (
        seleccionado && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
              {/* Camión protagonista */}
              <section className="relative overflow-hidden rounded-[1.75rem] border border-hormigon-200 bg-[radial-gradient(120%_90%_at_70%_10%,#ffffff_0%,#f3f4f6_55%,#e6e8eb_100%)] p-4 shadow-lift sm:p-6">
                {/* Ruta bajo el camión: asfalto con línea de carril */}
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-black/[0.06]" />
                <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-5">
                  <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-lift backdrop-blur md:col-span-2">
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
                  <div className="relative md:col-span-3">
                    <div className="relative">
                      <TruckIllustration containerCode={seleccionado.patente} color={seleccionado.estado === "mantenimiento" ? "blanco" : "amarillo"} />
                      <ContenedorPaquetes key={seleccionado.id} paquetes={paquetes} />
                    </div>
                    <div aria-hidden className="mx-4 -mt-3 h-1 rounded-full bg-[repeating-linear-gradient(90deg,#f4b400_0_28px,transparent_28px_52px)] opacity-70" />
                  </div>
                </div>
              </section>

              <VehicleSlider vehiculos={vehiculos} selectedId={seleccionado.id} onSelect={(v) => setSeleccionadoId(v.id)} />

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Tile titulo="Paquetes a bordo" valor={aBordo} unidad={`/ ${seleccionado.total_paquetes}`} icono={PackageOpen} />
                <Tile titulo="Entregados" valor={seleccionado.paquetes_entregados} unidad={seleccionado.paquetes_fallidos ? `${seleccionado.paquetes_fallidos} fallidos` : undefined} icono={CircleCheck} />
                <Tile titulo="Temperatura de carga" valor={seleccionado.temperatura} unidad="°C" icono={Thermometer} />
                <Tile titulo="Velocidad" valor={velocidad} unidad="km/h" icono={Gauge} />
              </div>

              <section className="rounded-panel border border-hormigon-200 bg-white p-5 shadow-panel">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><MapPinned className="h-4 w-4 text-movii-600" aria-hidden />Seguimiento en vivo</h2>
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
                  rutas={trayecto.data?.recorrido ? rutasEnMapa.map((r) => ({ ...r, destacada: false })) : rutasEnMapa}
                  trayecto={trayecto.data?.recorrido?.geometria ?? null}
                  onVehiculoClick={(id) => setSeleccionadoId(id)}
                  onParadaClick={(id) => setEnvioElegido(id)}
                  encuadre={`${seleccionado.id}-${envioElegido ?? ""}-${detalle.data ? "ok" : ""}`}
                />
                {rutasEnMapa.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Rutas en el mapa">
                    {rutasEnMapa.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setSeleccionadoId(r.id)}
                          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                            r.destacada ? "border-asfalto-900 bg-asfalto-900 text-white" : "border-hormigon-200 bg-white text-gray-700 hover:border-hormigon-300"
                          }`}
                        >
                          <span className="h-2.5 w-5 rounded-full" style={{ background: `repeating-linear-gradient(90deg, ${r.color} 0 4px, transparent 4px 7px)` }} />
                          {r.nombre}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
              <section className="rounded-panel border border-hormigon-200 bg-white p-5 shadow-panel">
                <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Truck className="h-4 w-4 text-movii-600" aria-hidden />Información del camión</h2>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-asfalto-900 text-movii-500">
                    {seleccionado.repartidor_nombre ? <span className="text-sm font-bold">{seleccionado.repartidor_nombre.slice(0, 1)}</span> : <UserRound className="h-5 w-5" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">Chofer</p>
                    <p className="truncate font-semibold text-gray-900">{seleccionado.repartidor_nombre || "Sin asignar"}</p>
                  </div>
                  {seleccionado.repartidor_id && (
                    <Link
                      to={`/repartidores/${seleccionado.repartidor_id}`}
                      title="Ver perfil del chofer"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-hormigon-200 text-gray-700 transition-colors hover:bg-hormigon-50"
                    >
                      <Phone className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Ver perfil del chofer</span>
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

              <section className="rounded-panel border border-hormigon-200 bg-white p-5 shadow-panel">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900"><Package className="h-4 w-4 text-movii-600" aria-hidden />Paquetes del camión</h2>
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
          <section className="rounded-panel border border-hormigon-200 bg-white p-5 shadow-panel">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><Route className="h-4 w-4 text-movii-600" aria-hidden />Rutas del día</h2>
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
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-hormigon-100">
                      <div className="h-full rounded-full bg-movii-500" style={{ width: `${r.porcentaje_avance}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-panel border border-hormigon-200 bg-white p-5 shadow-panel">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><AlertTriangle className="h-4 w-4 text-red-500" aria-hidden />Últimas incidencias</h2>
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
