import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listarUsuarios } from "@/features/usuarios/api";
import { Card, EmptyState } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { RolBadge } from "@/components/ui/Badge";
import { getApiErrorMessage } from "@/services/api-client";

export function UsuariosListPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listarUsuarios,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500">Operadores, supervisores y repartidores del sistema.</p>
        </div>
        <Link to="/usuarios/nuevo">
          <Button type="button">+ Nuevo usuario</Button>
        </Link>
      </div>

      {isLoading && <Spinner label="Cargando usuarios…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar los usuarios")}</Alert>}
      {data && data.length === 0 && <EmptyState title="No hay usuarios cargados" />}

      {data && data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{usuario.nombre}</td>
                  <td className="px-4 py-3 text-gray-700">{usuario.email}</td>
                  <td className="px-4 py-3">
                    <RolBadge rol={usuario.rol} />
                  </td>
                  <td className="px-4 py-3">
                    {usuario.activo ? (
                      <span className="text-green-700">Activo</span>
                    ) : (
                      <span className="text-gray-400">Inactivo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
