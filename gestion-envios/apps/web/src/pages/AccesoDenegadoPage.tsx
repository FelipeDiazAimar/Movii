import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBordesNavegador } from "@/hooks/useBordesNavegador";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Pantalla para quien tiene sesión pero no puede ver lo que pidió: el
 * repartidor (el panel web es de operadores y admins) o un operador que entró a
 * una sección solo de admin. Sin sesión no tiene sentido: se va al login.
 */
export function AccesoDenegadoPage() {
  const { sesion, cargando, logout } = useAuth();
  const navigate = useNavigate();
  useBordesNavegador("#eef0f2");

  if (cargando) return <Spinner label="Verificando sesión…" pantalla />;
  if (!sesion) return <Navigate to="/login" replace />;

  const esRepartidor = sesion.rol === "repartidor";

  function cerrarSesion() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="pt-safe pb-safe flex min-h-screen flex-col items-center justify-center gap-3 bg-hormigon-100 px-4 text-center">
      <h1 className="text-lg font-semibold text-gray-900">Acceso no disponible</h1>
      <p className="max-w-sm text-sm text-gray-500">
        {esRepartidor
          ? "El panel web es para operadores y admins. Como repartidor, usá la app móvil de Movii para ver tu ruta del día."
          : "Tu usuario no tiene permisos para ver esta sección."}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {!esRepartidor && (
          <Link
            to="/operaciones"
            className="inline-flex items-center justify-center rounded-xl bg-movii-500 px-4 py-2.5 text-sm font-semibold text-movii-900 shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] transition-colors hover:bg-movii-400"
          >
            Volver al panel
          </Link>
        )}
        <Button variant="secondary" onClick={cerrarSesion}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
