import { useMemo } from "react";
import { Clock, Gauge, Route } from "lucide-react";
import type { TrackingEnVivo } from "@/features/envios/types";
import { esHex } from "@/features/flota/colores";
import { Escena3D, type Parada3D } from "./Escena3D";
import { Latido } from "./Hud3D";
import type { LngLat } from "./geo3d";

function hora(iso?: string) {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * Seguimiento público en 3D: el vehículo real moviéndose hacia la zona del
 * cliente (destino aproximado, nunca la casa exacta).
 */
export function Seguimiento3D({ vivo }: { vivo: TrackingEnVivo }) {
  const color = esHex(vivo.vehiculo.color) ? vivo.vehiculo.color : "#f4b400";
  const linea = useMemo<LngLat[]>(() => (vivo.recorrido?.geometria ?? []).map(([lat, lng]) => [lng, lat]), [vivo.recorrido?.geometria]);
  const destino = vivo.destino ? ([vivo.destino.lng, vivo.destino.lat] as LngLat) : null;
  const paradas = useMemo<Parada3D[]>(() => (destino ? [{ pos: destino, estado: "destino", etiqueta: "Tu zona" }] : []), [destino?.[0], destino?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const zona = useMemo(() => (destino ? { centro: destino, radioM: 150 } : null), [destino?.[0], destino?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = vivo.vehiculo;
  const gps = useMemo(() => ({ lng: v.lng, lat: v.lat, rumbo: v.rumbo, velocidad: v.velocidad }), [v.lng, v.lat, v.rumbo, v.velocidad]);
  const km = vivo.recorrido && vivo.recorrido.distancia_m >= 100 ? `${(vivo.recorrido.distancia_m / 1000).toFixed(1).replace(".", ",")} km` : "< 100 m";

  return (
    <Escena3D
      className="h-[26rem] sm:h-[30rem]"
      linea={linea}
      paradas={paradas}
      zona={zona}
      color={color}
      vivo={gps}
      camaraInicial="general"
      hud={() => (
        <div className="rounded-2xl border border-white/10 bg-asfalto-900/85 p-3 text-white shadow-lift backdrop-blur-md">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-movii-500">
            <Latido verde />
            En vivo
          </p>
          {vivo.eta_desde && (
            <p className="font-expandida mt-0.5 text-sm font-black sm:text-base">
              Llega {hora(vivo.eta_desde)} – {hora(vivo.eta_hasta)}
            </p>
          )}
          <dl className="mt-2 grid grid-cols-3 divide-x divide-white/10 rounded-xl bg-white/5 py-1.5 text-center">
            {[
              { i: Gauge, t: "km/h", v: Math.round(v.velocidad) },
              { i: Route, t: "distancia", v: km },
              { i: Clock, t: "paradas antes", v: vivo.paradas_antes },
            ].map(({ i: I, t, v: valor }) => (
              <div key={t} className="px-1">
                <dd className="font-expandida flex items-center justify-center gap-1 whitespace-nowrap text-sm font-black">
                  <I className="h-3.5 w-3.5 text-movii-500" aria-hidden />
                  {valor}
                </dd>
                <dt className="text-[10px] font-semibold text-gray-400">{t}</dt>
              </div>
            ))}
          </dl>
        </div>
      )}
    />
  );
}
