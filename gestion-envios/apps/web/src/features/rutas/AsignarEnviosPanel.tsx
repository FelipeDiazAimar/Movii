import { useId, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listarEnvios } from "@/features/envios/api";
import { asignarEnvios, recomendarEnvio } from "./api";
import type { Recomendacion } from "./types";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/services/api-client";
import { formatearDia } from "@/utils/fechas";

/** Estado de la validación de dirección / distancia (T4) de un envío seleccionado. */
export type EstadoReco = { tipo: "cargando" } | { tipo: "ok"; rec: Recomendacion } | { tipo: "invalida" };

const BADGE: Record<string, string> = {
  conviene: "bg-green-50 text-green-700 border-green-200",
  dudoso: "bg-yellow-50 text-yellow-800 border-yellow-200",
  no_conviene: "bg-red-50 text-red-700 border-red-200",
  sin_recomendacion: "bg-gray-50 text-gray-600 border-gray-200",
  invalida: "bg-red-50 text-red-700 border-red-200",
};

function textoReco(e: EstadoReco): { clave: string; texto: string } {
  if (e.tipo === "cargando") return { clave: "sin_recomendacion", texto: "Validando dirección…" };
  if (e.tipo === "invalida") return { clave: "invalida", texto: "Dirección inválida" };
  const { rec } = e;
  // Con la ruta vacía el desvío es 0: no se muestra "+0%" (no dice nada).
  const partes = [rec.extra_km > 0 ? `+${rec.extra_km}km` : "", rec.desvio_pct > 0 ? `+${rec.desvio_pct}%` : ""].filter(Boolean);
  const detalle = partes.length > 0 ? ` (${partes.join(", ")})` : "";
  switch (rec.recomendacion) {
    case "conviene":
      return { clave: "conviene", texto: `Conviene${detalle}` };
    case "dudoso":
      return { clave: "dudoso", texto: `Dudoso${detalle}` };
    case "no_conviene":
      return { clave: "no_conviene", texto: `No conviene (${[...partes, "fuera de zona"].join(", ")})` };
    default:
      return { clave: "sin_recomendacion", texto: "Sin recomendación (se puede asignar)" };
  }
}

/** Badge verde / amarillo / rojo con la recomendación de distancia de un envío. */
export function RecomendacionBadge({ estado }: { estado: EstadoReco }) {
  const { clave, texto } = textoReco(estado);
  return <span className={`inline-block max-w-full rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE[clave]}`}>{texto}</span>;
}

const SIN_RECOMENDACION: EstadoReco = {
  tipo: "ok",
  rec: { extra_km: 0, desvio_pct: 0, recomendacion: "sin_recomendacion", motivo: "" },
};

/** Panel para elegir envíos pendientes y asignarlos a la ruta (HU-04, CA-01/02; T4). */
export function AsignarEnviosPanel({
  rutaId,
  onAsignado,
  fechaRuta,
  pesoActual = 0,
  capacidad = 0,
}: {
  rutaId: string;
  onAsignado: () => void;
  /** Fecha de la ruta: los envíos de otra fecha se marcan y van al final. */
  fechaRuta?: string;
  /** Peso que ya lleva la ruta y capacidad de su vehículo (0 = sin vehículo). */
  pesoActual?: number;
  capacidad?: number;
}) {
  const queryClient = useQueryClient();
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [recos, setRecos] = useState<Record<string, EstadoReco>>({});
  const [asignarIgual, setAsignarIgual] = useState(false);
  const idMotivo = useId();

  const { data: pendientes, isLoading } = useQuery({
    queryKey: ["envios", { estado: "pendiente" }],
    queryFn: () => listarEnvios({ estado: "pendiente" }),
  });

  const mutation = useMutation({
    mutationFn: () => asignarEnvios(rutaId, Array.from(seleccionados), asignarIgual),
    onSuccess: async () => {
      setSeleccionados(new Set());
      setRecos({});
      setAsignarIgual(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rutas", rutaId] }),
        queryClient.invalidateQueries({ queryKey: ["envios"] }),
      ]);
      onAsignado();
    },
  });

  async function validar(id: string) {
    setRecos((prev) => ({ ...prev, [id]: { tipo: "cargando" } }));
    let estado: EstadoReco;
    try {
      estado = { tipo: "ok", rec: await recomendarEnvio(rutaId, id) };
    } catch (e) {
      // Solo el 422 bloquea; cualquier otro fallo es degradado (la API revalida al asignar).
      estado = axios.isAxiosError(e) && e.response?.status === 422 ? { tipo: "invalida" } : SIN_RECOMENDACION;
    }
    setRecos((prev) => ({ ...prev, [id]: estado }));
  }

  function toggle(id: string) {
    if (!seleccionados.has(id)) void validar(id);
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const lista = [...(pendientes ?? [])].sort((a, b) => Number(a.fecha_entrega !== fechaRuta) - Number(b.fecha_entrega !== fechaRuta));
  const pesoSel = lista.filter((e) => seleccionados.has(e.id)).reduce((n, e) => n + e.peso, 0);
  const excede = capacidad > 0 && pesoActual + pesoSel > capacidad;
  const conflicto = mutation.isError && axios.isAxiosError(mutation.error) && mutation.error.response?.status === 409;
  const estados = Array.from(seleccionados).map((id) => recos[id]);
  const hayInvalida = estados.some((e) => e?.tipo === "invalida");
  const validando = estados.some((e) => !e || e.tipo === "cargando");
  const hayRoja = estados.some((e) => e?.tipo === "ok" && e.rec.recomendacion === "no_conviene") || excede || conflicto;

  // Por qué "Asignar" está deshabilitado (si lo está), para no dejar el botón mudo.
  let motivoDeshabilitado: string | null = null;
  if (hayInvalida) motivoDeshabilitado = "Quitá los envíos con dirección inválida para poder asignar.";
  else if (validando) motivoDeshabilitado = "Validando direcciones…";
  else if (hayRoja && !asignarIgual) motivoDeshabilitado = "Hay envíos que no conviene sumar a esta ruta: tildá \"Asignar igual\" para confirmarlos.";
  const deshabilitado = seleccionados.size === 0 || motivoDeshabilitado !== null;

  if (isLoading) return <Spinner label="Cargando envíos pendientes…" />;

  if (!pendientes || pendientes.length === 0) {
    return <EmptyState title="No hay envíos pendientes" description="Todos los envíos ya están asignados a una ruta." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {mutation.isError && <Alert variant="error">{getApiErrorMessage(mutation.error, "No se pudo asignar los envíos")}</Alert>}

      <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {lista.map((envio) => (
          // Código y peso en la primera línea (sin cortarse), destinatario debajo y los avisos al final:
          // así el peso nunca se sale de la tarjeta aunque el panel sea angosto.
          <li key={envio.id} className="flex items-start gap-3 px-3 py-2 text-sm">
            <input
              type="checkbox"
              aria-label={`Seleccionar ${envio.codigo_guia} (${envio.destinatario})`}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-movii-500 focus:ring-movii-400"
              checked={seleccionados.has(envio.id)}
              onChange={() => toggle(envio.id)}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="whitespace-nowrap font-medium text-gray-900">{envio.codigo_guia}</span>
                <span className="shrink-0 whitespace-nowrap text-gray-500">{envio.peso} kg</span>
              </div>
              <span className="truncate text-gray-500" title={envio.direccion}>
                {envio.destinatario}
                {envio.direccion ? ` · ${envio.direccion}` : ""}
              </span>
              {((fechaRuta && envio.fecha_entrega !== fechaRuta) || (seleccionados.has(envio.id) && recos[envio.id])) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {fechaRuta && envio.fecha_entrega !== fechaRuta && (
                    <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs text-yellow-800">Entrega {formatearDia(envio.fecha_entrega)}</span>
                  )}
                  {seleccionados.has(envio.id) && recos[envio.id] && <RecomendacionBadge estado={recos[envio.id]} />}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {capacidad > 0 && (
        <p className={`text-xs ${excede ? "font-semibold text-red-700" : "text-gray-500"}`}>
          Carga del vehículo: {Math.round((pesoActual + pesoSel) * 10) / 10} de {capacidad} kg
          {excede ? " — se pasa de la capacidad" : ""}
        </p>
      )}

      {hayRoja && !hayInvalida && (
        <label className="flex items-center gap-2 text-sm text-red-700">
          <input type="checkbox" checked={asignarIgual} onChange={(e) => setAsignarIgual(e.target.checked)} />
          Asignar igual
        </label>
      )}

      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          disabled={deshabilitado}
          aria-describedby={motivoDeshabilitado ? idMotivo : undefined}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Asignar {seleccionados.size > 0 ? `(${seleccionados.size})` : ""}
        </Button>
        {motivoDeshabilitado && (
          <p id={idMotivo} role="status" className={`text-xs ${hayInvalida || hayRoja ? "text-red-700" : "text-gray-500"}`}>
            {motivoDeshabilitado}
          </p>
        )}
      </div>
    </div>
  );
}
