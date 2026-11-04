import { formatearFecha } from "@/utils/fechas";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listarEnvios } from "@/features/envios/api";
import { ESTADOS_ENVIO, type EstadoEnvio } from "@/features/envios/types";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { Card, EmptyState } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, InputField } from "@/components/ui/Field";
import { getApiErrorMessage } from "@/services/api-client";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";

export function EnviosListPage() {
  const [estado, setEstado] = useState<EstadoEnvio | "">("");
  const [fecha, setFecha] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["envios", { estado, fecha }],
    queryFn: () => listarEnvios({ estado: estado || undefined, fecha: fecha || undefined }),
  });

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        title="Envíos"
        description="Listado de envíos registrados en el sistema."
        action={
          <Link to="/envios/nuevo">
            <Button type="button">+ Nuevo envío</Button>
          </Link>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <SelectField
              label="Estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoEnvio | "")}
            >
              <option value="">Todos</option>
              {ESTADOS_ENVIO.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="w-48">
            <InputField label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          {(estado || fecha) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEstado("");
                setFecha("");
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      </Card>

      {isLoading && <Spinner label="Cargando envíos…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar los envíos")}</Alert>}

      {data && data.length === 0 && (
        <EmptyState title="No hay envíos" description="Todavía no se registró ningún envío con estos filtros." />
      )}

      {data && data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Código de guía</th>
                <th className="px-4 py-3">Destinatario</th>
                <th className="px-4 py-3">Dirección</th>
                <th className="px-4 py-3">Peso</th>
                <th className="px-4 py-3">Ruta</th>
                <th className="px-4 py-3">Repartidor</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((envio) => (
                <tr key={envio.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link to={`/envios/${envio.id}`} className="hover:text-movii-600 hover:underline">
                      {envio.codigo_guia}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{envio.destinatario}</td>
                  <td className="px-4 py-3 text-gray-500">{envio.direccion}</td>
                  <td className="px-4 py-3 text-gray-700">{envio.peso} kg</td>
                  <td className="px-4 py-3 text-gray-700">
                    {envio.ruta_id ? (
                      <Link to={`/rutas/${envio.ruta_id}`} className="hover:text-movii-600 hover:underline">
                        {envio.ruta_nombre || "Ver ruta"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{envio.repartidor_nombre || "—"}</td>
                  <td className="px-4 py-3">
                    <EstadoEnvioBadge estado={envio.estado} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatearFecha(envio.fecha_creacion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
