import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { obtenerDashboard } from "@/features/analitica/api";
import { listarFlota, obtenerTrayecto, obtenerVehiculo } from "@/features/flota/api";
import { useFlotaEnVivo } from "@/features/flota/useFlotaEnVivo";
import type { RutaEnMapa, VehiculoEnMapa } from "@/features/flota/MapaMovii";
import { SeguimientoEnVivo, type VistaSeguimiento } from "@/features/flota/SeguimientoEnVivo";
import { REGION_CARGA, VehiculoIllustration } from "@/features/flota/VehiculoIllustration";
import { ContenedorPaquetes } from "@/features/flota/ContenedorPaquetes";
import { colorDeFlota } from "@/features/flota/colores";
import { obtenerMapaRuta } from "@/features/analitica/api";
import { CapacityGauge } from "@/features/flota/CapacityGauge";
import { VehicleSlider } from "@/features/flota/VehicleSlider";
import { LineaDeParadas } from "@/features/flota/LineaDeParadas";
import { ETIQUETA_ESTADO_VEHICULO, ETIQUETA_TIPO_VEHICULO, type LatLng, type Vehiculo } from "@/features/flota/types";
import { EmptyState } from "@/components/ui/Card";
import { SkeletonPagina } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { getApiErrorMessage } from "@/services/api-client";
import { BotonSimulacion } from "@/features/demo/BotonSimulacion";

import { formatearFecha, formatearHora } from "@/utils/fechas";
import { CountUp, PuntoVivo, SpotlightCard } from "@/components/ui/Efectos";
import {
  AlertTriangle,
  CircleCheck,
  Gauge,
  LayoutDashboard,
  Package,
  PackageOpen,
  Route,
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

function Tile({ titulo, valor, unidad, icono: Icono, decimales = 0 }: { titulo: string; valor: number; unidad?: string; icono: LucideIcon; decimales?: number }) {
  return (
    <SpotlightCard className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{titulo}</p>
        <Icono className="h-[18px] w-[18px] text-gray-400" aria-hidden />
      </div>
      <p className="font-expandida mt-3 text-3xl font-black text-gray-900">
        <CountUp value={valor} decimals={decimales} />
        {unidad && <span className="ml-1 text-sm font-semibold text-gray-400">{unidad}</span>}
      </p>
    </SpotlightCard>
  );
}

/** Centro de operaciones (HU-11 + HU-18): la flota alrededor del camión, con su carga, ruta y posición en vivo. */
export function OperacionesPage() {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [envioElegido, setEnvioElegido] = useState<string | null>(null);
  const [vistaMapa, setVistaMapa] = useState<"2d" | "3d">("2d");
  const [vista, setVista] = useState<VistaSeguimiento>("ruta");
  const seccionSeguimiento = useRef<HTMLElement>(null);
  const { posiciones, estado: conexion } = useFlotaEnVivo();

  const dashboard = useQuery({ queryKey: ["operaciones", "dashboard"], queryFn: () => obtenerDashboard(), refetchInterval: 30_000 });
  const flota = useQuery({ queryKey: ["operaciones", "flota"], queryFn: () => listarFlota(), refetchInterval: 8_000 });

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
  const colorDe = useMemo(() => colorDeFlota(vehiculos), [vehiculos]);
  const detalles = useQueries({
    queries: conRuta.map((v) => ({
      queryKey: ["operaciones", "flota", v.id],
      queryFn: () => obtenerVehiculo(v.id),
      refetchInterval: 20_000,
    })),
  });
  // La ruta COMPLETA de cada camión (depósito → todas sus paradas, también las ya entregadas). El
  // `recorrido` del detalle del vehículo es solo lo que falta desde donde está ahora, así que no sirve
  // para ver el camino entero ni lo ya recorrido. Comparte la clave con el botón "Abrir en Google Maps".
  const mapasRuta = useQueries({
    queries: conRuta.map((v) => ({
      queryKey: ["rutas", v.ruta_id, "mapa"],
      queryFn: () => obtenerMapaRuta(v.ruta_id!),
      staleTime: 30_000,
      refetchInterval: 60_000,
    })),
  });
  const rutasEnMapa = useMemo<RutaEnMapa[]>(
    () =>
      conRuta.flatMap((v, i) => {
        // Con la ruta completa se ve entera; si todavía no llegó, se muestra lo que falta mientras tanto.
        const completa = mapasRuta[i]?.data?.recorrido?.geometria;
        const geo = completa ?? detalles[i]?.data?.recorrido?.geometria;
        if (!geo || geo.length < 2) return [];
        return [
          {
            id: v.id,
            nombre: `${v.ruta_nombre} (${v.patente})`,
            color: colorDe[v.id],
            geometria: geo,
            completa: Boolean(completa),
            destacada: v.id === seleccionado?.id,
          },
        ];
      }),
    // Una sola clave con los refrescos: la lista de dependencias no puede cambiar de tamaño.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conRuta, colorDe, seleccionado?.id, detalles.map((d) => d.dataUpdatedAt).join(","), mapasRuta.map((m) => m.dataUpdatedAt).join(",")],
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
          color: v.estado === "mantenimiento" ? "#9ca3af" : colorDe[v.id],
          tipo: v.tipo,
          enVivo: Boolean(vivo),
          // Sin GPS, el camión elegido recorre su ruta en simulación (como en 3D).
          simularEn: v.id === seleccionado?.id && v.estado === "activo" && v.ruta_estado === "en_curso" ? (detalle.data?.recorrido?.geometria ?? null) : null,
        };
      }),
    [vehiculos, posiciones, seleccionado?.id, colorDe, detalle.data?.recorrido?.geometria],
  );

  const paquetes = useMemo(() => detalle.data?.paquetes ?? [], [detalle.data]);

  /** Elegir un camión (lista, mapa o filtro) lo muestra con sus paradas. */
  const elegirVehiculo = (id: string) => {
    setSeleccionadoId(id);
    setVista("ruta");
  };
  const cambiarVista = (v: VistaSeguimiento) => {
    setVista(v);
    if (v === "todas") {
      setEnvioElegido(null);
      setVistaMapa("2d");
    }
  };
  /** Un paquete elegido en la caja del camión se ubica en el seguimiento. */
  const elegirDesdeElCamion = (id: string) => {
    setVista("ruta");
    setEnvioElegido(id);
    seccionSeguimiento.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (dashboard.isLoading || flota.isLoading) return <SkeletonPagina label="Cargando el centro de operaciones…" />;
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
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-hormigon-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-panel">
            <PuntoVivo activo={conexion === "en_vivo"} />
            {conexion === "en_vivo" ? "En vivo" : "Conectando…"}
          </span>
          <BotonSimulacion />
        </div>
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
                      <div className="flex justify-between gap-3 py-1.5">
                        <dt className="text-gray-500">Tipo</dt>
                        <dd className="text-right font-medium text-gray-900">
                          {ETIQUETA_TIPO_VEHICULO[seleccionado.tipo]} · {seleccionado.modelo}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 py-1.5">
                        <dt className="text-gray-500">Estado</dt>
                        <dd className="flex items-center gap-1.5 font-medium text-gray-900">
                          <span className={`h-2 w-2 rounded-full ${seleccionado.estado === "activo" ? "bg-green-500" : seleccionado.estado === "mantenimiento" ? "bg-red-500" : "bg-gray-400"}`} />
                          {ETIQUETA_ESTADO_VEHICULO[seleccionado.estado]}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 py-1.5">
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
                      <div className="flex justify-between gap-3 py-1.5">
                        <dt className="text-gray-500">A bordo</dt>
                        <dd className="font-medium text-gray-900">
                          {aBordo} de {seleccionado.total_paquetes} paquetes
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="relative md:col-span-3">
                    <div className="relative">
                      <VehiculoIllustration
                        tipo={seleccionado.tipo}
                        containerCode={seleccionado.patente}
                        color={seleccionado.estado === "mantenimiento" ? "#e9ecef" : colorDe[seleccionado.id]}
                      />
                      <ContenedorPaquetes key={seleccionado.id} paquetes={paquetes} region={REGION_CARGA[seleccionado.tipo]} elegido={envioElegido} onElegir={elegirDesdeElCamion} />
                    </div>
                    <div aria-hidden className="mx-4 -mt-3 h-1 rounded-full bg-[repeating-linear-gradient(90deg,#f4b400_0_28px,transparent_28px_52px)] opacity-70" />
                  </div>
                </div>
              </section>

              <VehicleSlider vehiculos={vehiculos} selectedId={seleccionado.id} onSelect={(v) => elegirVehiculo(v.id)} />

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Tile titulo="Paquetes a bordo" valor={aBordo} unidad={`/ ${seleccionado.total_paquetes}`} icono={PackageOpen} />
                <Tile titulo="Entregados" valor={seleccionado.paquetes_entregados} unidad={seleccionado.paquetes_fallidos ? `${seleccionado.paquetes_fallidos} fallidos` : undefined} icono={CircleCheck} />
                <Tile titulo="Distancia restante" valor={(detalle.data?.recorrido?.distancia_m ?? 0) / 1000} decimales={1} unidad="km" icono={Route} />
                <Tile titulo="Velocidad" valor={velocidad} unidad="km/h" icono={Gauge} />
              </div>

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
                      <UserRound className="h-4 w-4" aria-hidden />
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

            </aside>
          </div>
        )
      )}

      {seleccionado && (
        <SeguimientoEnVivo
          seccionRef={seccionSeguimiento}
          vehiculos={vehiculos}
          colorDe={colorDe}
          seleccionado={seleccionado}
          vista={vista}
          onVista={cambiarVista}
          onElegirVehiculo={elegirVehiculo}
          detalle={detalle.data}
          detalleCargando={detalle.isLoading}
          paquetes={paquetes}
          rutas={rutasEnMapa}
          enMapa={enMapa}
          envioElegido={envioElegido}
          onElegirEnvio={setEnvioElegido}
          trayecto={trayecto.data}
          vivo={vivoSel}
          vistaMapa={vistaMapa}
          onVistaMapa={setVistaMapa}
        />
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
