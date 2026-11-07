import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listarRepartidores } from "@/features/usuarios/api";
import { listarRutas } from "@/features/rutas/api";
import { getApiErrorMessage } from "@/services/api-client";
import { Alert } from "@/components/ui/Alert";
import { Card, EmptyState } from "@/components/ui/Card";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";

import { ChevronRight, Package, Route, Truck, UserRound } from "lucide-react";
export function RepartidoresListPage() {
  const repartidores = useQuery({ queryKey: ["repartidores"], queryFn: listarRepartidores });
  const rutas = useQuery({ queryKey: ["rutas", { fecha: undefined }], queryFn: () => listarRutas({}) });

  const cargando = repartidores.isLoading || rutas.isLoading;
  const error = repartidores.error ?? rutas.error;

  return (
    <div className={PAGE_WIDE}>
      <PageHeader title="Repartidores" icon={UserRound} description="Quién reparte, con qué rutas y cuántos envíos tiene a cargo." />

      {cargando && <Spinner label="Cargando repartidores…" />}
      {error && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar los repartidores")}</Alert>}

      {repartidores.data && repartidores.data.length === 0 && (
        <EmptyState title="No hay repartidores" description="Un supervisor puede crear usuarios con rol repartidor." />
      )}

      {repartidores.data && repartidores.data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-hormigon-200 text-sm">
            <thead className="bg-hormigon-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3">Repartidor</th>
                <th className="px-4 py-3">Rutas</th>
                <th className="px-4 py-3">Envíos a cargo</th>
                <th className="px-4 py-3"><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hormigon-100">
              {repartidores.data.map((r) => {
                const suyas = (rutas.data ?? []).filter((x) => x.repartidor_id === r.id);
                const envios = suyas.reduce((n, x) => n + x.cantidad_envios, 0);
                return (
                  <tr key={r.id} className="transition-colors hover:bg-movii-50/40">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link to={`/repartidores/${r.id}`} className="flex items-center gap-3 hover:text-movii-700">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-asfalto-900 text-sm font-bold text-movii-500">{r.nombre.slice(0, 1).toUpperCase()}</span>
                        <span>
                          <span className="block font-semibold">{r.nombre}</span>
                          <span className="flex items-center gap-1 text-xs font-normal text-gray-500">
                            <Truck className="h-3 w-3" aria-hidden />
                            Repartidor
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Route className="h-4 w-4 text-gray-400" aria-hidden />
                        <span className="tabular font-semibold">{suyas.length}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Package className="h-4 w-4 text-gray-400" aria-hidden />
                        <span className="tabular font-semibold">{envios}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/repartidores/${r.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-hormigon-100 hover:text-gray-900">
                        <ChevronRight className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Ver {r.nombre}</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
