import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { obtenerEnvio } from "@/features/envios/api";
import { AccionesEnvio } from "@/features/envios/AccionesEnvio";
import { HistorialTimeline } from "@/features/envios/HistorialTimeline";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { apiClient, getApiErrorMessage } from "@/services/api-client";

const FRANJA_LABELS: Record<string, string> = {
  manana: "mañana",
  tarde: "tarde",
  noche: "noche",
};

/**
 * Evidencia de entrega (HU-08, solo vista): los binarios exigen auth,
 * así que se descargan con apiClient (responseType blob) y se muestran
 * en <img> vía objectURL. Las URLs se liberan al desmontar.
 */
function EvidenciaEntrega({ firmaUrl, fotoUrl }: { firmaUrl: string; fotoUrl: string }) {
  const [firmaSrc, setFirmaSrc] = useState<string | null>(null);
  const [fotoSrc, setFotoSrc] = useState<string | null>(null);
  const [cargando, setCargando] = useState<"firma" | "foto" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (firmaSrc) URL.revokeObjectURL(firmaSrc);
      if (fotoSrc) URL.revokeObjectURL(fotoSrc);
    };
  }, [firmaSrc, fotoSrc]);

  async function ver(tipo: "firma" | "foto") {
    if (tipo === "firma" && firmaSrc) {
      URL.revokeObjectURL(firmaSrc);
      setFirmaSrc(null);
      return;
    }
    if (tipo === "foto" && fotoSrc) {
      URL.revokeObjectURL(fotoSrc);
      setFotoSrc(null);
      return;
    }
    setCargando(tipo);
    setError(null);
    try {
      const { data } = await apiClient.get<Blob>(tipo === "firma" ? firmaUrl : fotoUrl, {
        responseType: "blob",
      });
      const objectUrl = URL.createObjectURL(data);
      if (tipo === "firma") setFirmaSrc(objectUrl);
      else setFotoSrc(objectUrl);
    } catch (e) {
      setError(getApiErrorMessage(e, "No se pudo cargar la imagen"));
    } finally {
      setCargando(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button variant="secondary" loading={cargando === "firma"} onClick={() => void ver("firma")}>
          {firmaSrc ? "Ocultar firma" : "Ver firma"}
        </Button>
        <Button variant="secondary" loading={cargando === "foto"} onClick={() => void ver("foto")}>
          {fotoSrc ? "Ocultar foto" : "Ver foto"}
        </Button>
      </div>
      {firmaSrc && (
        <figure className="flex flex-col gap-1">
          <figcaption className="text-xs font-medium uppercase tracking-wide text-gray-500">Firma</figcaption>
          <img src={firmaSrc} alt="Firma de recepción" className="max-w-full rounded border border-gray-200" />
        </figure>
      )}
      {fotoSrc && (
        <figure className="flex flex-col gap-1">
          <figcaption className="text-xs font-medium uppercase tracking-wide text-gray-500">Foto</figcaption>
          <img src={fotoSrc} alt="Foto de entrega" className="max-w-full rounded border border-gray-200" />
        </figure>
      )}
    </div>
  );
}

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

      {envio.reprogramado_para && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Reprogramación</h2>
          <dl>
            <Dato
              label="Nuevo compromiso"
              value={`Comprometido para ${envio.reprogramado_para} (${FRANJA_LABELS[envio.franja ?? ""] ?? envio.franja ?? "—"})`}
            />
          </dl>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Acciones</h2>
        <AccionesEnvio envioId={envio.id} estado={envio.estado} />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Historial</h2>
        <HistorialTimeline eventos={envio.historial} />
      </Card>

      {envio.confirmacion && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Evidencia de entrega</h2>
          <dl className="mb-3 grid grid-cols-2 gap-4">
            <Dato label="Recibido por" value={envio.confirmacion.receptor_nombre} />
            <Dato label="Relación" value={envio.confirmacion.receptor_relacion} />
            <Dato label="Confirmada" value={envio.confirmacion.confirmada_at} />
          </dl>
          <EvidenciaEntrega firmaUrl={envio.confirmacion.firma_url} fotoUrl={envio.confirmacion.foto_url} />
        </Card>
      )}
    </div>
  );
}
