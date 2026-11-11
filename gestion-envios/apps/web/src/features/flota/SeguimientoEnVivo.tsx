import { lazy, Suspense, useMemo, type Ref } from "react";
import { useQuery } from "@tanstack/react-query";
import { obtenerTrayecto } from "./api";
import { Layers, MapPinned, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { hayWebGL } from "@/features/mapas/webgl";
import { MapaMovii, type ParadaEnMapa, type RutaEnMapa, type VehiculoEnMapa } from "./MapaMovii";
import { ParadasRuta } from "./ParadasRuta";
import { BotonIniciarRuta } from "@/features/rutas/BotonIniciarRuta";
import type { LatLng, PaqueteVehiculo, PosicionVehiculo, TrayectoEnvio, Vehiculo, VehiculoDetalle } from "./types";

const Operaciones3D = lazy(() => import("@/features/mapas/Operaciones3D").then((m) => ({ default: m.Operaciones3D })));

const DEPOSITO: LatLng = [-31.4279718, -62.0826608];

function duracion(seg: number) {
  const min = Math.round(seg / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

export type VistaSeguimiento = "ruta" | "todas";

interface Props {
  vehiculos: Vehiculo[];
  colorDe: Record<string, string>;
  seleccionado: Vehiculo;
  vista: VistaSeguimiento;
  onVista: (v: VistaSeguimiento) => void;
  onElegirVehiculo: (id: string) => void;
  detalle?: VehiculoDetalle;
  detalleCargando: boolean;
  paquetes: PaqueteVehiculo[];
  rutas: RutaEnMapa[];
  enMapa: VehiculoEnMapa[];
  envioElegido: string | null;
  onElegirEnvio: (id: string | null) => void;
  trayecto?: TrayectoEnvio;
  vivo?: PosicionVehiculo;
  vistaMapa: "2d" | "3d";
  onVistaMapa: (v: "2d" | "3d") => void;
  seccionRef?: Ref<HTMLElement>;
}

/**
 * Seguimiento en vivo: el mapa y las paradas del camión elegido, juntos.
 * Elegir una parada (en la lista, en el mapa o en la caja del camión) la
 * marca en los dos lados y traza el camino del camión hasta ese domicilio.
 * "Todas las rutas" muestra la flota completa con su avance.
 */
export function SeguimientoEnVivo(p: Props) {
  const { seleccionado, vista, paquetes, envioElegido } = p;
  const enRuta = vista === "ruta";
  const conRuta = p.vehiculos.filter((v) => v.ruta_id);
  const proxima = paquetes.find((x) => x.estado === "asignado" || x.estado === "en_camino")?.envio_id;
  // Con la ruta en curso, la próxima parada es a la que el camión está yendo ahora.
  const enCurso = seleccionado.ruta_estado === "en_curso";
  const trayectoProxima = useQuery({
    queryKey: ["envios", proxima, "trayecto"],
    queryFn: () => obtenerTrayecto(proxima!),
    enabled: enRuta && enCurso && Boolean(proxima),
    refetchInterval: 10_000,
  });

  const paradas = useMemo<ParadaEnMapa[]>(
    () =>
      enRuta
        ? paquetes.flatMap((x) =>
            x.coordenadas
              ? [
                  {
                    id: x.envio_id,
                    orden: x.orden,
                    estado: x.estado,
                    pos: [x.coordenadas.lat, x.coordenadas.lng] as LatLng,
                    titulo: `${x.orden}. ${x.codigo_guia}`,
                    detalle: `${x.destinatario_nombre} · ${x.direccion}`,
                    destacada: x.envio_id === envioElegido,
                    proxima: enCurso && x.envio_id === proxima,
                  },
                ]
              : [],
          )
        : [],
    [enRuta, paquetes, envioElegido, proxima, enCurso],
  );

  const rutasVisibles = enRuta
    ? p.rutas.filter((r) => r.id === seleccionado.id).map((r) => ({ ...r, destacada: !p.trayecto?.recorrido }))
    : p.rutas.map((r) => ({ ...r, destacada: true }));
  const vehiculosVisibles = enRuta ? p.enMapa : p.enMapa.map((v) => ({ ...v, destacado: false, simularEn: null }));
  const color = p.colorDe[seleccionado.id] ?? "#f4b400";
  // Qué encuadra el mapa: con un paquete elegido, el camión, la parada y el camino entre
  // los dos; si no, la ruta del camión (los camiones de otras rutas no alejan el zoom).
  const camion = p.enMapa.find((v) => v.id === seleccionado.id)?.pos;
  const elegida = paradas.find((x) => x.id === envioElegido)?.pos;
  const geometriaRuta = p.rutas.find((r) => r.id === seleccionado.id)?.geometria;
  const enfoque: LatLng[] | null = !enRuta
    ? null
    : elegida
      ? [elegida, ...(camion ? [camion] : []), ...(p.trayecto?.envio_id === envioElegido ? (p.trayecto?.recorrido?.geometria ?? []) : [])]
      : [...paradas.map((x) => x.pos), ...(camion ? [camion] : []), ...(geometriaRuta ?? [])];
  const recorrido = p.detalle?.recorrido;
  const enDeposito = enRuta && seleccionado.ruta_estado === "planificada";
  const estadoGps = enRuta && recorrido && seleccionado.estado === "activo" && !enDeposito ? (p.vivo ? "vivo" : "simulado") : null;

  return (
    <section ref={p.seccionRef} className="scroll-mt-4 rounded-panel border border-hormigon-200 bg-white p-4 shadow-panel sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <MapPinned className="h-4 w-4 text-movii-600" aria-hidden />
            Seguimiento en vivo
          </h2>
          <p className="text-xs text-gray-500">
            {enRuta
              ? "Tocá una parada (en la lista, en el mapa o en la caja del camión) para ver el camino del camión hasta ese domicilio."
              : "Toda la flota del día. Elegí una ruta para ver sus paradas."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {enDeposito && seleccionado.ruta_id && (
            <>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Esperando en el depósito</span>
              <BotonIniciarRuta rutaId={seleccionado.ruta_id} estado="planificada" asignados={paquetes.filter((x) => x.estado === "asignado").length} />
            </>
          )}
          {enRuta && recorrido && !enDeposito && (
            <span className="rounded-full bg-hormigon-100 px-3 py-1 text-xs font-medium text-gray-700">
              Le faltan {(recorrido.distancia_m / 1000).toFixed(1).replace(".", ",")} km · ~{duracion(recorrido.duracion_s)}
            </span>
          )}
          {hayWebGL() && (
            <div className="flex rounded-xl bg-hormigon-100 p-1 text-xs font-bold" role="radiogroup" aria-label="Tipo de mapa">
              {(["2d", "3d"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={p.vistaMapa === v}
                  disabled={v === "3d" && !enRuta}
                  title={v === "3d" && !enRuta ? "Elegí una ruta para verla en 3D" : undefined}
                  onClick={() => p.onVistaMapa(v)}
                  className={`rounded-lg px-3 py-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${p.vistaMapa === v ? "bg-asfalto-900 text-movii-500 shadow-panel" : "text-gray-500 hover:text-gray-900"}`}
                >
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filtro: todas las rutas o una sola. La ruta activa se quita con la ✕. */}
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Qué se ve en el mapa">
        <button
          type="button"
          role="radio"
          aria-checked={!enRuta}
          onClick={() => p.onVista("todas")}
          className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            !enRuta ? "border-asfalto-900 bg-asfalto-900 text-white" : "border-hormigon-200 bg-white text-gray-600 hover:border-hormigon-300 hover:text-gray-900"
          }`}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Todas las rutas
          <span className={`tabular rounded-full px-1.5 ${!enRuta ? "bg-white/15" : "bg-hormigon-100"}`}>{conRuta.length}</span>
        </button>
        {conRuta.map((v) => {
          const activa = enRuta && v.id === seleccionado.id;
          const hechas = v.paquetes_entregados + v.paquetes_fallidos;
          return (
            <span
              key={v.id}
              className={`flex shrink-0 items-center rounded-full border text-xs font-semibold transition-colors ${
                activa ? "border-asfalto-900 bg-asfalto-900 text-white" : "border-hormigon-200 bg-white text-gray-600 hover:border-hormigon-300 hover:text-gray-900"
              }`}
            >
              <button type="button" role="radio" aria-checked={activa} onClick={() => p.onElegirVehiculo(v.id)} className="flex items-center gap-2 py-1.5 pl-3 pr-3">
                <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/70" style={{ background: p.colorDe[v.id] }} />
                {v.ruta_nombre}
                <span className={activa ? "text-white/60" : "text-gray-400"}>
                  {v.patente} · {hechas} de {v.total_paquetes}
                </span>
              </button>
              {activa && (
                <button
                  type="button"
                  onClick={() => p.onVista("todas")}
                  aria-label="Quitar el filtro y ver todas las rutas"
                  title="Quitar el filtro"
                  className="-ml-1 mr-1 rounded-full p-1 text-white/70 hover:bg-white/15 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </span>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {enRuta && p.vistaMapa === "3d" ? (
            <Suspense fallback={<div className="flex h-[480px] items-center justify-center"><Spinner label="Cargando vista 3D…" /></div>}>
              <Operaciones3D
                key={seleccionado.id}
                vehiculo={seleccionado}
                color={color}
                recorrido={recorrido}
                paquetes={paquetes}
                vivo={p.vivo}
                envioElegido={envioElegido}
              />
            </Suspense>
          ) : (
            <MapaMovii
              className="h-[480px]"
              vehiculos={vehiculosVisibles}
              paradas={paradas}
              rutas={rutasVisibles}
              deposito={DEPOSITO}
              trayecto={enRuta ? (p.trayecto?.recorrido?.geometria ?? null) : null}
              estadoGps={estadoGps}
              referencias
              colorReferencia={color}
              enfoque={enfoque}
              onVehiculoClick={(id) => p.onElegirVehiculo(id)}
              onParadaClick={(id) => p.onElegirEnvio(id === envioElegido ? null : id)}
              encuadre={enRuta ? `${seleccionado.id}-${envioElegido ?? ""}-${p.detalle ? "ok" : ""}-${p.trayecto?.envio_id === envioElegido ? "t" : ""}` : "todas"}
            />
          )}
        </div>

        <div className="flex min-h-0 flex-col lg:h-[480px]">
          {enRuta ? (
            <ParadasRuta
              className="h-full"
              paquetes={paquetes}
              elegido={envioElegido}
              onElegir={p.onElegirEnvio}
              trayecto={p.trayecto}
              cargando={p.detalleCargando}
              enCurso={enCurso}
              camion={p.vivo ? { lat: p.vivo.lat, lng: p.vivo.lng, velocidad: p.vivo.velocidad } : { lat: seleccionado.latitud, lng: seleccionado.longitud, velocidad: seleccionado.velocidad }}
              trayectoProxima={trayectoProxima.data}
            />
          ) : (
            <div className="flex min-h-0 flex-col">
              <p className="px-1 text-sm font-bold text-gray-900">Avance de las rutas</p>
              <ul className="mt-3 flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
                {conRuta.length === 0 && <li className="px-1 text-sm text-gray-500">No hay rutas con vehículo hoy.</li>}
                {conRuta.map((v) => {
                  const hechas = v.paquetes_entregados + v.paquetes_fallidos;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => p.onElegirVehiculo(v.id)}
                        className="w-full rounded-xl border border-hormigon-200 p-3 text-left transition-colors hover:border-hormigon-300 hover:bg-hormigon-50"
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.colorDe[v.id] }} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{v.ruta_nombre}</span>
                          <span className="tabular text-xs font-semibold text-gray-700">
                            {hechas} de {v.total_paquetes}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate pl-5 text-xs text-gray-500">
                          {v.repartidor_nombre} · {v.patente}
                          {v.paquetes_fallidos > 0 && ` · ${v.paquetes_fallidos} sin entregar`}
                        </span>
                        <span className="mt-2 ml-5 flex h-1.5 overflow-hidden rounded-full bg-hormigon-100">
                          <span className="h-full bg-emerald-500" style={{ width: `${v.total_paquetes ? (v.paquetes_entregados / v.total_paquetes) * 100 : 0}%` }} />
                          <span className="h-full bg-red-400" style={{ width: `${v.total_paquetes ? (v.paquetes_fallidos / v.total_paquetes) * 100 : 0}%` }} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
