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

import { CircleCheck, CircleOff, Headset, Mail, Plus, ShieldCheck, Smartphone, Truck, UserRound, Users, type LucideIcon } from "lucide-react";
const ICONO_ROL: Record<string, LucideIcon> = { supervisor: ShieldCheck, operador: Headset, repartidor: Truck };

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
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-asfalto-900 text-sm font-bold text-movii-500">{usuario.nombre.slice(0, 1).toUpperCase()}</span>
                      <span className="font-semibold">{usuario.nombre}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-gray-400" aria-hidden />
                      {usuario.email}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                      <TelefonoEditable usuarioId={usuario.id} telefono={usuario.telefono ?? ""} />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      {(() => {
                        const Icono = ICONO_ROL[usuario.rol] ?? UserRound;
                        return <Icono className="h-4 w-4 text-movii-600" aria-hidden />;
                      })()}
                      <RolBadge rol={usuario.rol} />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {usuario.activo ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                        <CircleCheck className="h-4 w-4" aria-hidden />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-gray-400">
                        <CircleOff className="h-4 w-4" aria-hidden />
                        Inactivo
                      </span>
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
