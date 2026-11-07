import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crosshair } from "lucide-react";
import { hayWebGL } from "@/features/mapas/webgl";
import { obtenerMapaRuta } from "@/features/analitica/api";
import { BotonAbrirMaps } from "@/features/mapas/BotonAbrirMaps";
import { RutaMapaPage } from "@/pages/rutas/RutaMapaPage";
import { Toggle2D3D } from "@/components/ui/Toggle2D3D";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { SkeletonPagina } from "@/components/ui/Skeleton";

// maplibre-gl pesa: se baja solo al entrar a la vista 3D.
const Mapa3D = lazy(() => import("@/features/mapas/Mapa3D").then((m) => ({ default: m.Mapa3D })));

/** Lista de paradas debajo del 3D: tocar una lleva la cámara hasta ella (idea de Jere, T5). */
function ListaParadas({ rutaId, elegida, onElegir }: { rutaId: string; elegida: string | null; onElegir: (id: string | null) => void }) {
  const { data } = useQuery({ queryKey: ["rutas", rutaId, "mapa"], queryFn: () => obtenerMapaRuta(rutaId), refetchInterval: 30_000 });
  const paradas = useMemo(() => [...(data?.paradas ?? [])].sort((a, b) => a.orden - b.orden), [data?.paradas]);
  if (paradas.length === 0) return null;
  return (
    <section className="rounded-panel border border-hormigon-200 bg-white p-4 shadow-panel">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-expandida text-base font-black text-gray-900">Paradas de la ruta</h2>
        {elegida && (
          <button type="button" onClick={() => onElegir(null)} className="text-xs font-semibold text-movii-700 hover:underline">
            Ver todas
          </button>
        )}
      </div>
      <ol className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {paradas.map((p) => (
          <li key={p.envio_id}>
            <button
              type="button"
              disabled={!p.coordenadas}
              onClick={() => onElegir(p.envio_id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                p.envio_id === elegida ? "border-movii-500 bg-movii-50" : "border-hormigon-200 hover:bg-hormigon-50"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-asfalto-900 text-xs font-black text-movii-500">{p.orden}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-gray-900">{p.destinatario_nombre}</span>
                <span className="block truncate text-xs text-gray-500">{p.coordenadas ? `${p.direccion}, ${p.localidad}` : "Sin ubicación en el mapa"}</span>
              </span>
              <EstadoEnvioBadge estado={p.estado} />
              {p.coordenadas && <Crosshair className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** T5: la ruta en 3D. Sin WebGL cae a la vista 2D existente. */
export function Ruta3DPage() {
  const { id } = useParams<{ id: string }>();
  const rutaId = id as string;
  const [elegida, setElegida] = useState<string | null>(null);
  if (!hayWebGL()) return <RutaMapaPage />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/rutas/${rutaId}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a la ruta
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle2D3D rutaId={rutaId} modo="3d" />
          <BotonAbrirMaps rutaId={rutaId} />
        </div>
      </div>
      <Suspense fallback={<SkeletonPagina label="Cargando vista 3D…" />}>
        <Mapa3D rutaId={rutaId} paradaDestacadaId={elegida} />
      </Suspense>
      <ListaParadas rutaId={rutaId} elegida={elegida} onElegir={setElegida} />
    </div>
  );
}
