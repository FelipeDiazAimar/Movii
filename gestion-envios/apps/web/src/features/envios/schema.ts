import { z } from "zod";
import { ESTADOS_CAMBIABLES, FRANJAS, MOTIVOS_FALLO, TAMANOS } from "./types";
import {
  EMAIL_ERROR,
  PESO_DECIMALES_ERROR,
  PESO_ERROR,
  TELEFONO_ERROR,
  CODIGO_POSTAL_ERROR,
  normalizarTelefonoAR,
  parsearDecimal,
  validarCodigoPostal,
  validarEmail,
} from "@/utils/mascaras";

/** Teléfono opcional: si viene, tiene que normalizar a 10 dígitos nacionales. */
const telefonoOpcional = z
  .string()
  .max(20, "El teléfono no puede superar los 20 caracteres")
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || normalizarTelefonoAR(v) !== null, { message: TELEFONO_ERROR });

/**
 * Espeja las validaciones reales de `validarCrearEnvioInput` en
 * services/api/internal/services/envio_service.go: nombre del destinatario,
 * calle, localidad y peso > 0 son obligatorios. El resto es opcional en la
 * API, así que acá también. Los máximos coinciden con la base (o son
 * menores): remitentes/destinatarios.nombre 100, calle 200, numero 10,
 * piso_depto 20, localidad 100, codigo_postal 10, tipo_contenido 100,
 * email 150.
 */
export const envioFormSchema = z.object({
  remitenteNombre: z.string().max(100, "El nombre no puede superar los 100 caracteres").optional().or(z.literal("")),
  remitenteTelefono: telefonoOpcional,
  remitenteDireccion: z.string().max(200, "La dirección no puede superar los 200 caracteres").optional().or(z.literal("")),

  destinatarioNombre: z.string().trim().min(1, "El nombre del destinatario es obligatorio").max(100, "El nombre no puede superar los 100 caracteres"),
  destinatarioTelefono: telefonoOpcional,
  destinatarioEmail: z
    .string()
    .max(150, "El email no puede superar los 150 caracteres")
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || validarEmail(v) === null, { message: EMAIL_ERROR }),
  calle: z.string().trim().min(1, "La calle es obligatoria").max(120, "La calle no puede superar los 120 caracteres"),
  numero: z
    .string()
    .max(5, "El número no puede superar los 5 caracteres")
    .regex(/^\d*$/, "El número solo admite dígitos")
    .optional()
    .or(z.literal("")),
  pisoDepto: z.string().max(10, "El piso / depto no puede superar los 10 caracteres").optional().or(z.literal("")),
  localidad: z.string().trim().min(1, "La localidad es obligatoria").max(100, "La localidad no puede superar los 100 caracteres"),
  codigoPostal: z
    .string()
    .max(8, "El código postal no puede superar los 8 caracteres")
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || validarCodigoPostal(v) === null, { message: CODIGO_POSTAL_ERROR }),

  // Acepta coma o punto ("2,5" → 2.5); el campo filtra a 2 decimales.
  peso: z.preprocess(
    (v) => {
      if (typeof v === "number") return v;
      if (typeof v !== "string") return v;
      const n = parsearDecimal(v);
      return n === null ? undefined : n;
    },
    z
      .number({ message: "El peso es obligatorio" })
      .min(0.01, PESO_ERROR)
      .max(1000, PESO_ERROR)
      .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9, { message: PESO_DECIMALES_ERROR }),
  ),
  tamano: z.enum(TAMANOS),
  tipoContenido: z.string().max(100, "El tipo de contenido no puede superar los 100 caracteres").optional().or(z.literal("")),
  fragil: z.boolean(),
  urgente: z.boolean(),
  fechaEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha de entrega"),
});

export type EnvioFormValues = z.infer<typeof envioFormSchema>;

export const ENVIO_FORM_DEFAULTS: EnvioFormValues = {
  remitenteNombre: "",
  remitenteTelefono: "",
  remitenteDireccion: "",
  destinatarioNombre: "",
  destinatarioTelefono: "",
  destinatarioEmail: "",
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
  fechaEntrega: "",
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
    comentario: z.string().max(500, "El comentario no puede superar los 500 caracteres").optional().or(z.literal("")),
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
  nueva_fecha: z
    .string()
    .trim()
    .min(1, "Elegí una fecha")
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha elegida no es válida")),
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
