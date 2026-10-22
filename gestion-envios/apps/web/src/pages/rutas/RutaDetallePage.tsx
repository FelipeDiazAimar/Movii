import { useState } from "react";
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

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link to="/rutas" className="text-sm text-movii-600 hover:underline">
          ← Volver a rutas
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{ruta.nombre || "(sin nombre)"}</h1>
          <EstadoRutaBadge estado={ruta.estado} />
          <Link to={`/rutas/${rutaId}/mapa`} className="text-sm text-movii-600 hover:underline">
            Ver en mapa
          </Link>
        </div>
      </div>

      <Card>
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
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Zona</dt>
                <dd className="text-gray-900">{ruta.zona || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Fecha</dt>
                <dd className="text-gray-900">{ruta.fecha}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Repartidor</dt>
                <dd className="break-all text-gray-900">{ruta.repartidor_id}</dd>
              </div>
            </dl>
            {esPlanificada && (
              <Button variant="secondary" onClick={() => setEditando(true)}>
                Editar
              </Button>
            )}
          </div>
        )}
        {!esPlanificada && !editando && (
          <p className="mt-3 text-xs text-gray-500">
            La ruta ya no está planificada: no se puede editar ni reasignar envíos.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Envíos asignados</p>
          <p className="text-2xl font-semibold text-gray-900">{ruta.cantidad_envios}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Peso total</p>
          <p className="text-2xl font-semibold text-gray-900">{ruta.peso_total} kg</p>
        </Card>
      </div>

      <Card>
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
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Código de guía</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Peso</th>
                {esPlanificada && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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
                      <Button
                        type="button"
                        variant="ghost"
                        loading={desasignarMutation.isPending && desasignarMutation.variables === envio.id}
                        onClick={() => desasignarMutation.mutate(envio.id)}
                      >
                        Desasignar
                      </Button>
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
  );
}
