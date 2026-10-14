import { z } from "zod";
import { ESTADOS_CAMBIABLES, FRANJAS, MOTIVOS_FALLO, TAMANOS } from "./types";

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

/**
 * HU-06: cambiar estado solo entre `asignado` ⇄ `en_camino` (el resto va
 * por confirmación o incidencia; el backend responde 409 en esos casos).
 */
export const cambiarEstadoSchema = z.object({
  estado: z.enum(ESTADOS_CAMBIABLES),
});

export type CambiarEstadoValues = z.infer<typeof cambiarEstadoSchema>;

/**
 * HU-07: motivo de la lista cerrada (openapi MotivoFallo); con motivo
 * `otro` el comentario es obligatorio (el backend responde 400
 * `comentario_obligatorio` si falta).
 */
export const incidenciaSchema = z
  .object({
    motivo: z.enum(MOTIVOS_FALLO),
    comentario: z.string().max(500).optional().or(z.literal("")),
    foto_base64: z.string().optional(),
  })
  .refine((v) => v.motivo !== "otro" || (v.comentario ?? "").trim().length > 0, {
    message: "El comentario es obligatorio cuando el motivo es otro",
    path: ["comentario"],
  });

export type IncidenciaValues = z.infer<typeof incidenciaSchema>;

/**
 * HU-09: nueva fecha en formato YYYY-MM-DD (el backend valida que no sea
 * pasada) + franja de la lista cerrada (openapi FranjaHoraria).
 */
export const reprogramacionSchema = z.object({
  nueva_fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato AAAA-MM-DD"),
  franja: z.enum(FRANJAS),
});

export type ReprogramacionValues = z.infer<typeof reprogramacionSchema>;

/**
 * HU-10: código de guía para el buscador de tracking. Validación amable
 * (trim + no-vacío + formato `MOV-AAAAMMDD-XXXX`); el backend es la
 * autoridad y responde 404 genérico si no existe.
 */
export const trackingCodigoSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un código de guía")
  .regex(/^MOV-\d{8}-[A-Za-z0-9]{4}$/, "El código tiene formato MOV-AAAAMMDD-XXXX");
