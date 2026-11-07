import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { hayWebGL } from "@/features/mapas/webgl";
import { RutaMapaPage } from "@/pages/rutas/RutaMapaPage";
import { Spinner } from "@/components/ui/Spinner";

// maplibre-gl pesa: se baja solo al entrar a la vista 3D.
const Mapa3D = lazy(() => import("@/features/mapas/Mapa3D").then((m) => ({ default: m.Mapa3D })));

/** Spike T5: ruta en 3D. Sin WebGL cae a la vista 2D existente. */
export function Ruta3DPage() {
  const { id } = useParams<{ id: string }>();
  if (!hayWebGL()) return <RutaMapaPage />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link to={`/rutas/${id}`} className="text-sm text-movii-600 hover:underline">← Volver a la ruta</Link>
        <Link to={`/rutas/${id}/mapa`} className="text-sm font-semibold text-movii-600 hover:underline">Ver en 2D</Link>
      </div>
      <Suspense fallback={<Spinner label="Cargando vista 3D…" />}>
        <Mapa3D rutaId={id as string} />
      </Suspense>
    </div>
  );
}
