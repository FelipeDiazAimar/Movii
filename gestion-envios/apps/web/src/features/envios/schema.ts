import { z } from "zod";
import { TAMANOS } from "./types";

/**
 * Espeja las validaciones reales de `validarCrearEnvioInput` en
 * services/api/internal/services/envio_service.go: nombre del destinatario,
 * calle, localidad y peso > 0 son obligatorios. El resto es opcional en la
 * API, así que acá también.
 */
export const envioFormSchema = z.object({
  remitenteNombre: z.string().max(120).optional().or(z.literal("")),
  remitenteTelefono: z.string().max(40).optional().or(z.literal("")),
  remitenteDireccion: z.string().max(200).optional().or(z.literal("")),

  destinatarioNombre: z.string().trim().min(1, "El nombre del destinatario es obligatorio").max(120),
  destinatarioTelefono: z.string().max(40).optional().or(z.literal("")),
  calle: z.string().trim().min(1, "La calle es obligatoria").max(120),
  numero: z.string().max(20).optional().or(z.literal("")),
  pisoDepto: z.string().max(40).optional().or(z.literal("")),
  localidad: z.string().trim().min(1, "La localidad es obligatoria").max(120),
  codigoPostal: z.string().max(20).optional().or(z.literal("")),

  peso: z.coerce.number({ message: "El peso es obligatorio" }).positive("El peso debe ser mayor a 0"),
  tamano: z.enum(TAMANOS),
  tipoContenido: z.string().max(120).optional().or(z.literal("")),
  fragil: z.boolean(),
  urgente: z.boolean(),
});

export type EnvioFormValues = z.infer<typeof envioFormSchema>;

export const ENVIO_FORM_DEFAULTS: EnvioFormValues = {
  remitenteNombre: "",
  remitenteTelefono: "",
  remitenteDireccion: "",
  destinatarioNombre: "",
  destinatarioTelefono: "",
  calle: "",
  numero: "",
  pisoDepto: "",
  localidad: "",
  codigoPostal: "",
  peso: 0,
  tamano: "mediano",
  tipoContenido: "",
  fragil: false,
  urgente: false,
};
