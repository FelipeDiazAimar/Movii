import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { registrarIncidencia, reprogramarEnvio } from "./api";
import { incidenciaSchema, reprogramacionSchema } from "./schema";
import { motivoLegible } from "./HistorialTimeline";
import { franjaLegible, hoyISO } from "./formato";
import { FRANJAS, MOTIVOS_FALLO, type EstadoEnvio } from "./types";
import { Button } from "@/components/ui/Button";
import { DateField, FieldWrapper, InputField, SelectField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { getApiErrorMessage } from "@/services/api-client";

/**
 * Acciones de seguimiento del detalle (HU-06/07/09). Solo vista en HU-08:
 * la confirmación de entrega es del móvil y no tiene formulario en web.
 *
 * Visibilidad por estado (igual que el móvil):
 * - asignado → sin acciones: sale a reparto cuando se inicia su ruta (nota)
 * - en_camino → incidencia
 * - no_entregado → reprogramar
 * - entregado / pendiente → sin acciones (nota informativa)
 *
 * El "en camino" ya no se marca envío por envío: lo pone "Iniciar ruta" para
 * todos los envíos de la ruta a la vez (el camión sale del depósito con ellos).
 */

export type AccionEnvio = "incidencia" | "reprogramar";

export function accionesDisponibles(estado: EstadoEnvio): AccionEnvio[] {
  if (estado === "en_camino") return ["incidencia"];
  if (estado === "no_entregado") return ["reprogramar"];
  return [];
}

export function notaSinAcciones(estado: EstadoEnvio): string | null {
  if (estado === "entregado") return "Este envío ya fue entregado y no admite más acciones.";
  if (estado === "pendiente") return "Este envío todavía no fue asignado a una ruta, por eso no admite acciones de seguimiento.";
  if (estado === "asignado") return "Todavía está en el depósito: sale a reparto cuando se inicia su ruta.";
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
  const inputFoto = useRef<HTMLInputElement>(null);

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

  function quitarFoto() {
    setNombreArchivo(null);
    setFotoBase64(undefined);
    setErrores(({ foto: _foto, ...resto }) => resto);
    if (inputFoto.current) inputFoto.current.value = "";
  }

  function onArchivoElegido(archivo: File | undefined) {
    setNombreArchivo(archivo?.name ?? null);
    setErrores(({ foto: _foto, ...resto }) => resto);
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
        maxLength={500}
        contador
        onChange={(e) => setComentario(e.target.value)}
        error={errores.comentario}
        hint='Obligatorio cuando el motivo es "otro motivo"'
      />
      <FieldWrapper label="Foto (opcional)" htmlFor="incidencia-foto" error={errores.foto} hint="Solo imágenes">
        {/* El input nativo queda oculto (sr-only, sigue accesible por teclado) y el label hace de botón. */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            ref={inputFoto}
            id="incidencia-foto"
            name="foto"
            type="file"
            accept="image/*"
            onChange={(e) => onArchivoElegido(e.target.files?.[0])}
            className="peer sr-only"
          />
          <label
            htmlFor="incidencia-foto"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-hormigon-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-400 hover:bg-hormigon-50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gray-400"
          >
            <ImagePlus className="h-4 w-4 text-gray-500" aria-hidden />
            {nombreArchivo ? "Cambiar foto" : "Elegir foto"}
          </label>
          <span className="min-w-0 max-w-full truncate text-sm text-gray-600" data-testid="foto-nombre" title={nombreArchivo ?? undefined}>
            {nombreArchivo ?? "Ninguna foto elegida"}
          </span>
          {nombreArchivo && (
            <button
              type="button"
              onClick={quitarFoto}
              className="rounded-md p-1 text-gray-400 hover:bg-hormigon-100 hover:text-gray-700"
              title="Quitar la foto"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Quitar la foto</span>
            </button>
          )}
        </div>
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
      <DateField
        label="Nueva fecha *"
        name="nueva_fecha"
        min={hoyISO()}
        value={nuevaFecha}
        onChange={(v) => {
          setNuevaFecha(v);
          if (v) setErrores(({ nueva_fecha: _f, ...resto }) => resto);
        }}
        error={errores.nueva_fecha}
        hint="De hoy en adelante."
      />
      <SelectField label="Franja *" name="franja" required value={franja} onChange={(e) => setFranja(e.target.value)} error={errores.franja}>
        {FRANJAS.map((f) => (
          <option key={f} value={f}>
            {franjaLegible(f)}
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
      {acciones.includes("incidencia") && <IncidenciaForm envioId={envioId} />}
      {acciones.includes("reprogramar") && <ReprogramarForm envioId={envioId} />}
    </div>
  );
}
