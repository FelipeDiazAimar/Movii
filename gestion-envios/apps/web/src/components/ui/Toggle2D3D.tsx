import { Link } from "react-router-dom";
import { Box, Map as MapaIcono } from "lucide-react";
import { hayWebGL } from "@/features/mapas/webgl";

interface Toggle2D3DProps {
  rutaId: string;
  modo: "2d" | "3d";
}

/** Selector para pasar del mapa 2D (Leaflet) al 3D (MapLibre) de una ruta. Idea de Jere (T5). */
export function Toggle2D3D({ rutaId, modo }: Toggle2D3DProps) {
  const soporta3D = hayWebGL();
  const clase = (activo: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${activo ? "bg-asfalto-900 text-movii-500 shadow-panel" : "text-gray-600 hover:bg-hormigon-100 hover:text-gray-900"}`;
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-hormigon-200 bg-white p-1 text-sm font-semibold shadow-panel" role="group" aria-label="Modo de vista de mapa">
      <Link to={`/rutas/${rutaId}/mapa`} className={clase(modo === "2d")} aria-current={modo === "2d" ? "page" : undefined}>
        <MapaIcono className="h-4 w-4" aria-hidden />
        Vista 2D
      </Link>
      <Link to={`/rutas/${rutaId}/3d`} title={soporta3D ? "Ver la ruta en 3D" : "Tu navegador no tiene WebGL: se abre la vista 2D"} className={clase(modo === "3d")} aria-current={modo === "3d" ? "page" : undefined}>
        <Box className="h-4 w-4" aria-hidden />
        Vista 3D
      </Link>
    </div>
  );
}
