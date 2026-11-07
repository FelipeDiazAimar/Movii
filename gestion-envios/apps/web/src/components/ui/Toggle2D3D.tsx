import { Link } from "react-router-dom";
import { hayWebGL } from "@/features/mapas/webgl";

interface Toggle2D3DProps {
  rutaId: string;
  modo: "2d" | "3d";
}

/** Toggle segmented control para alternar entre el mapa 2D (Leaflet) y 3D (MapLibre GL). */
export function Toggle2D3D({ rutaId, modo }: Toggle2D3DProps) {
  const soporta3D = hayWebGL();

  return (
    <div className="inline-flex items-center rounded-xl border border-hormigon-300 bg-hormigon-100 p-1 text-sm font-medium" role="group" aria-label="Modo de vista de mapa">
      <Link
        to={`/rutas/${rutaId}/mapa`}
        className={`rounded-lg px-3 py-1.5 transition-colors ${
          modo === "2d"
            ? "bg-white font-semibold text-movii-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
        aria-current={modo === "2d" ? "page" : undefined}
      >
        🗺️ Vista 2D
      </Link>
      <Link
        to={`/rutas/${rutaId}/3d`}
        title={soporta3D ? "Ver ruta en 3D con MapLibre" : "Requiere WebGL"}
        className={`rounded-lg px-3 py-1.5 transition-colors ${
          modo === "3d"
            ? "bg-white font-semibold text-movii-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
        aria-current={modo === "3d" ? "page" : undefined}
      >
        🏢 Vista 3D
      </Link>
    </div>
  );
}
