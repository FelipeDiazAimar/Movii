import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listarRepartidores } from "@/features/usuarios/api";
import { listarRutas } from "@/features/rutas/api";
import { getApiErrorMessage } from "@/services/api-client";
import { Alert } from "@/components/ui/Alert";
import { Card, EmptyState } from "@/components/ui/Card";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { SkeletonTabla } from "@/components/ui/Skeleton";
import { BarraFiltros, FiltroSelect } from "@/components/ui/BarraFiltros";
import { estadoHoy, filtrarRepartidores } from "@/utils/filtros";
import { hoyISO } from "@/features/analitica/fechas";

import { ChevronRight, Package, Route, Truck, UserRound } from "lucide-react";
const ETIQUETA_HOY = { libre: "Libre", planificada: "Ruta planificada", en_ruta: "En ruta" } as const;
const ESTILO_HOY = {
  libre: "bg-green-50 text-green-700",
  planificada: "bg-blue-50 text-blue-700",
  en_ruta: "bg-movii-100 text-movii-900",
} as const;

export function RepartidoresListPage() {
  const repartidores = useQuery({ queryKey: ["repartidores"], queryFn: listarRepartidores });
  const rutas = useQuery({ queryKey: ["rutas", { fecha: undefined }], queryFn: () => listarRutas({}) });

  const [busqueda, setBusqueda] = useState("");
  const [conRuta, setConRuta] = useState("");
  const [zona, setZona] = useState("");
  const [vehiculo, setVehiculo] = useState("");
  const [hoyEstado, setHoyEstado] = useState("");
  const hoy = hoyISO();
  const zonas = [...new Set((rutas.data ?? []).map((r) => r.zona).filter(Boolean))].sort();
  const visibles = repartidores.data
    ? filtrarRepartidores(repartidores.data, rutas.data ?? [], { busqueda, conRuta, zona, vehiculo, hoyEstado, hoy })
    : [];
  const cargando = repartidores.isLoading || rutas.isLoading;
  const error = repartidores.error ?? rutas.error;

  return (
    <div className={PAGE_WIDE}>
      <PageHeader title="Repartidores" icon={UserRound} description="Quién reparte, con qué rutas y cuántos envíos tiene a cargo." />

      {repartidores.data && repartidores.data.length > 0 && (
        <BarraFiltros
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por nombre o ruta"
          hayFiltros={Boolean(busqueda || conRuta || zona || vehiculo || hoyEstado)}
          onLimpiar={() => { setBusqueda(""); setConRuta(""); setZona(""); setVehiculo(""); setHoyEstado(""); }}
          resumen={`${visibles.length} de ${repartidores.data.length}`}
        >
          <FiltroSelect label="Rutas" value={conRuta} onChange={setConRuta}>
            <option value="">Todos</option>
            <option value="con">Con rutas</option>
            <option value="sin">Sin rutas</option>
          </FiltroSelect>
          <FiltroSelect label="Hoy" value={hoyEstado} onChange={setHoyEstado}>
            <option value="">Todos</option>
            <option value="libre">Libre</option>
            <option value="planificada">Con ruta planificada</option>
            <option value="en_ruta">En ruta</option>
          </FiltroSelect>
          <FiltroSelect label="Zona" value={zona} onChange={setZona}>
            <option value="">Todas</option>
            {zonas.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </FiltroSelect>
          <FiltroSelect label="Vehículo" value={vehiculo} onChange={setVehiculo}>
            <option value="">Todos</option>
            <option value="con">Con vehículo</option>
            <option value="sin">Sin vehículo</option>
          </FiltroSelect>
        </BarraFiltros>
      )}

      {cargando && <SkeletonTabla label="Cargando repartidores…" />}
      {error && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar los repartidores")}</Alert>}

      {repartidores.data && repartidores.data.length === 0 && (
        <EmptyState title="No hay repartidores" description="Un admin puede crear usuarios con rol repartidor." />
      )}

      {repartidores.data && repartidores.data.length > 0 && visibles.length === 0 && <EmptyState title="Ningún repartidor coincide con los filtros" />}

      {visibles.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-hormigon-200 text-sm">
            <thead className="bg-hormigon-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3">Repartidor</th>
                <th className="px-4 py-3">Rutas</th>
                <th className="px-4 py-3">Envíos a cargo</th>
                <th className="px-4 py-3">Hoy</th>
                <th className="px-4 py-3">Vehículos</th>
                <th className="px-4 py-3"><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hormigon-100">
              {visibles.map((r) => {
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
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ESTILO_HOY[estadoHoy(suyas, hoy)]}`}>{ETIQUETA_HOY[estadoHoy(suyas, hoy)]}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {[...new Set(suyas.map((x) => x.vehiculo_patente).filter(Boolean))].join(", ") || "—"}
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
