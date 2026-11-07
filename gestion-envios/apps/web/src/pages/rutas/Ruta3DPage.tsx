import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Box, Map as MapaIcono } from "lucide-react";
import { hayWebGL } from "@/features/mapas/webgl";
import { RutaMapaPage } from "@/pages/rutas/RutaMapaPage";
import { Spinner } from "@/components/ui/Spinner";

// maplibre-gl pesa: se baja solo al entrar a la vista 3D.
const Mapa3D = lazy(() => import("@/features/mapas/Mapa3D").then((m) => ({ default: m.Mapa3D })));

/** T5: la ruta en 3D. Sin WebGL cae a la vista 2D existente. */
export function Ruta3DPage() {
  const { id } = useParams<{ id: string }>();
  if (!hayWebGL()) return <RutaMapaPage />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/rutas/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a la ruta
        </Link>
        <div className="flex items-center gap-1 rounded-xl border border-hormigon-200 bg-white p-1 text-sm font-semibold shadow-panel">
          <Link to={`/rutas/${id}/mapa`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-hormigon-100">
            <MapaIcono className="h-4 w-4" aria-hidden />
            2D
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-asfalto-900 px-3 py-1.5 text-movii-500">
            <Box className="h-4 w-4" aria-hidden />
            3D
          </span>
        </div>
      </div>
      <Suspense fallback={<Spinner label="Cargando vista 3D…" />}>
        <Mapa3D rutaId={id as string} />
      </Suspense>
    </div>
  );
}
