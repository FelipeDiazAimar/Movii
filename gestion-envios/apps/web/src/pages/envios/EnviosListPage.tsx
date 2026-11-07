import { formatearFecha } from "@/utils/fechas";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listarEnvios } from "@/features/envios/api";
import { type EstadoEnvio } from "@/features/envios/types";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { Card, EmptyState } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/services/api-client";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";

import { Calendar, CircleCheck, CircleDashed, Clock, Package, Plus, TriangleAlert, Truck, X, type LucideIcon } from "lucide-react";

/** Filtro rápido por estado: cada opción con su ícono y su contador. */
const FILTROS: { valor: EstadoEnvio | ""; etiqueta: string; icono: LucideIcon }[] = [
  { valor: "", etiqueta: "Todos", icono: Package },
  { valor: "pendiente", etiqueta: "Pendientes", icono: CircleDashed },
  { valor: "asignado", etiqueta: "Asignados", icono: Clock },
  { valor: "en_camino", etiqueta: "En camino", icono: Truck },
  { valor: "entregado", etiqueta: "Entregados", icono: CircleCheck },
  { valor: "no_entregado", etiqueta: "No entregados", icono: TriangleAlert },
];
export function EnviosListPage() {
  const [estado, setEstado] = useState<EstadoEnvio | "">("");
  const [fecha, setFecha] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["envios", { estado, fecha }],
    queryFn: () => listarEnvios({ estado: estado || undefined, fecha: fecha || undefined }),
  });
  // Contadores por estado (misma fecha, sin filtrar por estado).
  const todos = useQuery({ queryKey: ["envios", { fecha }], queryFn: () => listarEnvios({ fecha: fecha || undefined }) });
  const contar = (e: EstadoEnvio | "") => (todos.data ?? []).filter((x) => !e || x.estado === e).length;

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        title="Envíos" icon={Package}
        description="Listado de envíos registrados en el sistema."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-[42px] items-center gap-2 rounded-xl border border-hormigon-300 bg-white px-3 text-sm text-gray-700 shadow-panel focus-within:ring-2 focus-within:ring-movii-400">
              <Calendar className="h-4 w-4 text-gray-400" aria-hidden />
              <span className="sr-only">Fecha</span>
              <input type="date" aria-label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} className="bg-transparent text-sm outline-none" />
              {fecha && (
                <button type="button" onClick={() => setFecha("")} title="Quitar filtro de fecha" className="rounded-md p-0.5 text-gray-400 hover:bg-hormigon-100 hover:text-gray-700">
                  <X className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Quitar filtro de fecha</span>
                </button>
              )}
            </label>
            <Link to="/envios/nuevo">
              <Button type="button">
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Nuevo envío
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por estado">
        {FILTROS.map((f) => {
          const activo = estado === f.valor;
          return (
            <button
              key={f.valor || "todos"}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setEstado(f.valor)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
                activo ? "border-asfalto-900 bg-asfalto-900 text-white" : "border-hormigon-200 bg-white text-gray-700 hover:border-hormigon-300"
              }`}
            >
              <f.icono className={`h-4 w-4 ${activo ? "text-movii-500" : "text-gray-400"}`} aria-hidden />
              {f.etiqueta}
              <span className={`tabular rounded-full px-2 py-0.5 text-xs ${activo ? "bg-white/15 text-white" : "bg-hormigon-100 text-gray-600"}`}>{contar(f.valor)}</span>
            </button>
          );
        })}
      </div>

      {isLoading && <Spinner label="Cargando envíos…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar los envíos")}</Alert>}

      {data && data.length === 0 && (
        <EmptyState title="No hay envíos" description="Todavía no se registró ningún envío con estos filtros." />
      )}

      {data && data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-hormigon-200 text-sm">
            <thead className="bg-hormigon-50 text-left text-xs font-semibold text-gray-500">
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
            <tbody className="divide-y divide-hormigon-100">
              {data.map((envio) => (
                <tr key={envio.id} className="transition-colors hover:bg-movii-50/40">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link to={`/envios/${envio.id}`} className="inline-flex items-center gap-2 hover:text-movii-700">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-hormigon-100 text-gray-600">
                        <Package className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="tabular whitespace-nowrap font-semibold">{envio.codigo_guia}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{envio.destinatario}</td>
                  <td className="px-4 py-3 text-gray-500">{envio.direccion}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{envio.peso} kg</td>
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
