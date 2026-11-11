import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBordesNavegador } from "@/hooks/useBordesNavegador";

/**
 * 404. Se renderiza fuera de AppLayout, así que trae su propio fondo a pantalla
 * completa (si no, se ve el degradé de <html> mitad oscuro / mitad claro).
 */
export function NotFoundPage() {
  const { sesion, cargando } = useAuth();
  useBordesNavegador("#eef0f2");
  // Con sesión, al panel (si es repartidor, ProtectedRoute lo manda a /acceso-denegado).
  const destino = !cargando && sesion ? "/operaciones" : "/login";

  return (
    <div className="pt-safe pb-safe flex min-h-screen flex-col items-center justify-center gap-3 bg-hormigon-100 px-4 text-center">
      <p className="font-expandida text-5xl font-black text-hormigon-300" aria-hidden>
        404
      </p>
      <h1 className="text-lg font-semibold text-gray-900">Página no encontrada</h1>
      <p className="max-w-sm text-sm text-gray-500">La dirección que buscás no existe o cambió de lugar.</p>
      <Link
        to={destino}
        className="mt-2 inline-flex items-center justify-center rounded-xl border border-hormigon-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-400 hover:bg-hormigon-50"
      >
        {destino === "/login" ? "Ir a iniciar sesión" : "Volver al panel"}
      </Link>
    </div>
  );
}
