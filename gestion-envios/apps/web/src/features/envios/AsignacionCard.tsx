import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rutasSugeridas, asignarEnvios } from "@/features/rutas/api";
import { Card } from "@/components/ui/Card";
import { Dato } from "@/components/ui/Dato";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { getApiErrorMessage } from "@/services/api-client";
import { formatearDia } from "@/utils/fechas";
import type { EnvioDetalle } from "@/features/envios/types";
import type { RutaSugerida } from "@/features/rutas/types";

function Chip({ tono, children }: { tono: "ok" | "warn" | "mal" | "neutro"; children: React.ReactNode }) {
  const c = {
    ok: "border-green-200 bg-green-50 text-green-700",
    warn: "border-yellow-200 bg-yellow-50 text-yellow-800",
    mal: "border-red-200 bg-red-50 text-red-700",
    neutro: "border-gray-200 bg-gray-50 text-gray-600",
  }[tono];
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${c}`}>{children}</span>;
}

function OpcionRuta({ r, elegida, onElegir }: { r: RutaSugerida; elegida: boolean; onElegir: () => void }) {
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={elegida}
      className={`flex w-full flex-col gap-1 rounded-xl border px-3 py-2 text-left transition ${elegida ? "border-movii-500 bg-movii-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
    >
      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
        {r.nombre}
        {r.recomendada && <Chip tono="ok">Recomendada</Chip>}
      </span>
      <span className="text-xs text-gray-600">
        {r.repartidor_nombre} · {formatearDia(r.fecha)}
        {r.zona ? ` · ${r.zona}` : ""}
      </span>
      <span className="flex flex-wrap gap-1.5">
        {r.distancia_km !== null && <Chip tono={r.distancia_km <= 2 ? "ok" : r.distancia_km <= 5 ? "warn" : "mal"}>{r.distancia_km} km</Chip>}
        <Chip tono={r.misma_fecha ? "ok" : "warn"}>{r.misma_fecha ? "Misma fecha" : "Otra fecha"}</Chip>
        <Chip tono={r.cabe ? "neutro" : "mal"}>
          {r.vehiculo ? `${r.vehiculo} · ${r.peso_actual}/${r.capacidad_peso} kg${r.cabe ? "" : " (no entra)"}` : "Sin vehículo"}
        </Chip>
        <Chip tono="neutro">{r.paradas} parada{r.paradas === 1 ? "" : "s"}</Chip>
      </span>
    </button>
  );
}

/**
 * Asignación del envío: envío → ruta → repartidor. El repartidor no se asigna
 * directo: lo define la ruta. Las rutas se listan ordenadas por fecha, capacidad
 * del vehículo y cercanía del destino a sus paradas.
 */
export function AsignacionCard({ envio }: { envio: EnvioDetalle }) {
  const queryClient = useQueryClient();
  const [rutaId, setRutaId] = useState("");
  const [igual, setIgual] = useState(false);
  const puedeAsignar = envio.estado === "pendiente" && !envio.ruta_id;

  const { data: sugeridas = [] } = useQuery({
    queryKey: ["rutas", "sugeridas", envio.id],
    queryFn: () => rutasSugeridas(envio.id),
    enabled: puedeAsignar,
  });
  const rutaElegida = sugeridas.find((r) => r.ruta_id === rutaId);

  const asignar = useMutation({
    mutationFn: () => asignarEnvios(rutaId, [envio.id], igual),
    onSuccess: async () => {
      setRutaId("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["envios"] }),
        queryClient.invalidateQueries({ queryKey: ["rutas"] }),
      ]);
    },
  });

  // 409: la API pide confirmar (no conviene por distancia o se pasa de capacidad).
  const conflicto = axios.isAxiosError(asignar.error) && asignar.error.response?.status === 409;
  const pideForzar = Boolean(rutaElegida && !rutaElegida.cabe) || conflicto;

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
          {sugeridas.length === 0 ? (
            <p className="text-sm text-gray-500">No hay rutas planificadas. Creá una desde Rutas.</p>
          ) : (
            <>
              <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                {sugeridas.map((r) => (
                  <li key={r.ruta_id}>
                    <OpcionRuta r={r} elegida={rutaId === r.ruta_id} onElegir={() => { setRutaId(r.ruta_id); setIgual(false); }} />
                  </li>
                ))}
              </ul>
              {rutaElegida && (!rutaElegida.misma_fecha || !rutaElegida.cabe) && (
                <Alert variant="info">
                  {!rutaElegida.misma_fecha && `La entrega es el ${formatearDia(envio.fecha_entrega)} y la ruta es del ${formatearDia(rutaElegida.fecha)}. `}
                  {!rutaElegida.cabe && "El envío no entra en el vehículo de esa ruta."}
                </Alert>
              )}
              {pideForzar && (
                <label className="flex items-center gap-2 text-sm text-red-700">
                  <input type="checkbox" checked={igual} onChange={(e) => setIgual(e.target.checked)} />
                  Asignar igual (la API advierte que no conviene o se pasa de la capacidad)
                </label>
              )}
              <div>
                <Button type="button" disabled={!rutaId || (pideForzar && !igual)} loading={asignar.isPending} onClick={() => asignar.mutate()}>
                  Asignar a ruta
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
