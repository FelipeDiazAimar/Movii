import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useQuery } from "@tanstack/react-query";
import { obtenerMapaRuta } from "@/features/analitica/api";
import { useFlotaEnVivo } from "@/features/flota/useFlotaEnVivo";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/Card";

// En Vite para producción, MapLibre requiere registrar explícitamente el worker bundle.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

// OpenFreeMap: estilo vectorial gratis, sin key, con edificios extruidos y créditos propios.
const ESTILO = "https://tiles.openfreemap.org/styles/liberty";
const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const AZUL = "#2F7FF5";
const SIMULACION_MS = 5000;

type LngLat = [number, number];

interface Mapa3DProps {
  rutaId: string;
  paradaDestacadaId?: string | null;
}

/** Mapa 3D (MapLibre GL): ruta OSRM, paradas, depósito y repartidor en vivo (SSE) o simulado cada 5s. */
export function Mapa3D({ rutaId, paradaDestacadaId }: Mapa3DProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["rutas", rutaId, "mapa"],
    queryFn: () => obtenerMapaRuta(rutaId),
    refetchInterval: 30_000,
  });
  const { posiciones } = useFlotaEnVivo(Boolean(data?.vehiculo));
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const dot = useRef<maplibregl.Marker | null>(null);
  const posicionRepartidor = useRef<LngLat | null>(null);
  const [pitch, setPitch] = useState(60);
  const [bearing, setBearing] = useState(-20);

  const geometria: LngLat[] = useMemo(
    () => (data?.recorrido?.geometria ?? []).map(([lat, lng]) => [lng, lat]),
    [data?.recorrido?.geometria],
  );
  const vivo = data?.vehiculo ? posiciones[data.vehiculo.vehiculo_id] : undefined;
  const geoKey = geometria.length + ":" + (geometria[0]?.join(",") ?? "");

  // Puntos para simulación de recorrido cuando no hay GPS en vivo.
  const puntosSimulacion = useMemo(() => {
    if (geometria.length >= 2) return geometria;
    const paradasPts: LngLat[] = (data?.paradas ?? []).flatMap((p) =>
      p.coordenadas ? [[p.coordenadas.lng, p.coordenadas.lat] as LngLat] : [],
    );
    if (data?.deposito) {
      return [[data.deposito.lng, data.deposito.lat] as LngLat, ...paradasPts];
    }
    return paradasPts;
  }, [geometria, data?.paradas, data?.deposito]);

  useEffect(() => {
    if (!data || !contenedor.current || mapa.current) return;
    const pts = geometria.length
      ? geometria
      : data.paradas.flatMap((p) =>
          p.coordenadas ? [[p.coordenadas.lng, p.coordenadas.lat] as LngLat] : [],
        );

    if (pts.length === 0 && !data.deposito) return;
    const centro: LngLat = pts[0] ?? (data.deposito ? [data.deposito.lng, data.deposito.lat] : [0, 0]);

    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      center: centro,
      zoom: 15,
      pitch,
      bearing,
      maxPitch: 85,
      // attributionControl por defecto: los créditos de OpenFreeMap / OSM quedan visibles abajo a la derecha.
    });
    mapa.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    m.on("load", () => {
      m.addSource("dem", {
        type: "raster-dem",
        tiles: [DEM],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
      });
      m.setTerrain({ source: "dem", exaggeration: 1 });

      if (geometria.length > 0) {
        m.addSource("ruta", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: geometria },
          },
        });
        m.addLayer({
          id: "ruta-borde",
          type: "line",
          source: "ruta",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": 9 },
        });
        m.addLayer({
          id: "ruta-linea",
          type: "line",
          source: "ruta",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": AZUL, "line-width": 6 },
        });
      }

      if (geometria.length > 1) {
        const b = geometria.reduce(
          (acc, p) => acc.extend(p),
          new maplibregl.LngLatBounds(geometria[0], geometria[0]),
        );
        m.fitBounds(b, { padding: 60, maxZoom: 16, pitch, bearing, duration: 0 });
      }
    });

    // Depósito central (inicio/retorno de ruta)
    if (data.deposito) {
      const depEl = document.createElement("div");
      depEl.textContent = "🏢";
      depEl.style.cssText =
        "width:32px;height:32px;border-radius:50%;background:#1e293b;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,.4);cursor:pointer;font-size:16px;";
      depEl.title = "Depósito central";

      const depPopup = new maplibregl.Popup({ offset: 25 }).setHTML(
        `<div style="font-family:system-ui;padding:6px;min-width:170px;">
          <strong style="font-size:13px;color:#1e293b;">🏢 Depósito central</strong>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Punto de partida y retorno</p>
        </div>`,
      );

      new maplibregl.Marker({ element: depEl })
        .setLngLat([data.deposito.lng, data.deposito.lat])
        .setPopup(depPopup)
        .addTo(m);
    }

    // Paradas numeradas con popup interactivo y badge de estado
    for (const p of data.paradas) {
      if (!p.coordenadas) continue;
      const el = document.createElement("div");
      el.textContent = String(p.orden);
      const bg =
        p.estado === "entregado" ? "#16a34a" : p.estado === "en_camino" ? "#2563eb" : "#1a1a1a";
      el.style.cssText = `background:${bg};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer;`;
      el.title = `${p.codigo_guia} · ${p.direccion}`;

      const badge =
        p.estado === "entregado"
          ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#dcfce7;color:#15803d;">Entregado</span>'
          : p.estado === "en_camino"
            ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#dbeafe;color:#1d4ed8;">En camino</span>'
            : '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#f3f4f6;color:#374151;">Pendiente</span>';

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
        `<div style="font-family:system-ui;padding:6px;min-width:180px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
            <strong style="font-size:13px;color:#111;">#${p.orden} · ${p.codigo_guia}</strong>
            ${badge}
          </div>
          <p style="margin:2px 0 0;font-size:12px;font-weight:600;color:#374151;">${p.destinatario_nombre}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">${p.direccion}, ${p.localidad}</p>
        </div>`,
      );

      new maplibregl.Marker({ element: el })
        .setLngLat([p.coordenadas.lng, p.coordenadas.lat])
        .setPopup(popup)
        .addTo(m);
    }

    // Dot del repartidor con camión y radar pulsante
    const d = document.createElement("div");
    d.style.cssText = `width:26px;height:26px;border-radius:50%;background:#f4b400;border:3px solid #fff;box-shadow:0 0 0 6px ${AZUL}55, 0 3px 8px rgba(0,0,0,.35);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;`;
    d.textContent = "🚚";
    d.title = `Repartidor: ${data.repartidor?.nombre ?? "En ruta"}`;

    const dotPopup = new maplibregl.Popup({ offset: 25 }).setHTML(
      `<div style="font-family:system-ui;padding:6px;min-width:170px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span style="font-size:14px;">🚚</span>
          <strong style="font-size:13px;color:#111;">${data.repartidor?.nombre ?? "Repartidor"}</strong>
        </div>
        ${data.vehiculo ? `<p style="margin:2px 0 0;font-size:11px;color:#4b5563;">Vehículo: <strong>${data.vehiculo.patente}</strong></p>` : ""}
        <p style="margin:4px 0 0;font-size:11px;font-weight:600;color:${vivo ? "#16a34a" : "#f59e0b"};">
          ${vivo ? "● Señal GPS en vivo" : "● Simulación de trayecto"}
        </p>
      </div>`,
    );

    const posInicial = pts[0] ?? centro;
    posicionRepartidor.current = posInicial;
    dot.current = new maplibregl.Marker({ element: d })
      .setLngLat(posInicial)
      .setPopup(dotPopup)
      .addTo(m);

    return () => {
      m.remove();
      mapa.current = null;
      dot.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.ruta_id, geoKey]);

  // Posición real por SSE.
  useEffect(() => {
    if (vivo) {
      const pos: LngLat = [vivo.lng, vivo.lat];
      posicionRepartidor.current = pos;
      dot.current?.setLngLat(pos);
    }
  }, [vivo]);

  // Sin posición en vivo: simulación de trayecto cada 5s a lo largo de la ruta.
  useEffect(() => {
    if (vivo || puntosSimulacion.length < 2) return;
    let i = 0;
    const paso = Math.max(1, Math.floor(puntosSimulacion.length / 40));
    const t = setInterval(() => {
      i = (i + paso) % puntosSimulacion.length;
      const pt = puntosSimulacion[i];
      posicionRepartidor.current = pt;
      dot.current?.setLngLat(pt);
    }, SIMULACION_MS);
    return () => clearInterval(t);
  }, [Boolean(vivo), puntosSimulacion]);

  // Enfocar parada destacada seleccionada en la lista
  useEffect(() => {
    if (!paradaDestacadaId || !data || !mapa.current) return;
    const parada = data.paradas.find((p) => p.envio_id === paradaDestacadaId);
    if (parada?.coordenadas) {
      mapa.current.flyTo({
        center: [parada.coordenadas.lng, parada.coordenadas.lat],
        zoom: 16.5,
        pitch: 65,
        duration: 1000,
      });
    }
  }, [paradaDestacadaId, data]);

  if (isLoading) return <Spinner label="Cargando mapa 3D…" />;
  if (isError || !data) return <Alert variant="error">No se pudo cargar el mapa</Alert>;

  const tieneCoordenadas =
    data.paradas.some((p) => Boolean(p.coordenadas)) ||
    geometria.length > 0 ||
    Boolean(data.deposito);

  if (!tieneCoordenadas) {
    return (
      <EmptyState
        title="Ninguna parada tiene ubicación geográfica"
        description="No se puede mostrar la vista 3D de esta ruta sin coordenadas de paradas."
      />
    );
  }

  // Acciones de cámara rápida
  const centrarRepartidor = () => {
    if (posicionRepartidor.current && mapa.current) {
      mapa.current.flyTo({
        center: posicionRepartidor.current,
        zoom: 16.5,
        pitch: 65,
        duration: 1000,
      });
    }
  };

  const aplicarVista3D = () => {
    setPitch(60);
    setBearing(-20);
    mapa.current?.flyTo({ pitch: 60, bearing: -20, duration: 800 });
  };

  const aplicarVistaCenital = () => {
    setPitch(0);
    setBearing(0);
    mapa.current?.flyTo({ pitch: 0, bearing: 0, duration: 800 });
  };

  const resetearEncuadre = () => {
    if (!mapa.current) return;
    if (geometria.length > 1) {
      const b = geometria.reduce(
        (acc, p) => acc.extend(p),
        new maplibregl.LngLatBounds(geometria[0], geometria[0]),
      );
      mapa.current.fitBounds(b, { padding: 60, maxZoom: 16, pitch, bearing, duration: 800 });
    } else if (puntosSimulacion.length > 0) {
      mapa.current.flyTo({ center: puntosSimulacion[0], zoom: 15, pitch, bearing, duration: 800 });
    }
  };

  return (
    <div>
      <div className="relative h-[560px] overflow-hidden rounded-2xl border border-gray-200">
        <div ref={contenedor} className="h-full w-full" />

        {/* Controles y accesos rápidos de cámara: arriba a la izquierda para no tapar créditos en bottom-right */}
        <div className="absolute left-3 top-3 flex flex-col gap-2 rounded-xl bg-white/95 p-3 text-xs shadow-md backdrop-blur-sm border border-gray-100">
          <div className="flex items-center gap-1.5 border-b border-gray-200 pb-2 font-semibold text-gray-800">
            <span>Controles 3D</span>
          </div>

          <label className="flex items-center justify-between gap-2 text-gray-700">
            <span>Inclinación ({pitch}°)</span>
            <input
              type="range"
              min={0}
              max={85}
              value={pitch}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPitch(v);
                mapa.current?.setPitch(v);
              }}
              className="w-24 accent-movii-600"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-gray-700">
            <span>Rotación ({bearing}°)</span>
            <input
              type="range"
              min={-180}
              max={180}
              value={bearing}
              onChange={(e) => {
                const v = Number(e.target.value);
                setBearing(v);
                mapa.current?.setBearing(v);
              }}
              className="w-24 accent-movii-600"
            />
          </label>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={centrarRepartidor}
              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-800 hover:bg-gray-100"
              title="Centrar la cámara en el repartidor"
            >
              🎯 Repartidor
            </button>
            <button
              type="button"
              onClick={aplicarVista3D}
              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-800 hover:bg-gray-100"
              title="Vista en perspectiva 3D"
            >
              📐 Vista 3D
            </button>
            <button
              type="button"
              onClick={aplicarVistaCenital}
              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-800 hover:bg-gray-100"
              title="Vista superior 2D cenital"
            >
              🗺️ Cenital
            </button>
            <button
              type="button"
              onClick={resetearEncuadre}
              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-800 hover:bg-gray-100"
              title="Encuadre de toda la ruta"
            >
              🔄 Resetear
            </button>
          </div>
        </div>

        {/* Leyenda discreta */}
        <div className="absolute bottom-6 left-3 flex flex-wrap items-center gap-2 rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur-sm">
          <span>🏢 Depósito</span>
          <span>·</span>
          <span>🚚 Repartidor</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-600" /> En camino
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" /> Entregado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-gray-900" /> Pendiente
          </span>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        {vivo
          ? "Posición en vivo del repartidor por señal GPS."
          : "Posición simulada a lo largo del trayecto de la ruta (actualización cada 5 s)."}
      </p>
    </div>
  );
}
