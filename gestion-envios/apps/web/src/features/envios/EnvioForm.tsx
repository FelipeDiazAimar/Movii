import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { envioFormSchema, ENVIO_FORM_DEFAULTS } from "./schema";
import { TAMANOS } from "./types";
import type { CrearEnvioInput } from "./types";

interface Props {
  onSubmit: (input: CrearEnvioInput) => Promise<void>;
  enviando: boolean;
  errorServidor: string | null;
}

type RawValues = Record<keyof typeof ENVIO_FORM_DEFAULTS, string | boolean>;

function valoresIniciales(): RawValues {
  return {
    ...ENVIO_FORM_DEFAULTS,
    peso: "",
  } as unknown as RawValues;
}

export function EnvioForm({ onSubmit, enviando, errorServidor }: Props) {
  const [valores, setValores] = useState<RawValues>(valoresIniciales());
  const [errores, setErrores] = useState<Record<string, string>>({});

  function setCampo<K extends keyof RawValues>(campo: K, valor: RawValues[K]) {
    setValores((prev) => ({ ...prev, [campo]: valor }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const resultado = envioFormSchema.safeParse(valores);
    if (!resultado.success) {
      const nuevosErrores: Record<string, string> = {};
      for (const issue of resultado.error.issues) {
        nuevosErrores[issue.path[0] as string] = issue.message;
      }
      setErrores(nuevosErrores);
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
    });
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
            value={valores.remitenteNombre as string}
            onChange={(e) => setCampo("remitenteNombre", e.target.value)}
            error={errores.remitenteNombre}
          />
          <InputField
            label="Teléfono"
            name="remitenteTelefono"
            value={valores.remitenteTelefono as string}
            onChange={(e) => setCampo("remitenteTelefono", e.target.value)}
            error={errores.remitenteTelefono}
          />
          <InputField
            label="Dirección"
            name="remitenteDireccion"
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
            value={valores.destinatarioNombre as string}
            onChange={(e) => setCampo("destinatarioNombre", e.target.value)}
            error={errores.destinatarioNombre}
          />
          <InputField
            label="Teléfono"
            name="destinatarioTelefono"
            value={valores.destinatarioTelefono as string}
            onChange={(e) => setCampo("destinatarioTelefono", e.target.value)}
            error={errores.destinatarioTelefono}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <InputField
            label="Calle *"
            name="calle"
            required
            className="sm:col-span-2"
            value={valores.calle as string}
            onChange={(e) => setCampo("calle", e.target.value)}
            error={errores.calle}
          />
          <InputField
            label="Número"
            name="numero"
            value={valores.numero as string}
            onChange={(e) => setCampo("numero", e.target.value)}
            error={errores.numero}
          />
          <InputField
            label="Piso / Depto"
            name="pisoDepto"
            value={valores.pisoDepto as string}
            onChange={(e) => setCampo("pisoDepto", e.target.value)}
            error={errores.pisoDepto}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InputField
            label="Localidad *"
            name="localidad"
            required
            value={valores.localidad as string}
            onChange={(e) => setCampo("localidad", e.target.value)}
            error={errores.localidad}
          />
          <InputField
            label="Código postal"
            name="codigoPostal"
            value={valores.codigoPostal as string}
            onChange={(e) => setCampo("codigoPostal", e.target.value)}
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
            type="number"
            step="0.1"
            min="0"
            required
            value={valores.peso as string}
            onChange={(e) => setCampo("peso", e.target.value)}
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
            value={valores.tipoContenido as string}
            onChange={(e) => setCampo("tipoContenido", e.target.value)}
            error={errores.tipoContenido}
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

      <div>
        <Button type="submit" loading={enviando}>
          Registrar envío
        </Button>
      </div>
    </form>
  );
}
