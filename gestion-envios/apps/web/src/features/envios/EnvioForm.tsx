import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarRutas } from "@/features/rutas/api";
import { Button } from "@/components/ui/Button";
import { DateField, InputField, SelectField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { envioFormSchema, ENVIO_FORM_DEFAULTS } from "./schema";
import { hoyISO } from "./formato";
import { TAMANOS } from "./types";
import type { CrearEnvioInput } from "./types";
import {
  colapsarEspacios,
  formatearTelefonoAR,
  limpiarCodigoPostalAlEscribir,
  limpiarDecimalAlEscribir,
  limpiarEmailAlEscribir,
  limpiarNombreComercioAlEscribir,
  limpiarNombrePersonaAlEscribir,
  limpiarPisoDeptoAlEscribir,
  limpiarTelefonoAlEscribir,
  soloDigitos,
} from "@/utils/mascaras";

interface Props {
  /** rutaId vacío = el envío queda pendiente, sin ruta (la asignación es opcional). */
  onSubmit: (input: CrearEnvioInput, rutaId: string) => Promise<void>;
  enviando: boolean;
  errorServidor: string | null;
}

type RawValues = Record<keyof typeof ENVIO_FORM_DEFAULTS, string | boolean>;

/** Un error por campo (el primero que informa Zod). */
function erroresDe(valores: RawValues): Record<string, string> {
  const resultado = envioFormSchema.safeParse(valores);
  if (resultado.success) return {};
  const errores: Record<string, string> = {};
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as string;
    if (!(campo in errores)) errores[campo] = issue.message;
  }
  return errores;
}

function valoresIniciales(): RawValues {
  return {
    ...ENVIO_FORM_DEFAULTS,
    peso: "",
    fechaEntrega: hoyISO(),
  } as unknown as RawValues;
}

type TelefonoCampo = "remitenteTelefono" | "destinatarioTelefono";

export function EnvioForm({ onSubmit, enviando, errorServidor }: Props) {
  const [valores, setValores] = useState<RawValues>(valoresIniciales());
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [intentado, setIntentado] = useState(false);
  const [rutaId, setRutaId] = useState("");
  const { data: rutas } = useQuery({ queryKey: ["rutas", { fecha: undefined }], queryFn: () => listarRutas({}) });
  const planificadas = (rutas ?? []).filter((r) => r.estado === "planificada");

  function setCampo<K extends keyof RawValues>(campo: K, valor: RawValues[K]) {
    const siguientes = { ...valores, [campo]: valor };
    setValores(siguientes);
    // Después del primer intento de envío se revalida al cambiar: el error
    // de un campo desaparece apenas se corrige (y aparece si se rompe).
    if (intentado) setErrores(erroresDe(siguientes));
  }

  /** Al salir del teléfono lo deja con el formato argentino usual. */
  function formatearTelefono(campo: TelefonoCampo) {
    const actual = valores[campo] as string;
    const formateado = formatearTelefonoAR(actual);
    if (formateado !== actual) setCampo(campo, formateado);
  }

  /** Al salir colapsa los espacios dobles. */
  function colapsar(campo: "destinatarioNombre" | "localidad") {
    const actual = valores[campo] as string;
    const colapsado = colapsarEspacios(actual);
    if (colapsado !== actual) setCampo(campo, colapsado);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setIntentado(true);
    const resultado = envioFormSchema.safeParse(valores);
    if (!resultado.success) {
      setErrores(erroresDe(valores));
      return;
    }
    setErrores({});

    const v = resultado.data;
    await onSubmit({
      remitente: {
        nombre: v.remitenteNombre ?? "",
        telefono: v.remitenteTelefono ?? "",
        direccion: v.remitenteDireccion ?? "",
      },
      destinatario: {
        nombre: v.destinatarioNombre,
        telefono: v.destinatarioTelefono ?? "",
        email: v.destinatarioEmail ?? "",
        calle: v.calle,
        numero: v.numero ?? "",
        piso_depto: v.pisoDepto ?? "",
        localidad: v.localidad,
        codigo_postal: v.codigoPostal ?? "",
      },
      paquete: {
        peso: v.peso,
        tamano: v.tamano,
        tipo_contenido: v.tipoContenido ?? "",
        fragil: v.fragil,
        urgente: v.urgente,
      },
      fecha_entrega: v.fechaEntrega,
    }, rutaId);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {errorServidor && <Alert variant="error">{errorServidor}</Alert>}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-gray-900">Remitente</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InputField
            label="Nombre"
            name="remitenteNombre"
            maxLength={100}
            autoComplete="off"
            value={valores.remitenteNombre as string}
            onChange={(e) => setCampo("remitenteNombre", limpiarNombreComercioAlEscribir(e.target.value))}
            error={errores.remitenteNombre}
          />
          <InputField
            label="Teléfono"
            name="remitenteTelefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder="3564 41-2345"
            value={valores.remitenteTelefono as string}
            onChange={(e) => setCampo("remitenteTelefono", limpiarTelefonoAlEscribir(e.target.value))}
            onBlur={() => formatearTelefono("remitenteTelefono")}
            error={errores.remitenteTelefono}
          />
          <InputField
            label="Dirección"
            name="remitenteDireccion"
            maxLength={200}
            autoComplete="off"
            value={valores.remitenteDireccion as string}
            onChange={(e) => setCampo("remitenteDireccion", e.target.value)}
            error={errores.remitenteDireccion}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-gray-900">Destinatario</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InputField
            label="Nombre *"
            name="destinatarioNombre"
            required
            maxLength={100}
            autoComplete="off"
            value={valores.destinatarioNombre as string}
            onChange={(e) => setCampo("destinatarioNombre", limpiarNombrePersonaAlEscribir(e.target.value))}
            onBlur={() => colapsar("destinatarioNombre")}
            error={errores.destinatarioNombre}
          />
          <InputField
            label="Teléfono"
            name="destinatarioTelefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder="3564 41-2345"
            value={valores.destinatarioTelefono as string}
            onChange={(e) => setCampo("destinatarioTelefono", limpiarTelefonoAlEscribir(e.target.value))}
            onBlur={() => formatearTelefono("destinatarioTelefono")}
            error={errores.destinatarioTelefono}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InputField
            label="Email"
            name="destinatarioEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={150}
            placeholder="nombre@empresa.com"
            value={valores.destinatarioEmail as string}
            onChange={(e) => setCampo("destinatarioEmail", limpiarEmailAlEscribir(e.target.value))}
            error={errores.destinatarioEmail}
            hint="Si no tiene WhatsApp, los avisos le llegan por mail."
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <InputField
            label="Calle *"
            name="calle"
            required
            maxLength={120}
            autoComplete="off"
            className="sm:col-span-2"
            value={valores.calle as string}
            onChange={(e) => setCampo("calle", e.target.value)}
            error={errores.calle}
          />
          <InputField
            label="Número"
            name="numero"
            inputMode="numeric"
            maxLength={5}
            autoComplete="off"
            value={valores.numero as string}
            onChange={(e) => setCampo("numero", soloDigitos(e.target.value, 5))}
            error={errores.numero}
          />
          <InputField
            label="Piso / Depto"
            name="pisoDepto"
            maxLength={10}
            autoComplete="off"
            value={valores.pisoDepto as string}
            onChange={(e) => setCampo("pisoDepto", limpiarPisoDeptoAlEscribir(e.target.value))}
            error={errores.pisoDepto}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InputField
            label="Localidad *"
            name="localidad"
            required
            maxLength={100}
            autoComplete="off"
            value={valores.localidad as string}
            onChange={(e) => setCampo("localidad", limpiarNombrePersonaAlEscribir(e.target.value))}
            onBlur={() => colapsar("localidad")}
            error={errores.localidad}
          />
          <InputField
            label="Código postal"
            name="codigoPostal"
            maxLength={8}
            autoComplete="postal-code"
            placeholder="X2400ABC"
            value={valores.codigoPostal as string}
            onChange={(e) => setCampo("codigoPostal", limpiarCodigoPostalAlEscribir(e.target.value))}
            error={errores.codigoPostal}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-gray-900">Paquete</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InputField
            label="Peso (kg) *"
            name="peso"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="2,5"
            required
            value={valores.peso as string}
            onChange={(e) => setCampo("peso", limpiarDecimalAlEscribir(e.target.value))}
            error={errores.peso}
          />
          <SelectField
            label="Tamaño *"
            name="tamano"
            required
            value={valores.tamano as string}
            onChange={(e) => setCampo("tamano", e.target.value)}
            error={errores.tamano}
          >
            {TAMANOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
          <InputField
            label="Tipo de contenido"
            name="tipoContenido"
            maxLength={100}
            autoComplete="off"
            value={valores.tipoContenido as string}
            onChange={(e) => setCampo("tipoContenido", e.target.value)}
            error={errores.tipoContenido}
          />
        </div>
        <div className="max-w-xs">
          <DateField
            label="Fecha de entrega *"
            name="fechaEntrega"
            min={hoyISO()}
            value={valores.fechaEntrega as string}
            onChange={(v) => setCampo("fechaEntrega", v)}
            error={errores.fechaEntrega}
            hint="Día en que el repartidor lo ve para entregarlo."
          />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={valores.fragil as boolean}
              onChange={(e) => setCampo("fragil", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-movii-500 focus:ring-movii-400"
            />
            Frágil
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={valores.urgente as boolean}
              onChange={(e) => setCampo("urgente", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-movii-500 focus:ring-movii-400"
            />
            Urgente
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-gray-900">Asignación (opcional)</legend>
        <div className="max-w-md">
          <SelectField
            label="Ruta"
            name="rutaId"
            value={rutaId}
            onChange={(e) => setRutaId(e.target.value)}
            hint="Si la elegís, el envío queda asignado al repartidor de esa ruta. Si no, queda pendiente y lo asignás después."
          >
            <option value="">Sin asignar por ahora</option>
            {planificadas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre} · {r.repartidor_nombre ?? "sin repartidor"}
              </option>
            ))}
          </SelectField>
        </div>
      </fieldset>

      <div>
        <Button type="submit" loading={enviando}>
          Registrar envío
        </Button>
      </div>
    </form>
  );
}
