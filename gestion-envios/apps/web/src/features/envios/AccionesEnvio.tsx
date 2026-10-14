import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cambiarEstado, registrarIncidencia, reprogramarEnvio } from "./api";
import { incidenciaSchema, reprogramacionSchema } from "./schema";
import { motivoLegible } from "./HistorialTimeline";
import { FRANJAS, MOTIVOS_FALLO, type EstadoEnvio } from "./types";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, InputField, SelectField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { getApiErrorMessage } from "@/services/api-client";

/**
 * Acciones de seguimiento del detalle (HU-06/07/09). Solo vista en HU-08:
 * la confirmación de entrega es del móvil y no tiene formulario en web.
 *
 * Visibilidad por estado (igual que el móvil):
 * - asignado → "Iniciar reparto" (→en_camino) + incidencia
 * - en_camino → "Volver a asignado" + incidencia
 * - no_entregado → reprogramar
 * - entregado / pendiente → sin acciones (nota informativa)
 */

export type AccionEnvio = "iniciar-reparto" | "volver-asignado" | "incidencia" | "reprogramar";

export function accionesDisponibles(estado: EstadoEnvio): AccionEnvio[] {
  if (estado === "asignado") return ["iniciar-reparto", "incidencia"];
  if (estado === "en_camino") return ["volver-asignado", "incidencia"];
  if (estado === "no_entregado") return ["reprogramar"];
  return [];
}

export function notaSinAcciones(estado: EstadoEnvio): string | null {
  if (estado === "entregado") return "Este envío ya fue entregado y no admite más acciones.";
  if (estado === "pendiente") return "Este envío todavía no fue asignado a una ruta, por eso no admite acciones de seguimiento.";
  return null;
}

/**
 * Quita el prefijo `data:image/...;base64,` que agrega FileReader: la API
 * espera el base64 puro en `foto_base64`.
 */
export function extraerBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/\w+;base64,/, "");
}

function erroresDeValidacion(error: { issues: { path: (string | number)[]; message: string }[] }): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const issue of error.issues) {
    errores[String(issue.path[0])] = issue.message;
  }
  return errores;
}

async function invalidarEnvio(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["envios", id] }),
    queryClient.invalidateQueries({ queryKey: ["envios"] }),
  ]);
}

/** HU-06: botones asignado ⇄ en_camino. */
export function CambiarEstadoButtons({ envioId, estado }: { envioId: string; estado: "asignado" | "en_camino" }) {
  const queryClient = useQueryClient();
  const [exito, setExito] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (nuevo: "asignado" | "en_camino") => cambiarEstado(envioId, { estado: nuevo }),
    onSuccess: async (_, nuevo) => {
      setExito(nuevo === "en_camino" ? "Reparto iniciado: el envío está en camino." : "El envío volvió a asignado.");
      await invalidarEnvio(queryClient, envioId);
    },
  });

  return (
    <div className="flex flex-col gap-2">
      {exito && <Alert variant="success">{exito}</Alert>}
      {mutation.isError && <Alert variant="error">{getApiErrorMessage(mutation.error, "No se pudo cambiar el estado")}</Alert>}
      {estado === "asignado" ? (
        <div>
          <Button type="button" loading={mutation.isPending} onClick={() => { setExito(null); mutation.mutate("en_camino"); }}>
            Iniciar reparto
          </Button>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            variant="secondary"
            loading={mutation.isPending}
            onClick={() => { setExito(null); mutation.mutate("asignado"); }}
          >
            Volver a asignado
          </Button>
        </div>
      )}
    </div>
  );
}

/** HU-07: registrar incidencia (motivo + comentario + foto opcional). Colapsable: al éxito muestra el mensaje y se cierra. */
export function IncidenciaForm({ envioId }: { envioId: string }) {
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_FALLO[0]);
  const [comentario, setComentario] = useState("");
  const [fotoBase64, setFotoBase64] = useState<string | undefined>(undefined);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [exito, setExito] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { motivo: string; comentario?: string; foto_base64?: string }) => registrarIncidencia(envioId, input),
    onSuccess: async () => {
      await invalidarEnvio(queryClient, envioId);
      setAbierto(false);
      setMotivo(MOTIVOS_FALLO[0]);
      setComentario("");
      setFotoBase64(undefined);
      setNombreArchivo(null);
      setErrores({});
      setExito("Incidencia registrada.");
    },
  });

  function onArchivoElegido(archivo: File | undefined) {
    setNombreArchivo(archivo?.name ?? null);
    if (!archivo) {
      setFotoBase64(undefined);
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      setFotoBase64(extraerBase64(String(lector.result ?? "")));
    };
    lector.onerror = () => {
      setErrores((prev) => ({ ...prev, foto: "No se pudo leer la imagen elegida" }));
    };
    lector.readAsDataURL(archivo);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const resultado = incidenciaSchema.safeParse({
      motivo,
      comentario,
      ...(fotoBase64 !== undefined ? { foto_base64: fotoBase64 } : {}),
    });
    if (!resultado.success) {
      setErrores(erroresDeValidacion(resultado.error));
      return;
    }
    setErrores({});
    setExito(null);
    const v = resultado.data;
    mutation.mutate({
      motivo: v.motivo,
      ...(v.comentario ? { comentario: v.comentario } : {}),
      ...(v.foto_base64 ? { foto_base64: v.foto_base64 } : {}),
    });
  }

  if (!abierto) {
    return (
      <div className="flex flex-col gap-2">
        {exito && <Alert variant="success">{exito}</Alert>}
        <div>
          <Button type="button" variant="secondary" onClick={() => { setAbierto(true); setExito(null); }}>
            Registrar incidencia
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      {mutation.isError && <Alert variant="error">{getApiErrorMessage(mutation.error, "No se pudo registrar la incidencia")}</Alert>}
      <SelectField label="Motivo *" name="motivo" required value={motivo} onChange={(e) => setMotivo(e.target.value)} error={errores.motivo}>
        {MOTIVOS_FALLO.map((m) => (
          <option key={m} value={m}>
            {motivoLegible(m)}
          </option>
        ))}
      </SelectField>
      <InputField
        label="Comentario"
        name="comentario"
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        error={errores.comentario}
        hint='Obligatorio cuando el motivo es "otro motivo"'
      />
      <FieldWrapper label="Foto (opcional)" htmlFor="incidencia-foto" error={errores.foto} hint={nombreArchivo ?? "Solo imágenes"}>
        <input
          id="incidencia-foto"
          name="foto"
          type="file"
          accept="image/*"
          onChange={(e) => onArchivoElegido(e.target.files?.[0])}
          className="text-sm text-gray-700"
        />
      </FieldWrapper>
      <div className="flex gap-2">
        <Button type="submit" loading={mutation.isPending}>
          Guardar incidencia
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setAbierto(false); setErrores({}); }}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

const FRANJA_LABELS: Record<string, string> = {
  manana: "mañana",
  tarde: "tarde",
  noche: "noche",
};

/** HU-09: reprogramar entrega (fecha + franja). Colapsable: al éxito muestra el mensaje y se cierra. */
export function ReprogramarForm({ envioId }: { envioId: string }) {
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [franja, setFranja] = useState<string>(FRANJAS[0]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [exito, setExito] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { nueva_fecha: string; franja: "manana" | "tarde" | "noche" }) => reprogramarEnvio(envioId, input),
    onSuccess: async () => {
      await invalidarEnvio(queryClient, envioId);
      setAbierto(false);
      setNuevaFecha("");
      setFranja(FRANJAS[0]);
      setErrores({});
      setExito("Entrega reprogramada.");
    },
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const resultado = reprogramacionSchema.safeParse({ nueva_fecha: nuevaFecha, franja });
    if (!resultado.success) {
      setErrores(erroresDeValidacion(resultado.error));
      return;
    }
    setErrores({});
    setExito(null);
    mutation.mutate(resultado.data);
  }

  if (!abierto) {
    return (
      <div className="flex flex-col gap-2">
        {exito && <Alert variant="success">{exito}</Alert>}
        <div>
          <Button type="button" onClick={() => { setAbierto(true); setExito(null); }}>
            Reprogramar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      {mutation.isError && <Alert variant="error">{getApiErrorMessage(mutation.error, "No se pudo reprogramar la entrega")}</Alert>}
      <InputField
        label="Nueva fecha *"
        name="nueva_fecha"
        type="date"
        required
        value={nuevaFecha}
        onChange={(e) => setNuevaFecha(e.target.value)}
        error={errores.nueva_fecha}
      />
      <SelectField label="Franja *" name="franja" required value={franja} onChange={(e) => setFranja(e.target.value)} error={errores.franja}>
        {FRANJAS.map((f) => (
          <option key={f} value={f}>
            {FRANJA_LABELS[f]}
          </option>
        ))}
      </SelectField>
      <div className="flex gap-2">
        <Button type="submit" loading={mutation.isPending}>
          Guardar reprogramación
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setAbierto(false); setErrores({}); }}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Agrupa las acciones visibles según el estado del envío. */
export function AccionesEnvio({ envioId, estado }: { envioId: string; estado: EstadoEnvio }) {
  const acciones = accionesDisponibles(estado);
  const nota = notaSinAcciones(estado);

  if (acciones.length === 0) {
    return <p className="text-sm text-gray-500">{nota}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {acciones.includes("iniciar-reparto") && <CambiarEstadoButtons envioId={envioId} estado="asignado" />}
      {acciones.includes("volver-asignado") && <CambiarEstadoButtons envioId={envioId} estado="en_camino" />}
      {acciones.includes("incidencia") && <IncidenciaForm envioId={envioId} />}
      {acciones.includes("reprogramar") && <ReprogramarForm envioId={envioId} />}
    </div>
  );
}
