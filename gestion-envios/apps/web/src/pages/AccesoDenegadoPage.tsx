import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

export function AccesoDenegadoPage() {
  const { sesion, logout } = useAuth();
  const esRepartidor = sesion?.rol === "repartidor";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-4 text-center">
      <h1 className="text-lg font-semibold text-gray-900">Acceso no disponible</h1>
      <p className="max-w-sm text-sm text-gray-500">
        {esRepartidor
          ? "El panel web es para operadores y supervisores. Como repartidor, usá la app móvil de Movii para ver tu ruta del día."
          : "Tu usuario no tiene permisos para ver esta sección."}
      </p>
      <Button variant="secondary" onClick={logout}>
        Cerrar sesión
      </Button>
    </div>
  );
}
