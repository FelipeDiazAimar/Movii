import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listarRepartidores } from "@/features/usuarios/api";
import { listarRutas } from "@/features/rutas/api";
import { getApiErrorMessage } from "@/services/api-client";
import { Alert } from "@/components/ui/Alert";
import { Card, EmptyState } from "@/components/ui/Card";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";

export function RepartidoresListPage() {
  const repartidores = useQuery({ queryKey: ["repartidores"], queryFn: listarRepartidores });
  const rutas = useQuery({ queryKey: ["rutas", { fecha: undefined }], queryFn: () => listarRutas({}) });

  const cargando = repartidores.isLoading || rutas.isLoading;
  const error = repartidores.error ?? rutas.error;

  return (
    <div className={PAGE_WIDE}>
      <PageHeader title="Repartidores" description="Quién reparte, con qué rutas y cuántos envíos tiene a cargo." />

      {cargando && <Spinner label="Cargando repartidores…" />}
      {error && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar los repartidores")}</Alert>}

      {repartidores.data && repartidores.data.length === 0 && (
        <EmptyState title="No hay repartidores" description="Un supervisor puede crear usuarios con rol repartidor." />
      )}

      {repartidores.data && repartidores.data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Repartidor</th>
                <th className="px-4 py-3">Rutas</th>
                <th className="px-4 py-3">Envíos a cargo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {repartidores.data.map((r) => {
                const suyas = (rutas.data ?? []).filter((x) => x.repartidor_id === r.id);
                const envios = suyas.reduce((n, x) => n + x.cantidad_envios, 0);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link to={`/repartidores/${r.id}`} className="hover:text-movii-600 hover:underline">
                        {r.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{suyas.length}</td>
                    <td className="px-4 py-3 text-gray-700">{envios}</td>
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
