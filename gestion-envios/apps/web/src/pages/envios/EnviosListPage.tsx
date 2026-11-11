import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listarEnvios, eliminarEnvio } from "@/features/envios/api";
import { type EstadoEnvio } from "@/features/envios/types";
import { altaCompacta } from "@/features/envios/formato";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { Card, EmptyState } from "@/components/ui/Card";
import { SkeletonTabla } from "@/components/ui/Skeleton";
import { BarraFiltros } from "@/components/ui/BarraFiltros";
import { filtrarEnvios } from "@/utils/filtros";
import { BotonEliminar } from "@/components/ui/BotonEliminar";
import { Alert } from "@/components/ui/Alert";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/services/api-client";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";

import { CircleCheck, CircleDashed, Clock, Package, Plus, TriangleAlert, Truck, type LucideIcon } from "lucide-react";

/** Filtro rápido por estado: cada opción con su ícono y su contador. */
const FILTROS: { valor: EstadoEnvio | ""; etiqueta: string; icono: LucideIcon }[] = [
  { valor: "", etiqueta: "Todos", icono: Package },
  { valor: "pendiente", etiqueta: "Pendientes", icono: CircleDashed },
  { valor: "asignado", etiqueta: "Asignados", icono: Clock },
  { valor: "en_camino", etiqueta: "En camino", icono: Truck },
  { valor: "entregado", etiqueta: "Entregados", icono: CircleCheck },
  { valor: "no_entregado", etiqueta: "No entregados", icono: TriangleAlert },
];
/** Alta compacta (H36): día y hora en dos renglones cortos, sin partir la fecha. */
function AltaCelda({ iso }: { iso: string }) {
  const { dia, hora } = altaCompacta(iso);
  return (
    <time dateTime={iso} className="tabular flex flex-col leading-tight">
      <span>{dia}</span>
      {hora && <span className="text-xs text-gray-400">{hora}</span>}
    </time>
  );
}

export function EnviosListPage() {
  const [estado, setEstado] = useState<EstadoEnvio | "">("");
  const [fecha, setFecha] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["envios", { estado, fecha }],
    queryFn: () => listarEnvios({ estado: estado || undefined, fecha: fecha || undefined }),
    placeholderData: keepPreviousData,
  });
  const visibles = data ? filtrarEnvios(data, busqueda) : [];
  // Contadores por estado (misma fecha, sin filtrar por estado).
  const todos = useQuery({ queryKey: ["envios", { fecha }], queryFn: () => listarEnvios({ fecha: fecha || undefined }) });
  const contar = (e: EstadoEnvio | "") => (todos.data ?? []).filter((x) => !e || x.estado === e).length;

  return (
    <div className={`${PAGE_WIDE} min-w-0`}>
      <PageHeader
        title="Envíos" icon={Package}
        description="Listado de envíos registrados en el sistema."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker aria-label="Fecha" value={fecha} onChange={setFecha} limpiable placeholder="Todas las fechas" className="w-full min-w-0 sm:w-56" />
            <Link to="/envios/nuevo">
              <Button type="button">
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Nuevo envío
              </Button>
            </Link>
          </div>
        }
      />

      <BarraFiltros
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por guía, destinatario, dirección, ruta o repartidor"
        hayFiltros={Boolean(busqueda || estado || fecha)}
        onLimpiar={() => { setBusqueda(""); setEstado(""); setFecha(""); }}
        resumen={data ? `${visibles.length} de ${data.length}` : undefined}
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

      {isLoading && <SkeletonTabla label="Cargando envíos…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar los envíos")}</Alert>}

      {data && data.length === 0 && (
        <EmptyState title="No hay envíos" description="Todavía no se registró ningún envío con estos filtros." />
      )}

      {data && data.length > 0 && visibles.length === 0 && <EmptyState title="Ningún envío coincide con la búsqueda" />}

      {visibles.length > 0 && (
        // Columnas secundarias ocultas en pantallas chicas (390 px: guía,
        // destinatario y estado; 768 px: + peso, ruta y alta) y, por si
        // igual no entra, scroll horizontal propio de la tarjeta, nunca de la página.
        <Card className="w-full min-w-0 max-w-full overflow-x-auto p-0">
          <table className="w-full divide-y divide-hormigon-200 text-sm">
            <thead className="bg-hormigon-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-3 py-3 sm:px-4">Código de guía</th>
                <th className="hidden px-4 py-3 sm:table-cell">Destinatario</th>
                <th className="hidden px-4 py-3 lg:table-cell">Dirección</th>
                <th className="hidden px-4 py-3 md:table-cell">Peso</th>
                <th className="hidden px-4 py-3 md:table-cell">Ruta</th>
                <th className="hidden px-4 py-3 xl:table-cell">Repartidor</th>
                <th className="px-1 py-3 sm:px-4">Estado</th>
                <th className="hidden px-4 py-3 md:table-cell">Alta</th>
                <th className="py-3 pl-0 pr-1 sm:px-4"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hormigon-100">
              {visibles.map((envio) => (
                <tr key={envio.id} className="transition-colors hover:bg-movii-50/40">
                  <td className="py-3 pl-3 pr-1 font-medium text-gray-900 sm:px-4">
                    <Link to={`/envios/${envio.id}`} className="inline-flex items-center gap-2 hover:text-movii-700">
                      <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hormigon-100 text-gray-600 sm:flex">
                        <Package className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="tabular whitespace-nowrap font-semibold">{envio.codigo_guia}</span>
                    </Link>
                    {/* En el celular el destinatario y la dirección van debajo del código (3 columnas en total). */}
                    <span className="mt-0.5 block text-sm font-normal text-gray-700 sm:hidden">{envio.destinatario}</span>
                    <span className="block text-xs font-normal text-gray-500 sm:hidden">{envio.direccion}</span>
                  </td>
                  <td className="hidden px-3 py-3 text-gray-700 sm:table-cell sm:px-4">
                    <span className="break-words">{envio.destinatario}</span>
                    {/* En pantallas chicas la dirección (columna oculta) va debajo del destinatario. */}
                    <span className="block text-xs text-gray-500 lg:hidden">{envio.direccion}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-500 lg:table-cell">{envio.direccion}</td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-gray-700 md:table-cell">{envio.peso} kg</td>
                  <td className="hidden px-4 py-3 text-gray-700 md:table-cell">
                    {envio.ruta_id ? (
                      <Link to={`/rutas/${envio.ruta_id}`} className="hover:text-movii-600 hover:underline">
                        {envio.ruta_nombre || "Ver ruta"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-700 xl:table-cell">{envio.repartidor_nombre || "—"}</td>
                  <td className="px-1 py-3 sm:px-4">
                    <EstadoEnvioBadge estado={envio.estado} />
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-gray-500 md:table-cell">
                    <AltaCelda iso={envio.fecha_creacion} />
                  </td>
                  <td className="py-3 pl-0 pr-1 sm:px-4"><BotonEliminar nombre={envio.codigo_guia} eliminar={() => eliminarEnvio(envio.id)} invalidar={[["envios"], ["rutas"]]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
