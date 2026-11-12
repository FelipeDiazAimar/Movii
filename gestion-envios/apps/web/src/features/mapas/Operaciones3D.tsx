import { useMemo } from "react";
import { Gauge, Package, Route } from "lucide-react";
import type { PaqueteVehiculo, PosicionVehiculo, Vehiculo, Recorrido } from "@/features/flota/types";
import { Escena3D, type Parada3D } from "./Escena3D";
import { Hud, Latido } from "./Hud3D";
import type { LngLat } from "./geo3d";

const ESTADO_TEXTO: Record<string, string> = { asignado: "Pendiente", en_camino: "En camino", entregado: "Entregado", no_entregado: "No entregado", pendiente: "Sin ruta" };

interface Props {
  vehiculo: Vehiculo;
  color: string;
  recorrido: Recorrido | null | undefined;
  /** Tramo ya recorrido de la ruta completa (apagado), para ver la ruta entera. */
  hecho?: LngLat[];
  paquetes: PaqueteVehiculo[];
  vivo?: PosicionVehiculo;
  /** Envío elegido en la lista: la cámara vuela hasta su destino. */
  envioElegido?: string | null;
}

/** El recorrido del camión elegido en 3D, dentro del centro de operaciones. */
export function Operaciones3D({ vehiculo, color, recorrido, hecho, paquetes, vivo, envioElegido }: Props) {
  const linea = useMemo<LngLat[]>(() => (recorrido?.geometria ?? []).map(([lat, lng]) => [lng, lat]), [recorrido?.geometria]);
  const paradas = useMemo<Parada3D[]>(
    () =>
      paquetes.flatMap((p) =>
        p.coordenadas
          ? [
              {
                pos: [p.coordenadas.lng, p.coordenadas.lat] as LngLat,
                estado: p.estado,
                etiqueta: String(p.orden),
                info: { titulo: `#${p.orden} · ${p.codigo_guia}`, detalle: `${p.destinatario_nombre} — ${p.direccion}`, estado: ESTADO_TEXTO[p.estado] ?? p.estado },
              },
            ]
          : [],
      ),
    [paquetes],
  );
  // Con GPS en vivo, el camión lo sigue. Sin GPS: si tiene ruta la recorre en
  // simulación (igual que el mapa 2D); si no, queda en su última posición.
  const simular = !vivo && vehiculo.estado === "activo" && linea.length > 1;
  const pos = vivo ?? (simular ? null : { lat: vehiculo.latitud, lng: vehiculo.longitud, rumbo: vehiculo.rumbo, velocidad: vehiculo.velocidad });
  const gps = useMemo(
    () => (pos ? { lng: pos.lng, lat: pos.lat, rumbo: pos.rumbo, velocidad: pos.velocidad } : undefined),
    [pos?.lng, pos?.lat, pos?.rumbo, pos?.velocidad], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const elegido = paquetes.find((p) => p.envio_id === envioElegido)?.coordenadas;
  const enfoque = useMemo<LngLat | null>(() => (elegido ? [elegido.lng, elegido.lat] : null), [elegido?.lng, elegido?.lat]); // eslint-disable-line react-hooks/exhaustive-deps
  const aBordo = paquetes.filter((p) => p.estado === "asignado" || p.estado === "en_camino").length;

  return (
    <Escena3D
      className="h-[460px]"
      linea={linea}
      hecho={hecho}
      paradas={paradas}
      color={color}
      vivo={gps}
      simular={simular}
      enfoque={enfoque}
      hud={(velocidad) => (
        <div className="rounded-2xl border border-white/10 bg-asfalto-900/85 p-3 text-white shadow-lift backdrop-blur-md">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-movii-500">
            <Latido verde={Boolean(vivo)} />
            {vehiculo.patente}
          </p>
          <p className="font-expandida truncate text-sm font-black">{vehiculo.ruta_nombre || "Sin ruta hoy"}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            <Hud icono={Package} etiqueta="A bordo" valor={aBordo} acento />
            <Hud icono={Gauge} etiqueta="km/h" valor={velocidad} />
            <Hud icono={Route} etiqueta="Resta" valor={recorrido ? `${(recorrido.distancia_m / 1000).toFixed(1).replace(".", ",")} km` : "–"} />
          </div>
        </div>
      )}
    />
  );
}
