import { useEffect, useState } from "react";
import type { EventoEnvio, TrackingEvento } from "./types";
import { descargarFotoIncidencia } from "./api";
import { getApiErrorMessage } from "@/services/api-client";
import { EmptyState } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/**
 * Textos legibles del historial. Espejan `describirEvento` /
 * `motivoLegible` del backend (services/api/internal/services/
 * tracking_service.go): anterior==null es el evento raíz.
 */
export function motivoLegible(motivo: string): string {
  switch (motivo) {
    case "cliente_ausente":
      return "cliente ausente";
    case "direccion_incorrecta":
      return "dirección incorrecta";
    case "rechazado":
      return "rechazado por el destinatario";
    case "zona_insegura":
      return "zona insegura";
    case "otro":
      return "otro motivo";
    default:
      return motivo;
  }
}

export function descripcionEvento(evento: EventoEnvio): string {
  if (evento.estado_anterior === null) {
    return "Envío registrado";
  }
  switch (evento.estado_nuevo) {
    case "asignado":
      return "Asignado a ruta de reparto";
    case "en_camino":
      return "En camino";
    case "entregado":
      return "Entregado";
    case "no_entregado":
      if (evento.motivo === null) {
        return "No se pudo entregar: motivo no especificado";
      }
      return `No se pudo entregar: ${motivoLegible(evento.motivo)}`;
    case "pendiente":
      if (evento.estado_anterior === "no_entregado") {
        return "Reprogramado para un nuevo intento";
      }
      if (evento.estado_anterior === "asignado") {
        return "Desasignado de la ruta de reparto";
      }
      return "Actualización de estado";
    default:
      return "Actualización de estado";
  }
}

/**
 * Color semántico del punto del timeline por estado (misma paleta que
 * `EstadoEnvioBadge`: verde = entregado, azul = asignado, amarillo =
 * en camino, rojo = no entregado, gris = resto).
 */
export function dotClassForEstado(estado: string): string {
  switch (estado) {
    case "entregado":
      return "bg-green-500";
    case "asignado":
      return "bg-blue-500";
    case "en_camino":
      return "bg-amber-500";
    case "no_entregado":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

function dotClassForDescripcion(descripcion: string): string {
  if (descripcion.startsWith("Entregado")) return dotClassForEstado("entregado");
  if (descripcion.startsWith("No se pudo entregar")) return dotClassForEstado("no_entregado");
  if (descripcion.startsWith("En camino")) return dotClassForEstado("en_camino");
  if (descripcion.startsWith("Asignado")) return dotClassForEstado("asignado");
  return dotClassForEstado("pendiente");
}

export function formatearFecha(fecha: string): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleString("es-UY", { dateStyle: "medium", timeStyle: "short" });
}

function esTrackingEvento(e: EventoEnvio | TrackingEvento): e is TrackingEvento {
  return "descripcion" in e;
}

/**
 * Foto de una incidencia (HU-07, solo vista): el binario exige auth,
 * así que se descarga con apiClient (responseType blob) y se muestra
 * en <img> vía objectURL. La URL se libera al ocultar o desmontar.
 * Mismo patrón que `EvidenciaEntrega` de HU-08 (EnvioDetallePage).
 */
function FotoIncidencia({ envioId, eventoId }: { envioId: string; eventoId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  async function ver() {
    if (src) {
      URL.revokeObjectURL(src);
      setSrc(null);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const blob = await descargarFotoIncidencia(envioId, eventoId);
      setSrc(URL.createObjectURL(blob));
    } catch (e) {
      setError(getApiErrorMessage(e, "No se pudo cargar la foto"));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {error && <Alert variant="error">{error}</Alert>}
      <div>
        <Button variant="secondary" loading={cargando} onClick={() => void ver()}>
          {src ? "Ocultar foto" : "Ver foto"}
        </Button>
      </div>
      {src && <img src={src} alt="Foto de incidencia" className="max-w-full rounded border border-gray-200" />}
    </div>
  );
}

/**
 * Timeline compartido entre el detalle (EventoEnvio) y el tracking
 * público (TrackingEvento). Vacío → EmptyState, no lista muda.
 * `envioId` solo se pasa en el detalle: habilita el botón "Ver foto"
 * en incidencias con foto (el tracking no trae ese flag).
 */
export function HistorialTimeline({
  eventos,
  envioId,
}: {
  eventos: (EventoEnvio | TrackingEvento)[];
  envioId?: string;
}) {
  if (eventos.length === 0) {
    return <EmptyState title="Sin movimientos todavía" description="Todavía no hay eventos registrados para este envío." />;
  }

  return (
    <ol className="flex flex-col gap-4">
      {eventos.map((e, i) => {
        if (esTrackingEvento(e)) {
          return (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotClassForDescripcion(e.descripcion)}`} />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-gray-900">{e.descripcion}</p>
                <time className="text-xs text-gray-500">{formatearFecha(e.fecha)}</time>
              </div>
            </li>
          );
        }
        return (
          <li key={i} className="flex gap-3">
            <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotClassForEstado(e.estado_nuevo)}`} />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-gray-900">{descripcionEvento(e)}</p>
              <time className="text-xs text-gray-500">{formatearFecha(e.fecha)}</time>
              {e.actor_nombre && <p className="text-xs text-gray-500">Por {e.actor_nombre}</p>}
              {e.comentario && <p className="text-xs text-gray-600">“{e.comentario}”</p>}
              {e.motivo !== null && e.tiene_foto && envioId && (
                <FotoIncidencia envioId={envioId} eventoId={e.id} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
