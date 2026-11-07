import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// El worker de MapLibre 6 se busca al lado del módulo; con Vite (dev y build) el
// módulo queda en otra carpeta, así que se sirve como asset y se indica la URL.
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { Camera, ChevronDown, Clapperboard, Map as MapaIcono, Maximize2, Minimize2, Moon, Orbit, Pause, Play, Sun, Truck, type LucideIcon } from "lucide-react";
import { COLOR_PARADA, acumulados, caja, distanciaM, mezclarAngulo, puntoEnDistancia, rumbo as rumboEntre, type LngLat } from "./geo3d";

maplibregl.setWorkerUrl(urlWorker);

// OpenFreeMap (gratis, sin key): el estilo "liberty" de día y, de noche, el mismo
// estilo recoloreado (el "dark" de OpenFreeMap casi no muestra calles ni plazas).
const ESTILO = "https://tiles.openfreemap.org/styles/liberty";

type Pintura = [capa: string, propiedad: string, valor: unknown];

/** Colores de noche para cada capa del estilo; devuelve los valores originales para volver al día. */
function nocturnizar(m: maplibregl.Map): Pintura[] {
  const originales: Pintura[] = [];
  const poner = (id: string, prop: string, valor: unknown) => {
    try {
      originales.push([id, prop, m.getPaintProperty(id, prop as never)]);
      m.setPaintProperty(id, prop as never, valor as never);
    } catch {
      /* la capa no tiene esa propiedad */
    }
  };
  for (const l of m.getStyle().layers) {
    if (/^(ruta-|flujo-|paradas-|zona-|camion-)/.test(l.id)) continue;
    const capa = ("source-layer" in l ? String(l["source-layer"] ?? "") : "") + " " + l.id;
    if (l.type === "background") poner(l.id, "background-color", "#0d1322");
    else if (l.type === "fill") {
      if (/water/.test(capa)) poner(l.id, "fill-color", "#0c2a4a");
      else if (/park|grass|wood|forest|scrub|garden|cemetery|pitch|golf|meadow|farmland/.test(capa)) poner(l.id, "fill-color", "#123d30");
      else if (/building/.test(capa)) poner(l.id, "fill-color", "#1d2740");
      else poner(l.id, "fill-color", "#151d31");
      poner(l.id, "fill-outline-color", "#0d1322");
    } else if (l.type === "fill-extrusion") poner(l.id, "fill-extrusion-color", "#28344f");
    else if (l.type === "line") {
      if (/casing/.test(capa)) poner(l.id, "line-color", "#0a0f1c");
      else if (/motorway|trunk/.test(capa)) poner(l.id, "line-color", "#c9a23a");
      else if (/primary|secondary|major/.test(capa)) poner(l.id, "line-color", "#7b93c6");
      else if (/rail/.test(capa)) poner(l.id, "line-color", "#566078");
      else if (/water/.test(capa)) poner(l.id, "line-color", "#1d4a75");
      else if (/boundary/.test(capa)) poner(l.id, "line-color", "#4a5470");
      else poner(l.id, "line-color", "#46577e");
    } else if (l.type === "symbol") {
      poner(l.id, "text-color", "#dbe3f3");
      poner(l.id, "text-halo-color", "#0b1020");
    }
  }
  return originales;
}
const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const CIELO = {
  dia: { "sky-color": "#7cb8f2", "sky-horizon-blend": 0.6, "horizon-color": "#eef4fb", "horizon-fog-blend": 0.6, "fog-color": "#f3f6fa", "fog-ground-blend": 0.4, "atmosphere-blend": 0.8 },
  noche: { "sky-color": "#060a1a", "sky-horizon-blend": 0.5, "horizon-color": "#1d2a52", "horizon-fog-blend": 0.6, "fog-color": "#0b1124", "fog-ground-blend": 0.5, "atmosphere-blend": 0.6 },
};


/** Velocidad de la simulación (m/s) cuando no hay GPS: acelerada para que se vea el recorrido. */
const VELOCIDAD_SIM = 55;
/** El camión 3D se dibuja más grande que el real para verlo desde lejos. */
const ESCALA_CAMION = 3.4;
/** Metros entre cometas de luz sobre la ruta. */
const ESPACIO_COMETAS = 260;

type Camara = "seguir" | "orbita" | "general" | "libre";
type Modo = "dia" | "noche";

export interface Parada3D {
  pos: LngLat;
  estado: string;
  /** Texto encima de la columna (número de parada, "Tu zona"…). */
  etiqueta: string;
  /** Tarjeta que se abre al tocar la columna. */
  info?: { titulo: string; detalle?: string; estado?: string };
}

export interface Vivo3D {
  lng: number;
  lat: number;
  rumbo: number;
  velocidad: number;
}

interface Props {
  linea: LngLat[];
  paradas: Parada3D[];
  /** Color del vehículo (caja del camión y ruta). */
  color: string;
  /** Posición real; sin ella el camión recorre la línea en simulación (si `simular`). */
  vivo?: Vivo3D | null;
  simular?: boolean;
  /** Círculo translúcido alrededor de un punto (zona aproximada del destino). */
  zona?: { centro: LngLat; radioM: number } | null;
  /** Panel de datos arriba a la izquierda; recibe la velocidad mostrada (km/h). */
  hud?: (velocidad: number) => ReactNode;
  className?: string;
  /** Cámara al abrir. */
  camaraInicial?: Camara;
  /** Punto al que la cámara vuela (p. ej. la parada elegida en una lista). */
  enfoque?: LngLat | null;
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
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

/** Polígonos extruidos del camión: chasis, caja de carga del color del vehículo, cabina y parabrisas. */
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

function paradasGeoJSON(paradas: Parada3D[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: paradas.map((p) => ({
      type: "Feature",
      properties: {
        color: COLOR_PARADA[p.estado] ?? COLOR_PARADA.pendiente,
        alto: p.estado === "entregado" ? 18 : 42,
        etiqueta: p.etiqueta,
        titulo: p.info?.titulo ?? "",
        detalle: p.info?.detalle ?? "",
        estado: p.info?.estado ?? "",
      },
      geometry: { type: "Polygon", coordinates: [caja(p.pos, 45, 7, 7)] },
    })),
  };
}

function lineaGeoJSON(linea: LngLat[]): GeoJSON.Feature {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: linea.length > 1 ? linea : [] } };
}

/** Círculo de radioM metros como polígono. */
function circuloGeoJSON(z: { centro: LngLat; radioM: number } | null | undefined): GeoJSON.FeatureCollection {
  if (!z) return { type: "FeatureCollection", features: [] };
  const [lng, lat] = z.centro;
  const ring: LngLat[] = Array.from({ length: 49 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return [lng + (Math.cos(a) * z.radioM) / (111_320 * Math.cos((lat * Math.PI) / 180)), lat + (Math.sin(a) * z.radioM) / 111_320];
  });
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] };
}

function encuadre(puntos: LngLat[]) {
  return puntos.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(puntos[0], puntos[0]));
}

/**
 * Escena 3D (MapLibre GL + OpenFreeMap, sin costo): edificios y terreno,
 * recorrido luminoso con cometas de luz, columnas en las paradas y un camión
 * 3D que sigue la posición en vivo (o simula el recorrido). Cámaras seguir,
 * órbita y general, y modo día/noche. La usan el panel y el seguimiento público.
 */
/** Contenido de la tarjeta de una parada, armado con nodos (sin HTML: los textos vienen de datos). */
function tarjetaParada(props: Record<string, unknown>, color: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "font-family:system-ui;padding:4px 2px;min-width:190px;max-width:240px";
  const cabeza = document.createElement("div");
  cabeza.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";
  const t = document.createElement("strong");
  t.style.cssText = "font-size:13px;color:#111";
  t.textContent = String(props.titulo || props.etiqueta || "");
  cabeza.appendChild(t);
  if (props.estado) {
    const b = document.createElement("span");
    b.style.cssText = `padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#fff;background:${color}`;
    b.textContent = String(props.estado);
    cabeza.appendChild(b);
  }
  el.appendChild(cabeza);
  if (props.detalle) {
    const d = document.createElement("p");
    d.style.cssText = "margin:4px 0 0;font-size:12px;color:#4b5563";
    d.textContent = String(props.detalle);
    el.appendChild(d);
  }
  return el;
}

export function Escena3D({ linea, paradas, color, vivo, simular = false, zona, hud, className = "h-[calc(100vh-180px)] min-h-[560px]", camaraInicial = "general", enfoque }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const halo = useRef<maplibregl.Marker | null>(null);
  const [camara, setCamara] = useState<Camara>(camaraInicial);
  const [modo, setModo] = useState<Modo>("dia");
  const [enPausa, setEnPausa] = useState(false);
  const [velocidad, setVelocidad] = useState(0);
  const [listo, setListo] = useState(false);

  const acum = useMemo(() => acumulados(linea), [linea]);
  const puntos = useMemo<LngLat[]>(() => {
    const p = [...linea, ...paradas.map((x) => x.pos)];
    if (vivo) p.push([vivo.lng, vivo.lat]);
    return p;
  }, [linea, paradas, vivo]);

  // Todo lo que el bucle de animación lee en cada frame, en refs (sin re-render).
  const estado = useRef({ linea, acum, color, vivo, simular, paradas, zona, modo });
  estado.current = { linea, acum, color, vivo, simular, paradas, zona, modo };
  const anim = useRef({ pos: null as LngLat | null, dist: 0, rumbo: 0, rumboCam: 0, ultimo: 0, cometa: 0, orbita: 0 });
  const camaraRef = useRef(camara);
  const pausaRef = useRef(enPausa);
  camaraRef.current = camara;
  pausaRef.current = enPausa;

  // Capas propias: se montan con cada estilo (al cambiar día/noche se borran).
  function montarCapas(m: maplibregl.Map) {
    const { color: col, linea: ln, paradas: pr, zona: zn } = estado.current;
    try {
      m.setSky(CIELO.dia as maplibregl.SkySpecification);
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
            "fill-extrusion-color": "#d9dde3",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": 0.85,
          },
        },
        primerTexto,
      );
    }
    if (m.getSource("ruta")) return;

    m.addSource("zona", { type: "geojson", data: circuloGeoJSON(zn) });
    m.addLayer({ id: "zona-relleno", type: "fill", source: "zona", paint: { "fill-color": "#f4b400", "fill-opacity": 0.14 } });
    m.addLayer({ id: "zona-borde", type: "line", source: "zona", paint: { "line-color": "#f4b400", "line-width": 2, "line-opacity": 0.8 } });

    m.addSource("ruta", { type: "geojson", lineMetrics: true, data: lineaGeoJSON(ln) });
    m.addLayer({ id: "ruta-brillo", type: "line", source: "ruta", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": col, "line-width": 22, "line-blur": 14, "line-opacity": 0.45 } });
    m.addLayer({
      id: "ruta-base",
      type: "line",
      source: "ruta",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-width": 7, "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, "#f4b400", 1, col] },
    });
    // Cometas de luz que recorren la ruta en el sentido del viaje (el dasharray animado rompe MapLibre 6).
    m.addSource("flujo", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    m.addLayer({ id: "flujo-halo", type: "circle", source: "flujo", paint: { "circle-radius": 9, "circle-color": col, "circle-blur": 1, "circle-opacity": ["*", 0.8, ["get", "o"]] } });
    m.addLayer({ id: "flujo-punto", type: "circle", source: "flujo", paint: { "circle-radius": 3.2, "circle-color": "#ffffff", "circle-opacity": ["get", "o"] } });

    m.addSource("paradas", { type: "geojson", data: paradasGeoJSON(pr) });
    m.addLayer({ id: "paradas-luz", type: "fill-extrusion", source: "paradas", paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "alto"], "fill-extrusion-opacity": 0.85 } });
    m.addLayer({
      id: "paradas-etiqueta",
      type: "symbol",
      source: "paradas",
      layout: { "text-field": ["get", "etiqueta"], "text-font": ["Noto Sans Bold"], "text-size": 14, "text-allow-overlap": true },
      paint: { "text-color": "#ffffff", "text-halo-color": "#1a1a1a", "text-halo-width": 2 },
    });

    const inicio = anim.current.pos ?? ln[0] ?? pr[0]?.pos ?? [0, 0];
    m.addSource("camion", { type: "geojson", data: camionGeoJSON(inicio, anim.current.rumbo, col) });
    m.addLayer({ id: "camion-3d", type: "fill-extrusion", source: "camion", paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "alto"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-opacity": 1 } });
  }

  // Crear el mapa una sola vez (los datos nuevos se aplican con setData).
  useEffect(() => {
    if (!contenedor.current || mapa.current || puntos.length === 0) return;
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      center: puntos[0],
      zoom: 11,
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      attributionControl: { compact: true },
    });
    mapa.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.on("style.load", () => montarCapas(m));
    m.once("load", () => {
      setListo(true);
      // Entrada de cine: de la vista cenital a la escena inclinada.
      m.fitBounds(encuadre(puntos), { padding: 90, maxZoom: 16.5, pitch: 62, bearing: -25, duration: 3200, essential: true });
    });
    // Tocar una parada abre su tarjeta.
    const abrirParada = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || !(f.properties?.titulo || f.properties?.detalle)) return;
      new maplibregl.Popup({ offset: 12, closeButton: false })
        .setLngLat(e.lngLat)
        .setDOMContent(tarjetaParada(f.properties ?? {}, String(f.properties?.color ?? "#1a1a1a")))
        .addTo(m);
    };
    m.on("click", "paradas-luz", abrirParada);
    m.on("mouseenter", "paradas-luz", () => (m.getCanvas().style.cursor = "pointer"));
    m.on("mouseleave", "paradas-luz", () => (m.getCanvas().style.cursor = ""));
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
    halo.current = new maplibregl.Marker({ element: el, pitchAlignment: "map", rotationAlignment: "map" }).setLngLat(puntos[0]).addTo(m);

    return () => {
      m.remove();
      mapa.current = null;
      halo.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puntos.length > 0]);

  // Día / noche: se recolorea el mismo estilo (y se guardan los colores para volver).
  const originales = useRef<Pintura[] | null>(null);
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    try {
      m.setSky(CIELO[modo] as maplibregl.SkySpecification);
    } catch {
      /* sin cielo */
    }
    if (modo === "noche" && !originales.current) originales.current = nocturnizar(m);
    if (modo === "dia" && originales.current) {
      for (const [id, prop, valor] of originales.current) {
        try {
          m.setPaintProperty(id, prop as never, valor as never);
        } catch {
          /* capa que ya no está */
        }
      }
      originales.current = null;
    }
    if (m.getLayer("ruta-brillo")) m.setPaintProperty("ruta-brillo", "line-opacity", modo === "noche" ? 0.75 : 0.45);
  }, [modo, listo]);

  // Pantalla completa del contenedor entero: el panel de datos y los botones siguen visibles.
  const marco = useRef<HTMLDivElement>(null);
  const [completa, setCompleta] = useState(false);
  useEffect(() => {
    const cambio = () => {
      setCompleta(document.fullscreenElement === marco.current);
      setTimeout(() => mapa.current?.resize(), 60);
    };
    document.addEventListener("fullscreenchange", cambio);
    return () => document.removeEventListener("fullscreenchange", cambio);
  }, []);
  const alternarCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void marco.current?.requestFullscreen?.();
  };

  // Panel de datos: abierto en pantallas anchas, plegado en el celular.
  const [hudAbierto, setHudAbierto] = useState(() => typeof window === "undefined" || window.innerWidth >= 640);

  // Datos nuevos (refresco o GPS): se actualizan las fuentes sin recrear el mapa.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    (m.getSource("ruta") as maplibregl.GeoJSONSource | undefined)?.setData(lineaGeoJSON(linea));
    (m.getSource("paradas") as maplibregl.GeoJSONSource | undefined)?.setData(paradasGeoJSON(paradas));
    (m.getSource("zona") as maplibregl.GeoJSONSource | undefined)?.setData(circuloGeoJSON(zona));
  }, [linea, paradas, zona]);

  // Parada elegida afuera (lista): la cámara vuela hasta ella.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo || !enfoque) return;
    setCamara("libre");
    m.flyTo({ center: enfoque, zoom: 17.5, pitch: 65, bearing: m.getBearing(), duration: 1800, essential: true });
  }, [enfoque, listo]);

  // Vista general: encuadra todo.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo || camara !== "general" || puntos.length === 0) return;
    m.fitBounds(encuadre(puntos), { padding: 90, maxZoom: 16.5, pitch: 62, bearing: -25, duration: 1600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camara, listo]);

  // Bucle de animación: camión, cometas y cámara.
  useEffect(() => {
    if (!listo) return;
    const a = anim.current;
    let raf = 0;
    let velMostrada = 0;
    const frame = (t: number) => {
      const m = mapa.current;
      if (!m) return;
      const dt = a.ultimo ? Math.min((t - a.ultimo) / 1000, 0.1) : 0;
      a.ultimo = t;
      const { linea: ln, acum: ac, color: col, vivo: v, simular: sim } = estado.current;
      const total = ac[ac.length - 1] ?? 0;

      // Posición del camión.
      if (v) {
        // GPS: se desliza hasta la posición real y gira hacia su rumbo.
        const destino: LngLat = [v.lng, v.lat];
        if (!a.pos || distanciaM(a.pos, destino) > 3000) a.pos = destino;
        else if (!pausaRef.current) {
          const k = Math.min(1, dt * 1.5);
          const antes = a.pos;
          a.pos = [antes[0] + (destino[0] - antes[0]) * k, antes[1] + (destino[1] - antes[1]) * k];
          const rumboObjetivo = distanciaM(antes, destino) > 2 ? rumboEntre(antes, destino) : v.rumbo;
          a.rumbo = mezclarAngulo(a.rumbo, rumboObjetivo, Math.min(1, dt * 3));
        }
        velMostrada = v.velocidad;
      } else if (sim && total > 0) {
        if (!pausaRef.current) a.dist = (a.dist + VELOCIDAD_SIM * dt) % total;
        const p = puntoEnDistancia(ln, ac, a.dist);
        a.pos = p.pos;
        a.rumbo = mezclarAngulo(a.rumbo, p.rumbo, Math.min(1, dt * 6));
        velMostrada += (Math.round((VELOCIDAD_SIM * 3.6) / 4) - velMostrada) * 0.05;
      } else if (!a.pos && ln.length) {
        a.pos = ln[0];
      }
      if (a.pos) {
        (m.getSource("camion") as maplibregl.GeoJSONSource | undefined)?.setData(camionGeoJSON(a.pos, a.rumbo, col));
        halo.current?.setLngLat(a.pos);
      }

      // Cometas separadas a intervalos fijos, cada una con su estela.
      if (total > 0) {
        a.cometa = (a.cometa + dt * 160) % ESPACIO_COMETAS;
        const features: GeoJSON.Feature[] = [];
        for (let base = a.cometa; base < total; base += ESPACIO_COMETAS) {
          for (let k = 0; k < 5; k++) {
            const d = base - k * 14;
            if (d < 0) continue;
            features.push({ type: "Feature", properties: { o: 1 - k / 5 }, geometry: { type: "Point", coordinates: puntoEnDistancia(ln, ac, d).pos } });
          }
        }
        (m.getSource("flujo") as maplibregl.GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
      }

      const cam = camaraRef.current;
      if (a.pos && cam === "seguir") {
        a.rumboCam = mezclarAngulo(a.rumboCam, a.rumbo, Math.min(1, dt * 1.8));
        m.jumpTo({ center: a.pos, bearing: a.rumboCam, pitch: 66, zoom: 17.2 });
      } else if (a.pos && cam === "orbita") {
        a.orbita = (a.orbita + dt * 9) % 360;
        m.jumpTo({ center: a.pos, bearing: a.orbita, pitch: 70, zoom: 16.4 });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const reloj = setInterval(() => setVelocidad(Math.round(velMostrada)), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(reloj);
    };
  }, [listo]);

  return (
    <div ref={marco} className={`relative overflow-hidden bg-asfalto-900 ${completa ? "h-screen w-screen" : `rounded-[28px] border border-asfalto-700 shadow-lift ${className}`}`}>
      <div ref={contenedor} className="h-full w-full" />
      {hud && (
        <div className="absolute left-2 top-2 z-10 flex w-[min(300px,calc(100%-64px))] flex-col items-start gap-1.5 sm:left-3 sm:top-3">
          <button
            type="button"
            onClick={() => setHudAbierto((a) => !a)}
            aria-expanded={hudAbierto}
            className="inline-flex items-center gap-1.5 rounded-full bg-asfalto-900/90 px-3 py-1.5 text-[11px] font-bold text-white shadow-lift backdrop-blur sm:hidden"
          >
            Datos del viaje
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${hudAbierto ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {hudAbierto && <div className="pointer-events-none w-full">{hud(velocidad)}</div>}
        </div>
      )}

      <div className="absolute bottom-9 left-1/2 z-10 flex max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-0.5 rounded-2xl border border-white/10 bg-asfalto-900/90 p-1 shadow-lift backdrop-blur-md sm:gap-1 sm:p-1.5">
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
        {simular && !vivo && (
          <BotonCamara activo={false} onClick={() => setEnPausa((p) => !p)} icono={enPausa ? Play : Pause}>
            {enPausa ? "Seguir" : "Pausa"}
          </BotonCamara>
        )}
        <BotonCamara activo={false} onClick={() => setModo((m) => (m === "dia" ? "noche" : "dia"))} icono={modo === "dia" ? Moon : Sun}>
          {modo === "dia" ? "Noche" : "Día"}
        </BotonCamara>
        <BotonCamara activo={completa} onClick={alternarCompleta} icono={completa ? Minimize2 : Maximize2}>
          {completa ? "Salir" : "Completa"}
        </BotonCamara>
        {camara === "libre" && (
          <span className="hidden items-center gap-1 px-2 text-[11px] text-gray-400 sm:inline-flex">
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
