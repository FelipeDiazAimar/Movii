import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listarRutas } from "@/features/rutas/api";
import { EstadoRutaBadge } from "@/components/ui/Badge";
import { Card, EmptyState } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import { getApiErrorMessage } from "@/services/api-client";

export function RutasListPage() {
  const [fecha, setFecha] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["rutas", { fecha }],
    queryFn: () => listarRutas({ fecha: fecha || undefined }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Rutas</h1>
          <p className="text-sm text-gray-500">Rutas de reparto diarias y sus envíos asignados.</p>
        </div>
        <Link to="/rutas/nueva">
          <Button type="button">+ Nueva ruta</Button>
        </Link>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <InputField label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          {fecha && (
            <Button type="button" variant="ghost" onClick={() => setFecha("")}>
              Limpiar filtro
            </Button>
          )}
        </div>
      </Card>

      {isLoading && <Spinner label="Cargando rutas…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar las rutas")}</Alert>}
      {data && data.length === 0 && (
        <EmptyState title="No hay rutas" description="Todavía no se creó ninguna ruta con estos filtros." />
      )}

      {data && data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Zona</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Envíos</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((ruta) => (
                <tr key={ruta.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link to={`/rutas/${ruta.id}`} className="hover:text-movii-600 hover:underline">
                      {ruta.nombre || "(sin nombre)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{ruta.zona || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{ruta.fecha}</td>
                  <td className="px-4 py-3 text-gray-700">{ruta.cantidad_envios}</td>
                  <td className="px-4 py-3">
                    <EstadoRutaBadge estado={ruta.estado} />
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
