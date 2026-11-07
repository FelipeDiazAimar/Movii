import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui/Select";
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
      <Select
        aria-label="Modo de navegación"
        value={modo}
        onChange={(v) => setModo(v as ModoMaps)}
        opciones={[{ value: "proximo", label: "Próximo destino" }, { value: "completo", label: "Ruta completa" }]}
        className="w-44"
      />
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
