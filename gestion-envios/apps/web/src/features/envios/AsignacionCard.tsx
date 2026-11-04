import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listarRutas, asignarEnvios } from "@/features/rutas/api";
import { Card } from "@/components/ui/Card";
import { Dato } from "@/components/ui/Dato";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { SelectField } from "@/components/ui/Field";
import { formatearDia } from "@/utils/fechas";
import { getApiErrorMessage } from "@/services/api-client";
import type { EnvioDetalle } from "@/features/envios/types";

/**
 * Asignación del envío: envío → ruta → repartidor. El repartidor no se asigna
 * directo: lo define la ruta. Si el envío está pendiente se lo puede asignar acá.
 */
export function AsignacionCard({ envio }: { envio: EnvioDetalle }) {
  const queryClient = useQueryClient();
  const [rutaId, setRutaId] = useState("");
  const puedeAsignar = envio.estado === "pendiente" && !envio.ruta_id;

  const { data: rutas } = useQuery({
    queryKey: ["rutas", { fecha: undefined }],
    queryFn: () => listarRutas({}),
    enabled: puedeAsignar,
  });
  const planificadas = (rutas ?? []).filter((r) => r.estado === "planificada");

  const asignar = useMutation({
    mutationFn: () => asignarEnvios(rutaId, [envio.id]),
    onSuccess: async () => {
      setRutaId("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["envios"] }),
        queryClient.invalidateQueries({ queryKey: ["rutas"] }),
      ]);
    },
  });

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Asignación</h2>
      <dl className="grid grid-cols-2 gap-4">
        <Dato
          label="Ruta"
          value={
            envio.ruta_id ? (
              <Link to={`/rutas/${envio.ruta_id}`} className="text-movii-600 hover:underline">
                {envio.ruta_nombre || "Ver ruta"}
              </Link>
            ) : (
              "Sin ruta"
            )
          }
        />
        <Dato label="Repartidor" value={envio.repartidor_nombre || "Sin repartidor"} />
      </dl>

      {puedeAsignar && (
        <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500">El repartidor lo define la ruta: elegí una ruta planificada y el envío queda a cargo de su repartidor.</p>
          {asignar.isError && <Alert variant="error">{getApiErrorMessage(asignar.error, "No se pudo asignar el envío")}</Alert>}
          {planificadas.length === 0 ? (
            <p className="text-sm text-gray-500">No hay rutas planificadas. Creá una desde Rutas.</p>
          ) : (
            <div className="flex items-end gap-3">
              <div className="w-72">
                <SelectField label="Ruta" value={rutaId} onChange={(e) => setRutaId(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {planificadas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} · {formatearDia(r.fecha)} · {r.repartidor_nombre ?? "sin repartidor"}
                    </option>
                  ))}
                </SelectField>
              </div>
              <Button type="button" disabled={!rutaId} loading={asignar.isPending} onClick={() => asignar.mutate()}>
                Asignar a ruta
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
