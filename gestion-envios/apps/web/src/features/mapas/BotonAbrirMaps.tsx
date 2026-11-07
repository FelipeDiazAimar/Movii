import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPinned } from "lucide-react";
import { obtenerMapaRuta } from "@/features/analitica/api";
import { urlGoogleMaps, type ModoMaps } from "./googleMaps";

const CERRADOS = ["entregado", "no_entregado"];

/** "Abrir en Maps" con selector Próximo destino / Ruta completa (paradas pendientes con ubicación). */
export function BotonAbrirMaps({ rutaId }: { rutaId: string }) {
  const [modo, setModo] = useState<ModoMaps>("proximo");
  const { data } = useQuery({ queryKey: ["rutas", rutaId, "mapa"], queryFn: () => obtenerMapaRuta(rutaId) });

  const paradas = (data?.paradas ?? [])
    .filter((p) => p.coordenadas && !CERRADOS.includes(p.estado))
    .sort((a, b) => a.orden - b.orden)
    .map((p) => p.coordenadas!);
  const origen = data?.vehiculo ? { lat: data.vehiculo.lat, lng: data.vehiculo.lng } : data?.deposito;
  const href = urlGoogleMaps({ origen, paradas, modo });

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Modo de navegación"
        value={modo}
        onChange={(e) => setModo(e.target.value as ModoMaps)}
        className="rounded-xl border border-hormigon-300 bg-white px-2 py-2 text-sm"
      >
        <option value="proximo">Próximo destino</option>
        <option value="completo">Ruta completa</option>
      </select>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-movii-500 px-4 py-2 text-sm font-semibold text-movii-900 hover:bg-movii-400"
        >
          <MapPinned size={16} /> Abrir en Maps
        </a>
      ) : (
        <span className="text-xs text-gray-500">Sin paradas pendientes con ubicación</span>
      )}
    </div>
  );
}
