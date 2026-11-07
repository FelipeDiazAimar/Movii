import { useState } from "react";
import { VehiculoRutaCard } from "@/features/flota/VehiculoRutaCard";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { obtenerRuta, editarRuta, desasignarEnvio } from "@/features/rutas/api";
import { RutaForm } from "@/features/rutas/RutaForm";
import { AsignarEnviosPanel } from "@/features/rutas/AsignarEnviosPanel";
import type { RutaInput } from "@/features/rutas/types";
import { EstadoRutaBadge, EstadoEnvioBadge } from "@/components/ui/Badge";
import { Card, EmptyState } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/services/api-client";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { Dato } from "@/components/ui/Dato";
import { formatearDia } from "@/utils/fechas";

import { Route } from "lucide-react";
export function RutaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const rutaId = id as string;
  const queryClient = useQueryClient();

  const [editando, setEditando] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const {
    data: ruta,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["rutas", rutaId],
    queryFn: () => obtenerRuta(rutaId),
    enabled: Boolean(rutaId),
  });

  const editarMutation = useMutation({
    mutationFn: (input: RutaInput) => editarRuta(rutaId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rutas", rutaId] }),
        queryClient.invalidateQueries({ queryKey: ["rutas"], exact: false }),
      ]);
      setEditando(false);
    },
    onError: (err) => setErrorEdicion(getApiErrorMessage(err, "No se pudo editar la ruta")),
  });

  const desasignarMutation = useMutation({
    mutationFn: (envioId: string) => desasignarEnvio(rutaId, envioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rutas", rutaId] });
      queryClient.invalidateQueries({ queryKey: ["envios"] });
    },
  });

  if (isLoading) return <Spinner label="Cargando ruta…" />;
  if (isError) return <Alert variant="error">{getApiErrorMessage(error, "No se pudo cargar la ruta")}</Alert>;
  if (!ruta) return null;

  const esPlanificada = ruta.estado === "planificada";
  // Con envíos ya en reparto (o entregados) la API no deja cambiar repartidor ni quitar esos envíos.
  const enReparto = ruta.envios.some((e) => e.estado !== "asignado");

  return (
    <div className={PAGE_WIDE}>
      <PageHeader back={{ to: "/rutas", label: "Volver a rutas" }} title={ruta.nombre || "(sin nombre)"} icon={Route} badge={<EstadoRutaBadge estado={ruta.estado} />} />

      <div className="grid gap-4 lg:grid-cols-4">
      <Card className="lg:col-span-2">
        {editando ? (
          <RutaForm
            valoresIniciales={{
              nombre: ruta.nombre,
              zona: ruta.zona,
              fecha: ruta.fecha,
              repartidor_id: ruta.repartidor_id,
            }}
            onSubmit={async (input) => {
              await editarMutation.mutateAsync(input);
            }}
            enviando={editarMutation.isPending}
            errorServidor={errorEdicion}
            textoBoton="Guardar cambios"
          />
        ) : (
          <div className="flex items-center justify-between">
            <dl className="grid grid-cols-3 gap-4">
              <Dato label="Zona" value={ruta.zona || "—"} />
              <Dato label="Fecha" value={formatearDia(ruta.fecha)} />
              <Dato label="Repartidor" value={ruta.repartidor_nombre ?? ruta.repartidor_id} />
            </dl>
            {esPlanificada && !enReparto && (
              <Button variant="secondary" onClick={() => setEditando(true)}>
                Editar
              </Button>
            )}
          </div>
        )}
        {esPlanificada && enReparto && !editando && (
          <p className="mt-3 text-xs text-gray-500">
            Hay envíos en reparto o ya cerrados: no se puede cambiar el repartidor ni quitar esos envíos.
          </p>
        )}
        {!esPlanificada && !editando && (
          <p className="mt-3 text-xs text-gray-500">
            La ruta ya no está planificada: no se puede editar ni reasignar envíos.
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <p className="text-xs font-medium text-gray-500">Envíos asignados</p>
          <p className="text-2xl font-semibold text-gray-900">{ruta.cantidad_envios}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500">Peso total</p>
          <p className="text-2xl font-semibold text-gray-900">{ruta.peso_total} kg</p>
        </Card>
      </div>
      <VehiculoRutaCard rutaId={ruta.id} fecha={ruta.fecha} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">

      <Card className={asignando && esPlanificada ? "lg:col-span-2" : "lg:col-span-3"}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Envíos de la ruta</h2>
          {esPlanificada && (
            <Button type="button" variant="secondary" onClick={() => setAsignando((v) => !v)}>
              {asignando ? "Cerrar" : "+ Asignar envíos"}
            </Button>
          )}
        </div>

        {ruta.envios.length === 0 ? (
          <EmptyState title="Sin envíos asignados" description="Asigná envíos pendientes desde el botón de arriba." />
        ) : (
          <table className="min-w-full divide-y divide-hormigon-200 text-sm">
            <thead className="bg-hormigon-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-3 py-2">Código de guía</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Peso</th>
                {esPlanificada && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-hormigon-100">
              {ruta.envios.map((envio) => (
                <tr key={envio.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    <Link to={`/envios/${envio.id}`} className="hover:text-movii-600 hover:underline">
                      {envio.codigo_guia}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <EstadoEnvioBadge estado={envio.estado} />
                  </td>
                  <td className="px-3 py-2 text-gray-700">{envio.peso} kg</td>
                  {esPlanificada && (
                    <td className="px-3 py-2 text-right">
                      {envio.estado === "asignado" && (
                      <Button
                        type="button"
                        variant="ghost"
                        loading={desasignarMutation.isPending && desasignarMutation.variables === envio.id}
                        onClick={() => desasignarMutation.mutate(envio.id)}
                      >
                        Desasignar
                      </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {desasignarMutation.isError && (
          <div className="mt-3">
            <Alert variant="error">{getApiErrorMessage(desasignarMutation.error, "No se pudo desasignar el envío")}</Alert>
          </div>
        )}
      </Card>

      {asignando && esPlanificada && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Envíos pendientes</h2>
          <AsignarEnviosPanel rutaId={rutaId} onAsignado={() => setAsignando(false)} />
        </Card>
      )}
      </div>
    </div>
  );
}
