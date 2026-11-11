import { useState } from "react";
import { VehiculoRutaCard } from "@/features/flota/VehiculoRutaCard";
import { listarFlota } from "@/features/flota/api";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { obtenerRuta, editarRuta, desasignarEnvio, eliminarRuta } from "@/features/rutas/api";
import { RutaForm } from "@/features/rutas/RutaForm";
import { AsignarEnviosPanel } from "@/features/rutas/AsignarEnviosPanel";
import type { RutaInput } from "@/features/rutas/types";
import { EstadoRutaBadge, EstadoEnvioBadge } from "@/components/ui/Badge";
import { Card, EmptyState } from "@/components/ui/Card";
import { SkeletonPagina } from "@/components/ui/Skeleton";
import { BotonEliminar } from "@/components/ui/BotonEliminar";
import { BotonIniciarRuta } from "@/features/rutas/BotonIniciarRuta";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/services/api-client";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { Dato } from "@/components/ui/Dato";
import { formatearDia, mananaISO } from "@/utils/fechas";
import { obtenerMapaRuta } from "@/features/analitica/api";
import { reprogramarEnvio } from "@/features/envios/api";

import { Route } from "lucide-react";
import { BotonAbrirMaps } from "@/features/mapas/BotonAbrirMaps";
export function RutaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const rutaId = id as string;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
  // El detalle de ruta trae los envíos sin destinatario; el mapa de la ruta sí lo trae
  // (y ya se pide en esta pantalla para "Abrir en Maps": misma query, sin pedido extra).
  const mapa = useQuery({
    queryKey: ["rutas", rutaId, "mapa"],
    queryFn: () => obtenerMapaRuta(rutaId),
    enabled: Boolean(rutaId),
  });
  const paradaPorEnvio = new Map((mapa.data?.paradas ?? []).map((p) => [p.envio_id, p]));

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

  const flota = useQuery({
    queryKey: ["operaciones", "flota", "fecha", ruta?.fecha],
    queryFn: () => listarFlota(ruta?.fecha),
    enabled: Boolean(ruta?.fecha),
  });
  const vehiculoDeRuta = flota.data?.find((v) => v.ruta_id === rutaId);

  const reprogramarMutation = useMutation({
    mutationFn: (envioId: string) => reprogramarEnvio(envioId, { nueva_fecha: mananaISO(), franja: "manana" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rutas"] });
      queryClient.invalidateQueries({ queryKey: ["envios"] });
    },
  });

  if (isLoading) return <SkeletonPagina label="Cargando ruta…" />;
  if (isError) return <Alert variant="error">{getApiErrorMessage(error, "No se pudo cargar la ruta")}</Alert>;
  if (!ruta) return null;

  const esPlanificada = ruta.estado === "planificada";
  // Con envíos ya en reparto (o entregados) la API no deja cambiar repartidor ni quitar esos envíos.
  const enReparto = ruta.envios.some((e) => e.estado !== "asignado");
  const entregados = ruta.envios.filter((e) => e.estado === "entregado").length;
  const fallidos = ruta.envios.filter((e) => e.estado === "no_entregado").length;

  return (
    <div className={PAGE_WIDE}>
      <PageHeader back={{ to: "/rutas", label: "Volver a rutas" }} title={ruta.nombre || "(sin nombre)"} icon={Route} badge={<EstadoRutaBadge estado={ruta.estado} />} action={<div className="flex items-center gap-2"><BotonIniciarRuta rutaId={rutaId} estado={ruta.estado} asignados={ruta.envios.filter((e) => e.estado === "asignado").length} /><BotonEliminar nombre={ruta.nombre || "(sin nombre)"} eliminar={() => eliminarRuta(rutaId)} invalidar={[["rutas"], ["envios"]]} onEliminado={() => navigate("/rutas")} /></div>} />

      {ruta.estado === "completada" && (
        <Alert variant={fallidos > 0 ? "info" : "success"}>
          Ruta completada: {entregados} entregado(s)
          {fallidos > 0 ? ` y ${fallidos} sin entregar. Podés reprogramar los fallidos para mañana con un clic desde la tabla.` : "."}
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-sm font-semibold">
          <Link to={`/rutas/${rutaId}/mapa`} className="rounded-xl border border-hormigon-300 bg-white px-3 py-2 hover:bg-hormigon-50">Mapa 2D</Link>
          <Link to={`/rutas/${rutaId}/3d`} className="rounded-xl border border-hormigon-300 bg-white px-3 py-2 hover:bg-hormigon-50">Vista 3D</Link>
        </div>
        <BotonAbrirMaps rutaId={rutaId} />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
      <Card className="lg:col-span-2">
        {editando ? (
          <RutaForm
            valoresIniciales={{
              nombre: ruta.nombre,
              zona: ruta.zona,
              repartidor_id: ruta.repartidor_id,
              fecha: ruta.fecha,
            }}
            rutaId={ruta.id}
            onSubmit={async (input) => {
              await editarMutation.mutateAsync(input);
            }}
            enviando={editarMutation.isPending}
            errorServidor={errorEdicion}
            textoBoton="Guardar cambios"
          />
        ) : (
          <div className="flex items-center justify-between">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Dato label="Fecha" value={formatearDia(ruta.fecha)} />
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
      <VehiculoRutaCard rutaId={ruta.id} fecha={ruta.fecha} pesoRuta={ruta.peso_total} />
      </div>

      <div className={asignando && esPlanificada ? "grid gap-4 lg:grid-cols-5" : "grid gap-4 lg:grid-cols-3"}>

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
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hormigon-200 text-sm">
            <thead className="bg-hormigon-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-3 py-2">Código de guía</th>
                <th className="px-3 py-2">Destinatario</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Peso</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hormigon-100">
              {ruta.envios.map((envio) => {
                const parada = paradaPorEnvio.get(envio.id);
                return (
                <tr key={envio.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    <Link to={`/envios/${envio.id}`} className="text-movii-700 underline-offset-2 hover:text-movii-600 hover:underline">
                      {envio.codigo_guia}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {parada ? (
                      <>
                        <span className="block font-medium text-gray-900">{parada.destinatario_nombre}</span>
                        <span className="block text-xs text-gray-500">
                          {parada.direccion}
                          {parada.localidad ? `, ${parada.localidad}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <EstadoEnvioBadge estado={envio.estado} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-700">{envio.peso} kg</td>
                  <td className="px-3 py-2 text-right">
                    {envio.estado === "no_entregado" && (
                      <Button
                        type="button"
                        variant="secondary"
                        loading={reprogramarMutation.isPending && reprogramarMutation.variables === envio.id}
                        onClick={() => reprogramarMutation.mutate(envio.id)}
                      >
                        Reprogramar para mañana
                      </Button>
                    )}
                    {esPlanificada && (
                      <>
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
                      </>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}

        {reprogramarMutation.isError && (
          <div className="mt-3">
            <Alert variant="error">{getApiErrorMessage(reprogramarMutation.error, "No se pudo reprogramar el envío")}</Alert>
          </div>
        )}
        {desasignarMutation.isError && (
          <div className="mt-3">
            <Alert variant="error">{getApiErrorMessage(desasignarMutation.error, "No se pudo desasignar el envío")}</Alert>
          </div>
        )}
      </Card>

      {asignando && esPlanificada && (
        <Card className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Envíos pendientes</h2>
          <AsignarEnviosPanel rutaId={rutaId} onAsignado={() => setAsignando(false)} fechaRuta={ruta.fecha} pesoActual={ruta.peso_total} capacidad={vehiculoDeRuta?.capacidad_peso ?? 0} />
        </Card>
      )}
      </div>
    </div>
  );
}
