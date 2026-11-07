import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// El worker de MapLibre 6 se busca al lado del módulo; con Vite (dev y build) el
// módulo queda en otra carpeta, así que se sirve como asset y se indica la URL.
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useQuery } from "@tanstack/react-query";
import { Camera, Clapperboard, Gauge, Map as MapaIcono, Moon, Orbit, Package, Pause, Play, Route, Sun, Timer, Truck, type LucideIcon } from "lucide-react";
import { obtenerMapaRuta } from "@/features/analitica/api";
import { listarFlota } from "@/features/flota/api";
import { useFlotaEnVivo } from "@/features/flota/useFlotaEnVivo";
import { colorDeFlota } from "@/features/flota/colores";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { acumulados, caja, distanciaSobreLinea, mezclarAngulo, puntoEnDistancia, type LngLat } from "./geo3d";

maplibregl.setWorkerUrl(urlWorker);

// OpenFreeMap: estilos vectoriales gratis y sin key; DEM de AWS Open Data. Todo sin costo.
const ESTILOS = { dia: "https://tiles.openfreemap.org/styles/liberty", noche: "https://tiles.openfreemap.org/styles/dark" } as const;
const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const CIELO = {
  dia: { "sky-color": "#7cb8f2", "sky-horizon-blend": 0.6, "horizon-color": "#eef4fb", "horizon-fog-blend": 0.6, "fog-color": "#f3f6fa", "fog-ground-blend": 0.4, "atmosphere-blend": 0.8 },
  noche: { "sky-color": "#060a1a", "sky-horizon-blend": 0.5, "horizon-color": "#1d2a52", "horizon-fog-blend": 0.6, "fog-color": "#0b1124", "fog-ground-blend": 0.5, "atmosphere-blend": 0.6 },
};

const COLOR_PARADA: Record<string, string> = { entregado: "#16a34a", en_camino: "#d97706", asignado: "#2563eb", no_entregado: "#dc2626", pendiente: "#6b7280" };

/** Velocidad de la simulación (m/s) cuando no hay GPS en vivo: acelerada para que se vea el recorrido. */
const VELOCIDAD_SIM = 55;
/** El camión 3D se dibuja más grande que el real para verlo desde lejos. */
const ESCALA_CAMION = 3.4;
/** Metros entre cometas de luz sobre la ruta. */
const ESPACIO_COMETAS = 260;

type Camara = "seguir" | "orbita" | "general" | "libre";
type Modo = "dia" | "noche";

function Hud({ icono: Icono, etiqueta, valor, acento }: { icono: LucideIcon; etiqueta: string; valor: ReactNode; acento?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${acento ? "bg-movii-500 text-asfalto-900" : "bg-white/10 text-movii-500"}`}>
        <Icono className="h-4 w-4" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{etiqueta}</p>
        <p className="font-expandida text-sm font-black text-white">{valor}</p>
      </div>
    </div>
  );
}

function BotonCamara({ activo, onClick, icono: Icono, children }: { activo: boolean; onClick: () => void; icono: LucideIcon; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${activo ? "bg-movii-500 text-asfalto-900 shadow-lift" : "text-gray-200 hover:bg-white/10"}`}
    >
      <Icono className="h-4 w-4" aria-hidden />
      {children}
    </button>
  );
}

/** Polígonos extruidos del camión: caja de carga del color del vehículo y cabina blanca adelante. */
function camionGeoJSON(pos: LngLat, rumboG: number, color: string): GeoJSON.FeatureCollection {
  const k = ESCALA_CAMION;
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { color: "#15181b", alto: 0.9 * k, base: 0 }, geometry: { type: "Polygon", coordinates: [caja(pos, rumboG, 10.5 * k, 2.6 * k, 0.4 * k)] } },
      { type: "Feature", properties: { color, alto: 4.2 * k, base: 0.9 * k }, geometry: { type: "Polygon", coordinates: [caja(pos, rumboG, 7.2 * k, 2.8 * k, -1.4 * k)] } },
      { type: "Feature", properties: { color: "#f3f5f7", alto: 3.3 * k, base: 0.9 * k }, geometry: { type: "Polygon", coordinates: [caja(pos, rumboG, 2.6 * k, 2.7 * k, 3.6 * k)] } },
      { type: "Feature", properties: { color: "#1c2a36", alto: 3.0 * k, base: 2.1 * k }, geometry: { type: "Polygon", coordinates: [caja(pos, rumboG, 0.5 * k, 2.5 * k, 4.95 * k)] } },
    ],
  };
}

/** Columnas de luz en cada parada, del color de su estado (más altas las pendientes). */
function paradasGeoJSON(paradas: { pos: LngLat; estado: string; orden: number }[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: paradas.map((p) => ({
      type: "Feature",
      properties: { color: COLOR_PARADA[p.estado] ?? COLOR_PARADA.pendiente, alto: p.estado === "entregado" ? 18 : 42, orden: String(p.orden) },
      geometry: { type: "Polygon", coordinates: [caja(p.pos, 45, 7, 7)] },
    })),
  };
}

/**
 * Vista 3D de la ruta (MapLibre GL + OpenFreeMap, sin costo): edificios y
 * terreno, recorrido luminoso animado, columnas en las paradas y el camión en
 * 3D avanzando (GPS en vivo por SSE o simulado). Cámara que sigue al camión,
 * vuelo orbital, vista general y modo noche.
 */
export function Mapa3D({ rutaId }: { rutaId: string }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ["rutas", rutaId, "mapa"], queryFn: () => obtenerMapaRuta(rutaId), refetchInterval: 30_000 });
  const flota = useQuery({ queryKey: ["operaciones", "flota"], queryFn: () => listarFlota() });
  const { posiciones } = useFlotaEnVivo(Boolean(data?.vehiculo));

  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const halo = useRef<maplibregl.Marker | null>(null);
  const [camara, setCamara] = useState<Camara>("general");
  const [modo, setModo] = useState<Modo>("dia");
  const [enPausa, setEnPausa] = useState(false);
  const [velocidad, setVelocidad] = useState(0);
  const [listo, setListo] = useState(false);

  // Estado de la animación fuera de React (se lee en cada frame).
  const anim = useRef({ dist: 0, rumbo: 0, rumboCam: 0, objetivo: null as number | null, ultimo: 0, dash: 0, orbita: 0 });
  const camaraRef = useRef(camara);
  const pausaRef = useRef(enPausa);
  camaraRef.current = camara;
  pausaRef.current = enPausa;

  const linea = useMemo<LngLat[]>(() => (data?.recorrido?.geometria ?? []).map(([lat, lng]) => [lng, lat]), [data?.recorrido?.geometria]);
  const acum = useMemo(() => acumulados(linea), [linea]);
  const paradas = useMemo(
    () => (data?.paradas ?? []).flatMap((p) => (p.coordenadas ? [{ pos: [p.coordenadas.lng, p.coordenadas.lat] as LngLat, estado: p.estado, orden: p.orden }] : [])),
    [data?.paradas],
  );
  const vehiculoId = data?.vehiculo?.vehiculo_id;
  const color = (vehiculoId && flota.data ? colorDeFlota(flota.data)[vehiculoId] : undefined) ?? "#f4b400";
  const vivo = vehiculoId ? posiciones[vehiculoId] : undefined;
  const conGps = Boolean(vivo);

  const total = data?.paradas.length ?? 0;
  const entregados = data?.paradas.filter((p) => p.estado === "entregado").length ?? 0;
  const proxima = data?.paradas.find((p) => p.estado === "en_camino") ?? data?.paradas.find((p) => p.estado === "asignado");
  const km = data?.recorrido ? (data.recorrido.distancia_m / 1000).toFixed(1).replace(".", ",") : "–";
  const minutos = data?.recorrido ? Math.round(data.recorrido.duracion_s / 60) : null;

  // Capas propias: se vuelven a montar cada vez que cambia el estilo (día/noche).
  const montarCapas = useRef<(m: maplibregl.Map) => void>(() => {});
  montarCapas.current = (m) => {
    const noche = modo === "noche";
    try {
      m.setSky(CIELO[modo] as maplibregl.SkySpecification);
    } catch {
      /* versiones sin cielo */
    }
    if (!m.getSource("dem")) m.addSource("dem", { type: "raster-dem", tiles: [DEM], encoding: "terrarium", tileSize: 256, maxzoom: 14 });
    m.setTerrain({ source: "dem", exaggeration: 1.2 });

    // El estilo oscuro no trae edificios 3D: se agregan desde la misma fuente vectorial.
    const conEdificios = m.getStyle().layers.some((l) => l.type === "fill-extrusion");
    const vectorial = Object.entries(m.getStyle().sources).find(([, s]) => s.type === "vector")?.[0];
    if (!conEdificios && vectorial && !m.getLayer("edificios-3d")) {
      const primerTexto = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
      m.addLayer(
        {
          id: "edificios-3d",
          type: "fill-extrusion",
          source: vectorial,
          "source-layer": "building",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": noche ? "#1f2a44" : "#d9dde3",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": 0.85,
          },
        },
        primerTexto,
      );
    }

    if (linea.length > 1 && !m.getSource("ruta")) {
      m.addSource("ruta", { type: "geojson", lineMetrics: true, data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: linea } } });
      m.addLayer({ id: "ruta-brillo", type: "line", source: "ruta", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": 22, "line-blur": 14, "line-opacity": noche ? 0.75 : 0.45 } });
      m.addLayer({
        id: "ruta-base",
        type: "line",
        source: "ruta",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-width": 7, "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, "#f4b400", 1, color] },
      });
      // Cometas de luz que recorren la ruta en el sentido del viaje.
      m.addSource("flujo", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "flujo-halo", type: "circle", source: "flujo", paint: { "circle-radius": 9, "circle-color": color, "circle-blur": 1, "circle-opacity": ["*", 0.8, ["get", "o"]] } });
      m.addLayer({ id: "flujo-punto", type: "circle", source: "flujo", paint: { "circle-radius": 3.2, "circle-color": "#ffffff", "circle-opacity": ["get", "o"] } });
    }
    if (m.getSource("paradas")) return;
    m.addSource("paradas", { type: "geojson", data: paradasGeoJSON(paradas) });
    m.addLayer({ id: "paradas-luz", type: "fill-extrusion", source: "paradas", paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "alto"], "fill-extrusion-opacity": 0.85 } });
    m.addLayer({
      id: "paradas-numero",
      type: "symbol",
      source: "paradas",
      layout: { "text-field": ["get", "orden"], "text-font": ["Noto Sans Bold"], "text-size": 14, "text-allow-overlap": true },
      paint: { "text-color": "#ffffff", "text-halo-color": "#1a1a1a", "text-halo-width": 2 },
    });
    m.addSource("camion", { type: "geojson", data: camionGeoJSON(linea[0] ?? paradas[0]?.pos ?? [0, 0], 0, color) });
    m.addLayer({ id: "camion-3d", type: "fill-extrusion", source: "camion", paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "alto"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-opacity": 1 } });
  };

  // Crear el mapa una vez que hay datos.
  useEffect(() => {
    if (!data || !contenedor.current || mapa.current) return;
    const pts = linea.length ? linea : paradas.map((p) => p.pos);
    if (pts.length === 0) return;
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILOS.dia,
      center: pts[0],
      zoom: 11,
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      attributionControl: { compact: true },
    });
    mapa.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.addControl(new maplibregl.FullscreenControl(), "top-right");
    m.on("style.load", () => montarCapas.current(m));
    m.once("load", () => {
      setListo(true);
      // Entrada de cine: de la vista cenital a la ruta inclinada.
      const b = pts.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
      m.fitBounds(b, { padding: 90, maxZoom: 16, pitch: 62, bearing: -25, duration: 3200, essential: true });
    });
    // Si la persona mueve el mapa, la cámara queda libre.
    const soltar = () => setCamara((c) => (c === "general" ? c : "libre"));
    m.on("dragstart", soltar);
    m.on("wheel", soltar);

    // MapLibre posiciona el marcador con transform: la animación va en un hijo.
    const el = document.createElement("div");
    el.style.cssText = "width:46px;height:46px;pointer-events:none";
    const pulso = document.createElement("div");
    pulso.style.cssText = `width:100%;height:100%;border-radius:50%;background:${color}33;border:2px solid ${color};box-shadow:0 0 24px ${color};animation:movii-pulso 1.8s ease-out infinite`;
    el.appendChild(pulso);
    halo.current = new maplibregl.Marker({ element: el, pitchAlignment: "map", rotationAlignment: "map" }).setLngLat(pts[0]).addTo(m);

    return () => {
      m.remove();
      mapa.current = null;
      halo.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.ruta_id, linea.length]);

  // Día / noche: cambia el estilo base y se vuelven a montar las capas propias.
  const modoInicial = useRef(true);
  useEffect(() => {
    if (modoInicial.current) {
      modoInicial.current = false;
      return;
    }
    mapa.current?.setStyle(ESTILOS[modo]);
  }, [modo]);

  // Paradas: se actualizan si cambia algún estado.
  useEffect(() => {
    const s = mapa.current?.getSource("paradas") as maplibregl.GeoJSONSource | undefined;
    s?.setData(paradasGeoJSON(paradas));
  }, [paradas]);

  // Posición en vivo: se ubica sobre la ruta y el camión avanza hasta ahí suave.
  useEffect(() => {
    if (!vivo || linea.length < 2) return;
    anim.current.objetivo = distanciaSobreLinea(linea, acum, [vivo.lng, vivo.lat]);
    setVelocidad(Math.round(vivo.velocidad));
  }, [vivo, linea, acum]);

  // Vista general: encuadra la ruta.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo || camara !== "general") return;
    const pts = linea.length ? linea : paradas.map((p) => p.pos);
    if (!pts.length) return;
    const b = pts.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
    m.fitBounds(b, { padding: 90, maxZoom: 16, pitch: 62, bearing: -25, duration: 1600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camara, listo]);

  // Bucle de animación: avance del camión, flujo de la ruta y cámara.
  useEffect(() => {
    if (!listo || linea.length < 2) return;
    const total = acum[acum.length - 1];
    const a = anim.current;
    let raf = 0;
    let velMostrada = 0;
    const frame = (t: number) => {
      const m = mapa.current;
      if (!m) return;
      const dt = a.ultimo ? Math.min((t - a.ultimo) / 1000, 0.1) : 0;
      a.ultimo = t;

      if (!pausaRef.current) {
        if (a.objetivo !== null) {
          // GPS: se acerca a la posición real.
          a.dist += (a.objetivo - a.dist) * Math.min(1, dt * 1.5);
        } else {
          a.dist = (a.dist + VELOCIDAD_SIM * dt) % total;
          velMostrada += (Math.round((VELOCIDAD_SIM * 3.6) / 4) - velMostrada) * 0.05;
        }
      }
      const { pos, rumbo: r } = puntoEnDistancia(linea, acum, a.dist);
      a.rumbo = mezclarAngulo(a.rumbo, r, Math.min(1, dt * 6));
      const camion = m.getSource("camion") as maplibregl.GeoJSONSource | undefined;
      camion?.setData(camionGeoJSON(pos, a.rumbo, color));
      halo.current?.setLngLat(pos);

      // Flujo: cometas separadas a intervalos fijos, cada una con su estela.
      a.dash = (a.dash + dt * 160) % ESPACIO_COMETAS;
      const flujo = m.getSource("flujo") as maplibregl.GeoJSONSource | undefined;
      if (flujo) {
        const features: GeoJSON.Feature[] = [];
        for (let base = a.dash; base < total; base += ESPACIO_COMETAS) {
          for (let k = 0; k < 5; k++) {
            const d = base - k * 14;
            if (d < 0) continue;
            features.push({ type: "Feature", properties: { o: 1 - k / 5 }, geometry: { type: "Point", coordinates: puntoEnDistancia(linea, acum, d).pos } });
          }
        }
        flujo.setData({ type: "FeatureCollection", features });
      }

      const modoCam = camaraRef.current;
      if (modoCam === "seguir") {
        a.rumboCam = mezclarAngulo(a.rumboCam, a.rumbo, Math.min(1, dt * 1.8));
        m.jumpTo({ center: pos, bearing: a.rumboCam, pitch: 66, zoom: 17.2 });
      } else if (modoCam === "orbita") {
        a.orbita = (a.orbita + dt * 9) % 360;
        m.jumpTo({ center: pos, bearing: a.orbita, pitch: 70, zoom: 16.4 });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const reloj = setInterval(() => {
      if (anim.current.objetivo === null) setVelocidad(Math.round(velMostrada));
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(reloj);
    };
  }, [listo, linea, acum, color]);

  if (isLoading) return <Spinner label="Cargando mapa 3D…" />;
  // Si falla un refresco se sigue mostrando lo último que llegó.
  if (!data) return <Alert variant="error">{isError ? "No se pudo cargar el mapa" : "Sin datos de la ruta"}</Alert>;
  if (linea.length === 0 && paradas.length === 0) return <Alert variant="info">La ruta todavía no tiene paradas con ubicación.</Alert>;

  return (
    <div className="relative h-[calc(100vh-180px)] min-h-[560px] overflow-hidden rounded-[28px] border border-asfalto-700 bg-asfalto-900 shadow-lift">
      <div ref={contenedor} className="h-full w-full" />

      {/* Panel de datos */}
      <div className="pointer-events-none absolute left-3 top-3 w-[min(300px,calc(100%-80px))] rounded-2xl border border-white/10 bg-asfalto-900/85 p-4 text-white shadow-lift backdrop-blur-md">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-movii-500">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${conGps ? "bg-green-400" : "bg-movii-500"}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${conGps ? "bg-green-400" : "bg-movii-500"}`} />
          </span>
          {conGps ? "GPS en vivo" : "Recorrido simulado"}
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

      {/* Controles de cámara */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/10 bg-asfalto-900/90 p-1.5 shadow-lift backdrop-blur-md">
        <BotonCamara activo={camara === "seguir"} onClick={() => setCamara("seguir")} icono={Truck}>
          Seguir
        </BotonCamara>
        <BotonCamara activo={camara === "orbita"} onClick={() => setCamara("orbita")} icono={Orbit}>
          Órbita
        </BotonCamara>
        <BotonCamara activo={camara === "general"} onClick={() => setCamara("general")} icono={MapaIcono}>
          General
        </BotonCamara>
        <span className="mx-1 h-6 w-px bg-white/15" aria-hidden />
        <BotonCamara activo={false} onClick={() => setEnPausa((p) => !p)} icono={enPausa ? Play : Pause}>
          {enPausa ? "Seguir" : "Pausa"}
        </BotonCamara>
        <BotonCamara activo={false} onClick={() => setModo((m) => (m === "dia" ? "noche" : "dia"))} icono={modo === "dia" ? Moon : Sun}>
          {modo === "dia" ? "Noche" : "Día"}
        </BotonCamara>
        {camara === "libre" && (
          <span className="inline-flex items-center gap-1 px-2 text-[11px] text-gray-400">
            <Camera className="h-3.5 w-3.5" aria-hidden /> Cámara libre
          </span>
        )}
      </div>

      {!listo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-asfalto-900 text-white">
          <Clapperboard className="h-8 w-8 animate-pulse text-movii-500" aria-hidden />
          <p className="text-sm font-semibold text-gray-300">Preparando la vista 3D…</p>
        </div>
      )}
    </div>
  );
}
