import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listarUsuarios } from "@/features/usuarios/api";
import { Card, EmptyState } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { RolBadge } from "@/components/ui/Badge";
import { getApiErrorMessage } from "@/services/api-client";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { TelefonoEditable } from "@/features/whatsapp/TelefonoEditable";

import { Plus, Users } from "lucide-react";
export function UsuariosListPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listarUsuarios,
  });

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        title="Usuarios" icon={Users}
        description="Operadores, supervisores y repartidores del sistema."
        action={
          <Link to="/usuarios/nuevo">
            <Button type="button"><Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
Nuevo usuario</Button>
          </Link>
        }
      />

      {isLoading && <Spinner label="Cargando usuarios…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar los usuarios")}</Alert>}
      {data && data.length === 0 && <EmptyState title="No hay usuarios cargados" />}

      {data && data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-hormigon-200 text-sm">
            <thead className="bg-hormigon-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Celular</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hormigon-100">
              {data.map((usuario) => (
                <tr key={usuario.id} className="transition-colors hover:bg-movii-50/40">
                  <td className="px-4 py-3 font-medium text-gray-900">{usuario.nombre}</td>
                  <td className="px-4 py-3 text-gray-700">{usuario.email}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <TelefonoEditable usuarioId={usuario.id} telefono={usuario.telefono ?? ""} />
                  </td>
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
