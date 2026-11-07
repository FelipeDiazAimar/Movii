import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listarRepartidores } from "@/features/usuarios/api";
import { editarRuta, listarRutas } from "@/features/rutas/api";
import { getApiErrorMessage } from "@/services/api-client";
import { Alert } from "@/components/ui/Alert";
import { EstadoRutaBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { Dato } from "@/components/ui/Dato";
import { SelectField } from "@/components/ui/Field";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { formatearDia } from "@/utils/fechas";

import { Plus } from "lucide-react";
export function RepartidorDetallePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [rutaElegida, setRutaElegida] = useState("");

  const repartidores = useQuery({ queryKey: ["repartidores"], queryFn: listarRepartidores });
  const rutas = useQuery({ queryKey: ["rutas", { fecha: undefined }], queryFn: () => listarRutas({}) });

  const repartidor = repartidores.data?.find((r) => r.id === id);
  const suyas = (rutas.data ?? []).filter((r) => r.repartidor_id === id);
  const asignables = (rutas.data ?? []).filter((r) => r.repartidor_id !== id && r.estado === "planificada");

  const asignar = useMutation({
    mutationFn: () => {
      const ruta = (rutas.data ?? []).find((r) => r.id === rutaElegida);
      if (!ruta || !id) throw new Error("Elegí una ruta");
      return editarRuta(ruta.id, { nombre: ruta.nombre, zona: ruta.zona, fecha: ruta.fecha, repartidor_id: id });
    },
    onSuccess: async () => {
      setRutaElegida("");
      await queryClient.invalidateQueries({ queryKey: ["rutas"] });
      await queryClient.invalidateQueries({ queryKey: ["envios"] });
    },
  });

  if (repartidores.isLoading || rutas.isLoading) return <Spinner label="Cargando repartidor…" />;
  if (!repartidor) return <Alert variant="error">No se encontró al repartidor.</Alert>;

  const envios = suyas.reduce((n, r) => n + r.cantidad_envios, 0);

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        back={{ to: "/repartidores", label: "Volver a repartidores" }}
        title={repartidor.nombre}
        action={
          <Link to={`/rutas/nueva?repartidor=${repartidor.id}`}>
            <Button type="button"><Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
Nueva ruta</Button>
          </Link>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
      <Card className="p-0">
        <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Sus rutas</h2>
        {suyas.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin rutas" description="Creá una ruta nueva o asignale una existente." />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-hormigon-200 text-sm">
            <thead className="bg-hormigon-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-2">Ruta</th>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Envíos</th>
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hormigon-100">
              {suyas.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-movii-50/40">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    <Link to={`/rutas/${r.id}`} className="hover:text-movii-600 hover:underline">
                      {r.nombre || "(sin nombre)"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{formatearDia(r.fecha)}</td>
                  <td className="px-4 py-2 text-gray-700">{r.cantidad_envios}</td>
                  <td className="px-4 py-2">
                    <EstadoRutaBadge estado={r.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

        </div>
        <div className="flex flex-col gap-4">
      <Card>
        <dl className="grid grid-cols-2 gap-4">
          <Dato label="Rutas" value={suyas.length} />
          <Dato label="Envíos a cargo" value={envios} />
        </dl>
      </Card>


      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Asignarle una ruta existente</h2>
        {asignar.isError && <Alert variant="error">{getApiErrorMessage(asignar.error, "No se pudo asignar la ruta")}</Alert>}
        {asignables.length === 0 ? (
          <p className="text-sm text-gray-500">No hay otras rutas planificadas para reasignar.</p>
        ) : (
          <div className="flex items-end gap-3">
            <div className="w-80">
              <SelectField label="Ruta" value={rutaElegida} onChange={(e) => setRutaElegida(e.target.value)}>
                <option value="">Seleccionar…</option>
                {asignables.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} · {formatearDia(r.fecha)} · {r.repartidor_nombre ?? "sin repartidor"}
                  </option>
                ))}
              </SelectField>
            </div>
            <Button type="button" disabled={!rutaElegida} loading={asignar.isPending} onClick={() => asignar.mutate()}>
              Asignar
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">
          Los envíos de la ruta pasan a este repartidor. No se puede reasignar una ruta con envíos ya en reparto.
        </p>
      </Card>
        </div>
      </div>
    </div>
  );
}
