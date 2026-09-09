import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";
import type { Rol } from "@/features/auth/types";

/**
 * Exige sesión activa. Además, como el panel web es solo para operador y
 * supervisor (HU-05 — la vista del repartidor vive en la app móvil), un
 * repartidor autenticado no pasa: se lo redirige a /acceso-denegado en vez de
 * mostrarle un panel vacío o roto.
 */
export function ProtectedRoute({ allow }: { allow?: Rol[] }) {
  const { sesion, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <Spinner label="Verificando sesión…" />;

  if (!sesion) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allow && !allow.includes(sesion.rol)) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  return <Outlet />;
}
