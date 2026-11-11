import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listarUsuarios, eliminarUsuario } from "@/features/usuarios/api";
import { Card, EmptyState } from "@/components/ui/Card";
import { SkeletonTabla } from "@/components/ui/Skeleton";
import { BarraFiltros, FiltroSelect } from "@/components/ui/BarraFiltros";
import { filtrarUsuarios } from "@/utils/filtros";
import { BotonEliminar } from "@/components/ui/BotonEliminar";
import { useAuth } from "@/hooks/useAuth";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { RolBadge } from "@/components/ui/Badge";
import { getApiErrorMessage } from "@/services/api-client";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { TelefonoEditable } from "@/features/whatsapp/TelefonoEditable";

import { CircleCheck, CircleOff, Headset, Mail, Plus, ShieldCheck, Smartphone, Truck, UserRound, Users, type LucideIcon } from "lucide-react";
const ICONO_ROL: Record<string, LucideIcon> = { admin: ShieldCheck, operador: Headset, repartidor: Truck };

/**
 * La API guarda celulares con y sin "+" ("+5493564021559" y "5493564021559").
 * Se pasan solo los dígitos para que el listado los muestre todos con el mismo
 * formato (+54 9 …); al editar, la API vuelve a normalizar lo que se cargue (H34b).
 */
function telefonoUniforme(telefono?: string | null): string {
  return (telefono ?? "").replace(/\D/g, "");
}

function RolConIcono({ rol }: { rol: string }) {
  const Icono = ICONO_ROL[rol] ?? UserRound;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icono className="h-4 w-4 text-movii-600" aria-hidden />
      <RolBadge rol={rol} />
    </span>
  );
}

function EstadoUsuario({ activo }: { activo: boolean }) {
  return activo ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-emerald-700">
      <CircleCheck className="h-4 w-4" aria-hidden />
      Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-gray-400">
      <CircleOff className="h-4 w-4" aria-hidden />
      Inactivo
    </span>
  );
}

export function UsuariosListPage() {
  const { sesion } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listarUsuarios,
  });
  const [busqueda, setBusqueda] = useState("");
  const [rol, setRol] = useState("");
  const [estado, setEstado] = useState("");
  const visibles = data ? filtrarUsuarios(data, { busqueda, rol, estado }) : [];

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        title="Usuarios" icon={Users}
        description="Operadores, admins y repartidores del sistema."
        action={
          <Link to="/usuarios/nuevo">
            <Button type="button"><Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
Nuevo usuario</Button>
          </Link>
        }
      />

      {data && data.length > 0 && (
        <BarraFiltros
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por nombre, email o teléfono"
          hayFiltros={Boolean(busqueda || rol || estado)}
          onLimpiar={() => { setBusqueda(""); setRol(""); setEstado(""); }}
          resumen={`${visibles.length} de ${data.length}`}
        >
          <FiltroSelect label="Rol" value={rol} onChange={setRol}>
            <option value="">Todos</option>
            <option value="operador">Operador</option>
            <option value="repartidor">Repartidor</option>
            <option value="admin">Admin</option>
          </FiltroSelect>
          <FiltroSelect label="Estado" value={estado} onChange={setEstado}>
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </FiltroSelect>
        </BarraFiltros>
      )}

      {isLoading && <SkeletonTabla label="Cargando usuarios…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar los usuarios")}</Alert>}
      {data && data.length === 0 && <EmptyState title="No hay usuarios cargados" />}

      {data && data.length > 0 && visibles.length === 0 && <EmptyState title="Ningún usuario coincide con los filtros" />}

      {/* Celular: tarjetas apiladas, sin tabla que desborde la página (H35). */}
      {visibles.length > 0 && (
        <ul className="flex flex-col gap-3 md:hidden">
          {visibles.map((usuario) => (
            <li key={usuario.id} className="rounded-panel border border-hormigon-200 bg-white p-4 shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-asfalto-900 text-sm font-bold text-movii-500">{usuario.nombre.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-gray-900">{usuario.nombre}</span>
                    <span className="block break-all text-xs text-gray-500">{usuario.email}</span>
                  </span>
                </span>
                {usuario.id !== sesion?.usuarioId && (
                  <BotonEliminar nombre={usuario.nombre} eliminar={() => eliminarUsuario(usuario.id)} invalidar={[["usuarios"]]} />
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700">
                <RolConIcono rol={usuario.rol} />
                <EstadoUsuario activo={usuario.activo} />
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  <TelefonoEditable usuarioId={usuario.id} telefono={telefonoUniforme(usuario.telefono)} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Tablet y escritorio: tabla con scroll horizontal propio si no entra. */}
      {visibles.length > 0 && (
        <Card className="hidden min-w-0 overflow-hidden p-0 md:block">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hormigon-200 text-sm">
            <thead className="bg-hormigon-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Celular</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hormigon-100">
              {visibles.map((usuario) => (
                <tr key={usuario.id} className="transition-colors hover:bg-movii-50/40">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-asfalto-900 text-sm font-bold text-movii-500">{usuario.nombre.slice(0, 1).toUpperCase()}</span>
                      <span className="font-semibold">{usuario.nombre}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                      {usuario.email}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                      <TelefonoEditable usuarioId={usuario.id} telefono={telefonoUniforme(usuario.telefono)} />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RolConIcono rol={usuario.rol} />
                  </td>
                  <td className="px-4 py-3">
                    <EstadoUsuario activo={usuario.activo} />
                  </td>
                  <td className="px-4 py-3">
                    {usuario.id !== sesion?.usuarioId && (
                      <BotonEliminar nombre={usuario.nombre} eliminar={() => eliminarUsuario(usuario.id)} invalidar={[["usuarios"]]} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </div>
  );
}
