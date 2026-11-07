import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useQuery } from "@tanstack/react-query";
import { obtenerMapaRuta } from "@/features/analitica/api";
import { useFlotaEnVivo } from "@/features/flota/useFlotaEnVivo";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";

// OpenFreeMap: estilo vectorial gratis, sin key, con edificios extruidos y créditos propios.
const ESTILO = "https://tiles.openfreemap.org/styles/liberty";
const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const AZUL = "#2F7FF5";
const SIMULACION_MS = 5000;

type LngLat = [number, number];

/** Mapa 3D (MapLibre GL): ruta OSRM, paradas y repartidor en vivo (SSE) o simulado cada 5s. */
export function Mapa3D({ rutaId }: { rutaId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["rutas", rutaId, "mapa"],
    queryFn: () => obtenerMapaRuta(rutaId),
    refetchInterval: 30_000,
  });
  const { posiciones } = useFlotaEnVivo(Boolean(data?.vehiculo));
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const dot = useRef<maplibregl.Marker | null>(null);
  const [pitch, setPitch] = useState(60);
  const [bearing, setBearing] = useState(-20);

  const geometria: LngLat[] = (data?.recorrido?.geometria ?? []).map(([lat, lng]) => [lng, lat]);
  const vivo = data?.vehiculo ? posiciones[data.vehiculo.vehiculo_id] : undefined;
  const geoKey = geometria.length + ":" + (geometria[0]?.join(",") ?? "");

  useEffect(() => {
    if (!data || !contenedor.current || mapa.current) return;
    const pts = geometria.length ? geometria : data.paradas.flatMap((p) => (p.coordenadas ? [[p.coordenadas.lng, p.coordenadas.lat] as LngLat] : []));
    if (pts.length === 0) return;
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      center: pts[0],
      zoom: 15,
      pitch,
      bearing,
      maxPitch: 85,
      // attributionControl por defecto: los créditos quedan visibles abajo a la derecha.
    });
    mapa.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.on("load", () => {
      m.addSource("dem", { type: "raster-dem", tiles: [DEM], encoding: "terrarium", tileSize: 256, maxzoom: 14 });
      m.setTerrain({ source: "dem", exaggeration: 1 });
      m.addSource("ruta", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: geometria } } });
      m.addLayer({ id: "ruta-borde", type: "line", source: "ruta", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 9 } });
      m.addLayer({ id: "ruta-linea", type: "line", source: "ruta", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": AZUL, "line-width": 6 } });
      if (geometria.length > 1) {
        const b = geometria.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(geometria[0], geometria[0]));
        m.fitBounds(b, { padding: 60, maxZoom: 16, pitch, bearing, duration: 0 });
      }
    });
    for (const p of data.paradas) {
      if (!p.coordenadas) continue;
      const el = document.createElement("div");
      el.textContent = String(p.orden);
      el.style.cssText = "background:#1a1a1a;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)";
      el.title = `${p.codigo_guia} · ${p.direccion}`;
      new maplibregl.Marker({ element: el }).setLngLat([p.coordenadas.lng, p.coordenadas.lat]).addTo(m);
    }
    const d = document.createElement("div");
    d.style.cssText = `width:20px;height:20px;border-radius:50%;background:#f4b400;border:3px solid #fff;box-shadow:0 0 0 6px ${AZUL}55`;
    d.title = "Repartidor";
    dot.current = new maplibregl.Marker({ element: d }).setLngLat(pts[0]).addTo(m);
    return () => {
      m.remove();
      mapa.current = null;
      dot.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.ruta_id, geoKey]);

  // Posición real por SSE.
  useEffect(() => {
    if (vivo) dot.current?.setLngLat([vivo.lng, vivo.lat]);
  }, [vivo]);

  // Sin posición en vivo: simulación a lo largo de la polilínea cada 5s.
  useEffect(() => {
    if (vivo || geometria.length < 2) return;
    let i = 0;
    const paso = Math.max(1, Math.floor(geometria.length / 40));
    const t = setInterval(() => {
      i = (i + paso) % geometria.length;
      dot.current?.setLngLat(geometria[i]);
    }, SIMULACION_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(vivo), geoKey]);

  if (isLoading) return <Spinner label="Cargando mapa 3D…" />;
  if (isError || !data) return <Alert variant="error">No se pudo cargar el mapa</Alert>;

  return (
    <div>
      <div className="relative h-[560px] overflow-hidden rounded-2xl border border-gray-200">
        <div ref={contenedor} className="h-full w-full" />
        {/* Controles arriba a la izquierda: los créditos de MapLibre quedan libres abajo a la derecha. */}
        <div className="absolute left-3 top-3 flex flex-col gap-2 rounded-xl bg-white/90 p-3 text-xs shadow">
          <label className="flex items-center gap-2">
            Inclinación
            <input type="range" min={0} max={85} value={pitch} onChange={(e) => { const v = Number(e.target.value); setPitch(v); mapa.current?.setPitch(v); }} />
          </label>
          <label className="flex items-center gap-2">
            Rotación
            <input type="range" min={-180} max={180} value={bearing} onChange={(e) => { const v = Number(e.target.value); setBearing(v); mapa.current?.setBearing(v); }} />
          </label>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">{vivo ? "Posición en vivo del repartidor." : "Posición simulada a lo largo de la ruta (sin GPS en vivo)."}</p>
    </div>
  );
}
