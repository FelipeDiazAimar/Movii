import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { obtenerDashboard } from "@/features/analitica/api";
import { EstadoRutaBadge } from "@/components/ui/Badge";
import { Card, EmptyState } from "@/components/ui/Card";
import { InputField } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { getApiErrorMessage } from "@/services/api-client";
import { hoyISO } from "@/features/analitica/fechas";

function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className="text-2xl font-semibold text-gray-900">{valor}</p>
    </Card>
  );
}

export function DashboardPage() {
  const [fecha, setFecha] = useState(hoyISO());

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard", fecha],
    queryFn: () => obtenerDashboard(fecha),
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Panel en vivo</h1>
        <InputField label="Fecha" type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
      </div>

      {isLoading && <Spinner label="Cargando panel…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudo cargar el panel")}</Alert>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Kpi titulo="Total" valor={String(data.metricas.total_envios)} />
            <Kpi titulo="Entregados" valor={String(data.metricas.entregados)} />
            <Kpi titulo="En camino" valor={String(data.metricas.en_camino)} />
            <Kpi titulo="No entregados" valor={String(data.metricas.no_entregados)} />
            <Kpi titulo="% Efectividad" valor={`${data.metricas.porcentaje_efectividad}%`} />
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Rutas del día</h2>
            {data.rutas_activas.length === 0 ? (
              <EmptyState title="Sin rutas para esta fecha" />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Ruta</th>
                    <th className="px-3 py-2">Repartidor</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Avance</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.rutas_activas.map((r) => (
                    <tr key={r.ruta_id}>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        <Link to={`/rutas/${r.ruta_id}`} className="hover:text-movii-600 hover:underline">
                          {r.nombre}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{r.repartidor_nombre}</td>
                      <td className="px-3 py-2">
                        <EstadoRutaBadge estado={r.estado_ruta} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-32 rounded-full bg-gray-200">
                            <div
                              className="h-2 rounded-full bg-movii-500"
                              style={{ width: `${Math.min(100, r.porcentaje_avance)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {r.completadas}/{r.total_paradas} ({r.porcentaje_avance}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link to={`/rutas/${r.ruta_id}/mapa`} className="text-movii-600 hover:underline">
                          Ver mapa
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Últimas alertas</h2>
            {data.ultimas_alertas.length === 0 ? (
              <EmptyState title="Sin alertas" />
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {data.ultimas_alertas.map((a, i) => (
                  <li key={`${a.envio_id}-${i}`} className="flex items-center justify-between py-2">
                    <div>
                      <Link to={`/envios/${a.envio_id}`} className="font-medium text-movii-600 hover:underline">
                        {a.codigo_guia}
                      </Link>
                      <span className="ml-2 text-gray-700">{a.descripcion}</span>
                    </div>
                    <span className="text-xs text-gray-500">{new Date(a.fecha).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
