import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Info, X } from "lucide-react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLng, TipoVehiculo } from "./types";
import { MEDIDAS_MODELO, VELOCIDAD_SIMULADA, svgVehiculoArriba } from "./ruta2d";
import { htmlParada, MarcaParada } from "./paradas";
import { acumulados, distanciaM, mezclarAngulo, puntoEnDistancia, rumbo as rumboEntre, type LngLat } from "@/features/mapas/geo3d";


export interface ParadaEnMapa {
  id: string;
  orden: number;
  estado: string;
  pos: LatLng;
  titulo: string;
  detalle?: string;
  destacada?: boolean;
  /** La próxima parada del camión: lleva un anillo que late. */
  proxima?: boolean;
}

export interface VehiculoEnMapa {
  id: string;
  patente: string;
  pos: LatLng;
  rumbo: number;
  velocidad: number;
  destacado?: boolean;
  /** Color del vehículo (caja del modelo y su ruta). */
  color?: string;
  tipo?: TipoVehiculo;
  /** true si la posición viene del GPS en vivo (SSE). */
  enVivo?: boolean;
  /** Sin GPS en vivo, el modelo recorre esta línea en simulación (como en la vista 3D). */
  simularEn?: LatLng[] | null;
}

/** Un recorrido de la flota, con su color, para ver varias rutas a la vez. */
export interface RutaEnMapa {
  id: string;
  nombre: string;
  color: string;
  geometria: LatLng[];
  destacada?: boolean;
  /** Si se pasa, se marca con una bandera (ej. la zona del cliente en el tracking público). */
  destino?: LatLng;
  destinoTexto?: string;
}


interface MapaMoviiProps {
  paradas?: ParadaEnMapa[];
  vehiculos?: VehiculoEnMapa[];
  /** Recorrido planificado (gris punteado, o en degradé si se pasa `colorRecorrido`). */
  recorrido?: LatLng[] | null;
  /** Color del vehículo de la ruta: el recorrido se pinta del amarillo Movii a este color, como en 3D. */
  colorRecorrido?: string;
  /** Muestra el cartel "GPS en vivo" o "Recorrido simulado". */
  estadoGps?: "vivo" | "simulado" | null;
  /** Camino resaltado (ej. camión → destino elegido). */
  trayecto?: LatLng[] | null;
  /** Varias rutas a la vez, cada una de su color y animada en su sentido. */
  rutas?: RutaEnMapa[];
  deposito?: LatLng | null;
  className?: string;
  onParadaClick?: (id: string) => void;
  onVehiculoClick?: (id: string) => void;
  /** Cambia este valor para volver a encuadrar el mapa. */
  encuadre?: string;
  /** Si se pasa, el mapa encuadra solo estos puntos (ej. el camión y la parada elegida). */
  enfoque?: LatLng[] | null;
  /** Muestra el botón "Referencias" con qué significa cada cosa del mapa. */
  referencias?: boolean;
  /** Color de la ruta en las referencias. */
  colorReferencia?: string;
}

// divIcon: Vite no resuelve los íconos por defecto de Leaflet y además así
// cada parada lleva su número (o ✓ / !) y el color de su estado.
function iconoParada(orden: number, estado: string, destacada: boolean, proxima: boolean) {
  const { html, tam } = htmlParada(orden, estado, { destacada, proxima });
  return L.divIcon({ className: "", html, iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2] });
}

/** Modelo del vehículo visto desde arriba, del color del vehículo; la capa `.mv-rot` se gira según el rumbo. */
function iconoModelo(tipo: TipoVehiculo, color: string, destacado: boolean) {
  const { largo } = MEDIDAS_MODELO[tipo];
  const t = largo + (destacado ? 22 : 12);
  const halo = destacado
    ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color}33;border:2px solid ${color};box-shadow:0 0 18px ${color};animation:movii-pulso 1.8s ease-out infinite"></div>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${t}px;height:${t}px">${halo}
      <div class="mv-rot" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 3px rgba(0,0,0,.45))">${svgVehiculoArriba(tipo, color)}</div>
    </div>`,
    iconSize: [t, t],
    iconAnchor: [t / 2, t / 2],
  });
}

/** Bandera de destino del color de la ruta. */
function iconoDestino(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:30px;height:38px">
      <div style="position:absolute;left:4px;top:2px;width:3px;height:34px;border-radius:2px;background:#1a1a1a"></div>
      <div style="position:absolute;left:7px;top:2px;width:20px;height:14px;border-radius:0 3px 3px 0;background:${color};box-shadow:0 2px 5px rgba(0,0,0,.35);
        background-image:linear-gradient(45deg,rgba(255,255,255,.35) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.35) 50%,rgba(255,255,255,.35) 75%,transparent 75%);background-size:8px 8px"></div>
      <div style="position:absolute;left:0;top:32px;width:11px;height:5px;border-radius:50%;background:rgba(0,0,0,.3)"></div>
    </div>`,
    iconSize: [30, 38],
    iconAnchor: [5, 36],
  });
}

const iconoDeposito = L.divIcon({
  className: "",
  html: `<div style="background:#1a1a1a;color:#f4b400;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font:800 13px system-ui;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">M</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const aLngLat = (p: LatLng): LngLat => [p[1], p[0]];

/**
 * El vehículo en el mapa. Con GPS en vivo se desliza hasta cada posición
 * nueva y gira hacia donde avanza; sin GPS y con una línea para simular,
 * la recorre en loop (igual que el camión de la vista 3D). Se mueve fuera
 * de React (requestAnimationFrame + setLatLng) para no re-renderizar el mapa.
 */
function Camion({ v, onClick }: { v: VehiculoEnMapa; onClick?: (id: string) => void }) {
  const marcador = useRef<L.Marker | null>(null);
  const actual = useRef(v);
  actual.current = v;
  const linea = useMemo(() => {
    const ll = (v.simularEn ?? []).map(aLngLat);
    return { ll, acum: acumulados(ll) };
  }, [v.simularEn]);
  const lineaRef = useRef(linea);
  const distancia = useRef(0);
  useEffect(() => {
    lineaRef.current = linea;
    distancia.current = 0;
  }, [linea]);
  const [inicial] = useState<LatLng>(v.pos);
  const color = v.color ?? "#1a1a1a";
  const icono = useMemo(() => iconoModelo(v.tipo ?? "camion", color, Boolean(v.destacado)), [v.tipo, color, v.destacado]);
  const simulando = !v.enVivo && (v.simularEn?.length ?? 0) > 1;

  useEffect(() => {
    let raf = 0;
    let ultimo = 0;
    let pos: LatLng = actual.current.pos;
    let rumbo = actual.current.rumbo;
    const frame = (t: number) => {
      const dt = ultimo ? Math.min((t - ultimo) / 1000, 0.1) : 0;
      ultimo = t;
      const cur = actual.current;
      const { ll, acum } = lineaRef.current;
      const total = acum[acum.length - 1] ?? 0;
      if (!cur.enVivo && total > 0) {
        distancia.current = (distancia.current + VELOCIDAD_SIMULADA * dt) % total;
        const p = puntoEnDistancia(ll, acum, distancia.current);
        pos = [p.pos[1], p.pos[0]];
        rumbo = mezclarAngulo(rumbo, p.rumbo, Math.min(1, dt * 6));
      } else {
        const destino = cur.pos;
        const antes = pos;
        const salto = distanciaM(aLngLat(antes), aLngLat(destino));
        if (salto > 3000) pos = destino;
        else {
          const k = Math.min(1, dt * 1.5);
          pos = [antes[0] + (destino[0] - antes[0]) * k, antes[1] + (destino[1] - antes[1]) * k];
        }
        const objetivo = salto > 2 ? rumboEntre(aLngLat(antes), aLngLat(destino)) : cur.rumbo;
        rumbo = mezclarAngulo(rumbo, objetivo, Math.min(1, dt * 3));
      }
      const m = marcador.current;
      if (m) {
        m.setLatLng(pos);
        const capa = m.getElement()?.querySelector<HTMLElement>(".mv-rot");
        if (capa) capa.style.transform = `rotate(${rumbo}deg)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Marker
      ref={marcador}
      position={inicial}
      icon={icono}
      zIndexOffset={v.destacado ? 1000 : 500}
      eventHandlers={onClick ? { click: () => onClick(v.id) } : undefined}
    >
      <Tooltip direction="top" offset={[0, -20]}>
        <strong>{v.patente}</strong> · {simulando ? "recorrido simulado" : v.velocidad > 0 ? `${Math.round(v.velocidad)} km/h` : "detenido"}
      </Tooltip>
    </Marker>
  );
}

/** Ruta del color del vehículo, con brillo y un flujo blanco en el sentido del viaje. */
function RutaColoreada({ geometria, color, destacada, nombre }: { geometria: LatLng[]; color: string; destacada: boolean; nombre?: string }) {
  return (
    <>
      <Polyline positions={geometria} pathOptions={{ color, weight: destacada ? 16 : 11, opacity: destacada ? 0.22 : 0.12, lineCap: "round", lineJoin: "round" }} />
      <Polyline positions={geometria} pathOptions={{ color: "#1a1a1a", weight: destacada ? 8 : 6, opacity: 0.25, lineCap: "round", lineJoin: "round" }} />
      <Polyline positions={geometria} pathOptions={{ color, weight: destacada ? 5.5 : 4, opacity: destacada ? 1 : 0.85, lineCap: "round", lineJoin: "round" }} />
      <Polyline
        positions={geometria}
        pathOptions={{ color: "#ffffff", weight: destacada ? 2.4 : 1.8, opacity: 0.95, dashArray: "2 10", lineCap: "round", className: destacada ? "ruta-flujo" : "ruta-flujo-lenta" }}
      >
        {nombre && <Tooltip sticky>{nombre}</Tooltip>}
      </Polyline>
    </>
  );
}

/** Qué significa cada cosa del mapa (se abre y se cierra). */
function Referencias({ color }: { color: string }) {
  const [abierta, setAbierta] = useState(false);
  if (!abierta) {
    return (
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="absolute bottom-3 left-3 z-[1000] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-lift ring-1 ring-black/5 hover:bg-white"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        Referencias
      </button>
    );
  }
  const fila = "flex items-center gap-2.5";
  return (
    <div role="dialog" aria-label="Referencias del mapa" className="absolute bottom-3 left-3 z-[1000] w-64 rounded-2xl bg-white/95 p-3 text-xs text-gray-700 shadow-lift ring-1 ring-black/5 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-bold text-gray-900">Referencias</p>
        <button type="button" onClick={() => setAbierta(false)} aria-label="Cerrar referencias" className="rounded-full p-1 text-gray-500 hover:bg-hormigon-100">
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        <li className={fila}>
          <span className="flex w-7 justify-center" dangerouslySetInnerHTML={{ __html: svgVehiculoArriba("furgon", color).replace(/width="\d+"/, 'width="12"').replace(/height="\d+"/, 'height="24"') }} />
          El camión (se mueve con su GPS)
        </li>
        <li className={fila}>
          <span className="h-1.5 w-7 rounded-full" style={{ background: color }} />
          Lo que le falta recorrer: el camino más corto por calles
        </li>
        <li className={fila}>
          <span className="h-1 w-7 rounded-full bg-[repeating-linear-gradient(90deg,#f4b400_0_5px,transparent_5px_9px)]" />
          Camino del camión hasta el paquete elegido
        </li>
        <li className={fila}>
          <MarcaParada orden={3} estado="en_camino" chica ahora />
          <span className="w-2" />
          La que está yendo a entregar ahora (late)
        </li>
        <li className={fila}>
          <MarcaParada orden={4} estado="en_camino" chica />
          <span className="w-2" />
          Por entregar: el número es el orden de visita (recorrido más corto)
        </li>
        <li className={fila}>
          <MarcaParada orden={1} estado="entregado" chica />
          <span className="w-2" />
          Ya entregado
        </li>
        <li className={fila}>
          <MarcaParada orden={2} estado="no_entregado" chica />
          <span className="w-2" />
          No se pudo entregar
        </li>
        <li className={fila}>
          <span className="flex h-5 w-7 items-center justify-center"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#1a1a1a] text-[10px] font-extrabold text-movii-500">M</span></span>
          Depósito (salida y regreso)
        </li>
      </ul>
    </div>
  );
}

function Encuadrar({ puntos, clave }: { puntos: LatLng[]; clave?: string }) {
  const map = useMap();
  const hecho = useRef<string | null>(null);
  const ultimos = useRef(puntos);
  ultimos.current = puntos;

  const encuadrar = (ps: LatLng[]) => {
    // Si el contenedor cambió de tamaño desde que se creó el mapa (layout,
    // pestañas, sidebar), Leaflet calcula mal el zoom: primero se re-mide.
    map.invalidateSize();
    const lats = ps.map((p) => p[0]);
    const lngs = ps.map((p) => p[1]);
    console.debug("[mapa] encuadre " + JSON.stringify({ puntos: ps.length, lat: [Math.min(...lats), Math.max(...lats)], lng: [Math.min(...lngs), Math.max(...lngs)], tam: map.getSize() }));
    if (ps.length === 1) map.setView(ps[0], 15);
    else map.fitBounds(ps, { padding: [36, 36], maxZoom: 16 });
  };

  useEffect(() => {
    const k = clave ?? "inicial";
    if (puntos.length === 0 || hecho.current === k) return;
    hecho.current = k;
    encuadrar(puntos);
  }, [map, puntos, clave]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-medir cuando el contenedor cambia de tamaño (ej. al cargar el resto de la página).
  useEffect(() => {
    const el = map.getContainer();
    let ancho = el.clientWidth;
    let alto = el.clientHeight;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === ancho && el.clientHeight === alto) return;
      ancho = el.clientWidth;
      alto = el.clientHeight;
      if (ultimos.current.length > 0) encuadrar(ultimos.current);
      else map.invalidateSize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * La rueda sola scrollea la página (el mapa no la "atrapa"); con Ctrl (o ⌘)
 * hace zoom. Sin Ctrl se avisa cómo acercar. El pellizco del trackpad llega
 * como rueda + Ctrl, así que también hace zoom.
 */
function ZoomConCtrl({ onPista }: { onPista: () => void }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const alGirar = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Que el navegador no haga zoom de la página; el zoom es del mapa.
        e.preventDefault();
        // Se habilita antes de que el evento llegue al manejador de Leaflet.
        if (!map.scrollWheelZoom.enabled()) map.scrollWheelZoom.enable();
      } else {
        if (map.scrollWheelZoom.enabled()) map.scrollWheelZoom.disable();
        onPista();
      }
    };
    el.addEventListener("wheel", alGirar, { capture: true, passive: false });
    return () => el.removeEventListener("wheel", alGirar, { capture: true });
  }, [map, onPista]);
  return null;
}

/** Mapa de Movii: calles de OpenStreetMap, recorridos, paradas numeradas y camiones en vivo. */
export function MapaMovii({
  paradas = [],
  vehiculos = [],
  recorrido,
  colorRecorrido,
  estadoGps,
  referencias = false,
  colorReferencia,
  enfoque,
  trayecto,
  rutas = [],
  deposito,
  className = "h-96",
  onParadaClick,
  onVehiculoClick,
  encuadre,
}: MapaMoviiProps) {
  const puntos = useMemo<LatLng[]>(() => {
    if (enfoque?.length) return enfoque;
    const ps: LatLng[] = [...paradas.map((p) => p.pos), ...vehiculos.map((v) => v.pos)];
    if (deposito) ps.push(deposito);
    if (trayecto?.length) ps.push(...trayecto);
    else if (recorrido?.length) ps.push(...recorrido);
    for (const r of rutas) if (r.destacada) ps.push(...r.geometria);
    return ps;
  }, [enfoque, paradas, vehiculos, deposito, trayecto, recorrido, rutas]);

  const centro: LatLng = puntos[0] ?? [-31.4279718, -62.0826608];

  const [pista, setPista] = useState(false);
  const temporizador = useRef<number | undefined>(undefined);
  const mostrarPista = useCallback(() => {
    setPista(true);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setPista(false), 1400);
  }, []);
  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-gray-200 ${className}`}>
      <MapContainer center={centro} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
        <ZoomConCtrl onPista={mostrarPista} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Encuadrar puntos={puntos} clave={encuadre} />
        {rutas
          .filter((r) => r.geometria.length > 1)
          .map((r) => (
            <Fragment key={r.id}>
              <RutaColoreada geometria={r.geometria} color={r.color} destacada={Boolean(r.destacada)} nombre={r.nombre} />
              {r.destino && (
              <Marker position={r.destino} icon={iconoDestino(r.color)} zIndexOffset={r.destacada ? 700 : 300}>
                <Tooltip direction="top" offset={[8, -34]}>
                  <strong>Destino</strong> · {r.destinoTexto ?? r.nombre}
                </Tooltip>
              </Marker>
              )}
            </Fragment>
          ))}
        {recorrido && recorrido.length > 1 && colorRecorrido && <RutaColoreada geometria={recorrido} color={colorRecorrido} destacada />}
        {recorrido && recorrido.length > 1 && !colorRecorrido && (
          <>
            <Polyline positions={recorrido} pathOptions={{ color: "#1a1a1a", weight: 7, opacity: 0.12, lineCap: "round" }} />
            <Polyline positions={recorrido} pathOptions={{ color: "#1a1a1a", weight: 4, opacity: 0.75, dashArray: "2 10", lineCap: "round", className: "ruta-flujo-lenta" }} />
          </>
        )}
        {trayecto && trayecto.length > 1 && (
          <>
            <Polyline positions={trayecto} pathOptions={{ color: "#1a1a1a", weight: 10, opacity: 0.22, lineCap: "round" }} />
            <Polyline positions={trayecto} pathOptions={{ color: "#f4b400", weight: 5, opacity: 1, dashArray: "2 10", lineCap: "round", className: "ruta-flujo" }} />
          </>
        )}
        {deposito && (
          <Marker position={deposito} icon={iconoDeposito} zIndexOffset={600}>
            <Tooltip direction="top" offset={[0, -14]}>
              <strong>Inicio</strong> · Depósito central Movii
            </Tooltip>
          </Marker>
        )}
        {paradas.map((p) => (
          <Marker
            key={p.id}
            position={p.pos}
            icon={iconoParada(p.orden, p.estado, Boolean(p.destacada), Boolean(p.proxima))}
            zIndexOffset={p.destacada ? 800 : 0}
            eventHandlers={onParadaClick ? { click: () => onParadaClick(p.id) } : undefined}
          >
            {!onParadaClick && (
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{p.titulo}</p>
                  {p.detalle && <p>{p.detalle}</p>}
                </div>
              </Popup>
            )}
            {onParadaClick && (
              <Tooltip direction="top" offset={[0, -12]}>
                <strong>{p.titulo}</strong>
                {p.detalle ? ` · ${p.detalle}` : ""}
              </Tooltip>
            )}
          </Marker>
        ))}
        {vehiculos.map((v) => (
          <Camion key={v.id} v={v} onClick={onVehiculoClick} />
        ))}
        {trayecto && trayecto.length > 1 && (
          <CircleMarker center={trayecto[trayecto.length - 1]} radius={14} pathOptions={{ color: "#f4b400", weight: 3, fillOpacity: 0.15 }} />
        )}
      </MapContainer>
      {referencias && <Referencias color={colorReferencia ?? "#f4b400"} />}
      {estadoGps && (
        <span className="pointer-events-none absolute right-3 top-3 z-[1000] inline-flex items-center gap-2 rounded-full bg-[#1a1a1a]/85 px-3 py-1.5 text-xs font-semibold text-white shadow">
          <span className={`h-2 w-2 rounded-full ${estadoGps === "vivo" ? "animate-pulse bg-green-400" : "bg-movii-500"}`} aria-hidden />
          {estadoGps === "vivo" ? "GPS en vivo" : "Recorrido simulado"}
        </span>
      )}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-[1001] flex items-center justify-center bg-black/30 transition-opacity duration-300 ${pista ? "opacity-100" : "opacity-0"}`}
      >
        <span className="rounded-full bg-[#1a1a1a]/85 px-4 py-2 text-sm font-semibold text-white shadow">
          Ctrl + rueda para acercar
        </span>
      </div>
    </div>
  );
}
