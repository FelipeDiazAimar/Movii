import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listarRutas, eliminarRuta } from "@/features/rutas/api";
import { EstadoRutaBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Card";
import { SkeletonTarjetas } from "@/components/ui/Skeleton";
import { BarraFiltros, FiltroSelect } from "@/components/ui/BarraFiltros";
import { filtrarRutas } from "@/utils/filtros";
import { listarRepartidores } from "@/features/usuarios/api";
import { ESTADOS_RUTA } from "@/features/rutas/types";
import { BotonEliminar } from "@/components/ui/BotonEliminar";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/services/api-client";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { formatearDia } from "@/utils/fechas";

import { Calendar, MapPin, MapPinned, Package, Plus, Route, X } from "lucide-react";
import { SpotlightCard } from "@/components/ui/Efectos";
export function RutasListPage() {
  const [fecha, setFecha] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["rutas", { fecha }],
    queryFn: () => listarRutas({ fecha: fecha || undefined }),
    placeholderData: keepPreviousData,
  });
  const repartidores = useQuery({ queryKey: ["repartidores"], queryFn: listarRepartidores });
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [repartidor, setRepartidor] = useState("");
  const visibles = data ? filtrarRutas(data, { busqueda, estado, repartidor }) : [];

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        title="Rutas" icon={Route}
        description="Rutas de reparto diarias y sus envíos asignados."
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
            <Link to="/rutas/nueva">
              <Button type="button">
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Nueva ruta
              </Button>
            </Link>
          </div>
        }
      />

      <BarraFiltros
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por nombre, zona o repartidor"
        hayFiltros={Boolean(busqueda || estado || repartidor || fecha)}
        onLimpiar={() => { setBusqueda(""); setEstado(""); setRepartidor(""); setFecha(""); }}
        resumen={data ? `${visibles.length} de ${data.length}` : undefined}
      >
        <FiltroSelect label="Estado" value={estado} onChange={setEstado}>
          <option value="">Todos</option>
          {ESTADOS_RUTA.map((e) => (
            <option key={e} value={e}>{e.replace("_", " ")}</option>
          ))}
        </FiltroSelect>
        <FiltroSelect label="Repartidor" value={repartidor} onChange={setRepartidor}>
          <option value="">Todos</option>
          {(repartidores.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </FiltroSelect>
      </BarraFiltros>

      {isLoading && <SkeletonTarjetas label="Cargando rutas…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar las rutas")}</Alert>}
      {data && data.length > 0 && visibles.length === 0 && <EmptyState title="Ninguna ruta coincide con los filtros" />}
      {data && data.length === 0 && (
        <EmptyState title="No hay rutas" description="Todavía no se creó ninguna ruta con estos filtros." />
      )}

      {visibles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((ruta) => (
            <SpotlightCard key={ruta.id} className="h-full">
              <Link to={`/rutas/${ruta.id}`} className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-asfalto-900 text-movii-500">
                      <Route className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-expandida truncate text-base font-extrabold text-gray-900">{ruta.nombre || "(sin nombre)"}</h2>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{ruta.zona || "Sin zona"}</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" aria-hidden />{formatearDia(ruta.fecha)}</span>
                      </p>
                    </div>
                  </div>
                  <EstadoRutaBadge estado={ruta.estado} />
                </div>
                <div className="mt-auto flex items-center gap-3 border-t border-hormigon-100 pt-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-movii-500 text-sm font-bold text-movii-900">
                    {(ruta.repartidor_nombre ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Repartidor</p>
                    <p className="text-sm font-medium text-gray-900">{ruta.repartidor_nombre ?? "Sin asignar"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-expandida inline-flex items-center gap-1.5 text-2xl font-black text-gray-900">
                      <Package className="h-4 w-4 text-gray-400" aria-hidden />
                      {ruta.cantidad_envios}
                    </p>
                    <p className="text-xs text-gray-500">{ruta.cantidad_envios === 1 ? "envío" : "envíos"}</p>
                  </div>
                </div>
              </Link>
              <Link
                to={`/rutas/${ruta.id}/mapa`}
                className="flex items-center justify-center gap-2 border-t border-hormigon-100 py-2.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-movii-50 hover:text-gray-900"
              >
                <MapPinned className="h-3.5 w-3.5" aria-hidden />
                Ver en el mapa
              </Link>
              <div className="flex justify-end border-t border-hormigon-100 px-2 py-1">
                <BotonEliminar nombre={ruta.nombre || "(sin nombre)"} eliminar={() => eliminarRuta(ruta.id)} invalidar={[["rutas"]]} />
              </div>
            </SpotlightCard>
          ))}
        </div>
      )}
    </div>
  );
}
