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
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { formatearDia } from "@/utils/fechas";

export function RutasListPage() {
  const [fecha, setFecha] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["rutas", { fecha }],
    queryFn: () => listarRutas({ fecha: fecha || undefined }),
  });

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        title="Rutas"
        description="Rutas de reparto diarias y sus envíos asignados."
        action={
          <Link to="/rutas/nueva">
            <Button type="button">+ Nueva ruta</Button>
          </Link>
        }
      />

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((ruta) => (
            <Link key={ruta.id} to={`/rutas/${ruta.id}`} className="block">
              <Card className="flex h-full flex-col gap-4 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{ruta.nombre || "(sin nombre)"}</h2>
                    <p className="text-sm text-gray-500">
                      {ruta.zona || "Sin zona"} · {formatearDia(ruta.fecha)}
                    </p>
                  </div>
                  <EstadoRutaBadge estado={ruta.estado} />
                </div>
                <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-movii-500 text-sm font-bold text-movii-900">
                    {(ruta.repartidor_nombre ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Repartidor</p>
                    <p className="text-sm font-medium text-gray-900">{ruta.repartidor_nombre ?? "Sin asignar"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-gray-900">{ruta.cantidad_envios}</p>
                    <p className="text-xs text-gray-500">{ruta.cantidad_envios === 1 ? "envío" : "envíos"}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
