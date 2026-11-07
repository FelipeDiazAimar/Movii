import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLng } from "./types";
import { COLOR_ESTADO } from "./colores";


export interface ParadaEnMapa {
  id: string;
  orden: number;
  estado: string;
  pos: LatLng;
  titulo: string;
  detalle?: string;
  destacada?: boolean;
}

export interface VehiculoEnMapa {
  id: string;
  patente: string;
  pos: LatLng;
  rumbo: number;
  velocidad: number;
  destacado?: boolean;
}

interface MapaMoviiProps {
  paradas?: ParadaEnMapa[];
  vehiculos?: VehiculoEnMapa[];
  /** Recorrido planificado (gris punteado). */
  recorrido?: LatLng[] | null;
  /** Camino resaltado (ej. camión → destino elegido). */
  trayecto?: LatLng[] | null;
  deposito?: LatLng | null;
  className?: string;
  onParadaClick?: (id: string) => void;
  onVehiculoClick?: (id: string) => void;
  /** Cambia este valor para volver a encuadrar el mapa. */
  encuadre?: string;
}

// divIcon: Vite no resuelve los íconos por defecto de Leaflet y además así
// cada parada lleva su número y el color de su estado.
function iconoParada(orden: number, estado: string, destacada: boolean) {
  const color = COLOR_ESTADO[estado] ?? COLOR_ESTADO.pendiente;
  const tam = destacada ? 34 : 26;
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;width:${tam}px;height:${tam}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 ${destacada ? 14 : 12}px system-ui;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${orden}</div>`,
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
  });
}

function iconoCamion(rumbo: number, destacado: boolean) {
  const fondo = destacado ? "#f4b400" : "#1a1a1a";
  const trazo = destacado ? "#1a1a1a" : "#f4b400";
  // La flecha apunta al rumbo (0 = norte); el camión queda siempre derecho.
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:44px;height:44px">
      <div style="position:absolute;inset:0;transform:rotate(${rumbo}deg);transition:transform .8s">
        <div style="position:absolute;left:50%;top:-2px;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:10px solid ${fondo}"></div>
      </div>
      <div style="position:absolute;inset:5px;border-radius:50%;background:${fondo};border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${trazo}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
      </div>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

const iconoDeposito = L.divIcon({
  className: "",
  html: `<div style="background:#1a1a1a;color:#f4b400;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font:800 13px system-ui;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">M</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/** Interpola la posición del camión entre dos actualizaciones para que se deslice. */
function useDeslizar(destino: LatLng, ms = 1900): LatLng {
  const [pos, setPos] = useState<LatLng>(destino);
  const desde = useRef<LatLng>(destino);
  const actual = useRef<LatLng>(destino);

  useEffect(() => {
    desde.current = actual.current;
    const inicio = performance.now();
    let frame = 0;
    const paso = (t: number) => {
      const f = Math.min(1, (t - inicio) / ms);
      const p: LatLng = [
        desde.current[0] + (destino[0] - desde.current[0]) * f,
        desde.current[1] + (destino[1] - desde.current[1]) * f,
      ];
      actual.current = p;
      setPos(p);
      if (f < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [destino[0], destino[1], ms]); // eslint-disable-line react-hooks/exhaustive-deps

  return pos;
}

function Camion({ v, onClick }: { v: VehiculoEnMapa; onClick?: (id: string) => void }) {
  const pos = useDeslizar(v.pos);
  const icono = useMemo(() => iconoCamion(v.rumbo, Boolean(v.destacado)), [v.rumbo, v.destacado]);
  return (
    <Marker
      position={pos}
      icon={icono}
      zIndexOffset={v.destacado ? 1000 : 500}
      eventHandlers={onClick ? { click: () => onClick(v.id) } : undefined}
    >
      <Tooltip direction="top" offset={[0, -20]}>
        <strong>{v.patente}</strong> · {v.velocidad > 0 ? `${Math.round(v.velocidad)} km/h` : "detenido"}
      </Tooltip>
    </Marker>
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

/** Mapa de Movii: calles de OpenStreetMap, recorridos, paradas numeradas y camiones en vivo. */
export function MapaMovii({
  paradas = [],
  vehiculos = [],
  recorrido,
  trayecto,
  deposito,
  className = "h-96",
  onParadaClick,
  onVehiculoClick,
  encuadre,
}: MapaMoviiProps) {
  const puntos = useMemo<LatLng[]>(() => {
    const ps: LatLng[] = [...paradas.map((p) => p.pos), ...vehiculos.map((v) => v.pos)];
    if (deposito) ps.push(deposito);
    if (trayecto?.length) ps.push(...trayecto);
    else if (recorrido?.length) ps.push(...recorrido);
    return ps;
  }, [paradas, vehiculos, deposito, trayecto, recorrido]);

  const centro: LatLng = puntos[0] ?? [-31.4279718, -62.0826608];

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-gray-200 ${className}`}>
      <MapContainer center={centro} zoom={14} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Encuadrar puntos={puntos} clave={encuadre} />
        {recorrido && recorrido.length > 1 && (
          <Polyline positions={recorrido} pathOptions={{ color: "#6b7280", weight: 4, opacity: 0.7, dashArray: "8 8" }} />
        )}
        {trayecto && trayecto.length > 1 && (
          <>
            <Polyline positions={trayecto} pathOptions={{ color: "#1a1a1a", weight: 9, opacity: 0.25 }} />
            <Polyline positions={trayecto} pathOptions={{ color: "#f4b400", weight: 5, opacity: 1 }} />
          </>
        )}
        {deposito && (
          <Marker position={deposito} icon={iconoDeposito}>
            <Tooltip direction="top">Depósito central Movii</Tooltip>
          </Marker>
        )}
        {paradas.map((p) => (
          <Marker
            key={p.id}
            position={p.pos}
            icon={iconoParada(p.orden, p.estado, Boolean(p.destacada))}
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
    </div>
  );
}
