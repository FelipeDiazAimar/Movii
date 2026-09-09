import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { obtenerEnvio } from "@/features/envios/api";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { getApiErrorMessage } from "@/services/api-client";

function Dato({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}

export function EnvioDetallePage() {
  const { id } = useParams<{ id: string }>();

  const { data: envio, isLoading, isError, error } = useQuery({
    queryKey: ["envios", id],
    queryFn: () => obtenerEnvio(id as string),
    enabled: Boolean(id),
  });

  if (isLoading) return <Spinner label="Cargando envío…" />;
  if (isError) return <Alert variant="error">{getApiErrorMessage(error, "No se pudo cargar el envío")}</Alert>;
  if (!envio) return null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link to="/envios" className="text-sm text-movii-600 hover:underline">
          ← Volver a envíos
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{envio.codigo_guia}</h1>
          <EstadoEnvioBadge estado={envio.estado} />
        </div>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Destinatario</h2>
        <dl className="grid grid-cols-2 gap-4">
          <Dato label="Nombre" value={envio.destinatario.nombre} />
          <Dato label="Teléfono" value={envio.destinatario.telefono || "—"} />
          <Dato
            label="Dirección"
            value={`${envio.destinatario.calle} ${envio.destinatario.numero}${
              envio.destinatario.piso_depto ? ", " + envio.destinatario.piso_depto : ""
            }`}
          />
          <Dato label="Localidad" value={`${envio.destinatario.localidad} (${envio.destinatario.codigo_postal || "s/CP"})`} />
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Paquete</h2>
        <dl className="grid grid-cols-2 gap-4">
          <Dato label="Peso" value={`${envio.peso} kg`} />
          <Dato label="Tamaño" value={envio.tamano} />
          <Dato label="Contenido" value={envio.tipo_contenido || "—"} />
          <Dato label="Frágil / Urgente" value={`${envio.fragil ? "Sí" : "No"} / ${envio.urgente ? "Sí" : "No"}`} />
          <Dato label="Fecha de alta" value={envio.fecha_creacion} />
          <Dato
            label="Ruta"
            value={
              envio.ruta_id ? (
                <Link to={`/rutas/${envio.ruta_id}`} className="text-movii-600 hover:underline">
                  Ver ruta asignada
                </Link>
              ) : (
                "Sin asignar"
              )
            }
          />
        </dl>
      </Card>
    </div>
  );
}
