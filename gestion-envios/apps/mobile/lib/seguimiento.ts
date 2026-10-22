/**
 * Lógica pura del seguimiento de entregas (HU-06 a HU-10) en la app del
 * repartidor: catálogos, validaciones previas al envío y adaptadores de datos.
 * Las reglas espejan las de la API (services/api, estado_service.go) para
 * avisar antes de mandar algo que el servidor va a rechazar.
 */
import { isAxiosError } from "axios";

import type { EstadoEnvioAPI } from "@/lib/api-client";
import type { TimelineEvent } from "@/types/logistics";

export const MOTIVOS_FALLO = [
  { value: "cliente_ausente", label: "Destinatario ausente" },
  { value: "direccion_incorrecta", label: "Dirección incorrecta" },
  { value: "rechazado", label: "Rechazado por el destinatario" },
  { value: "zona_insegura", label: "Zona insegura" },
  { value: "otro", label: "Otro motivo" },
] as const;
export type MotivoFallo = (typeof MOTIVOS_FALLO)[number]["value"];

export const RELACIONES_RECEPTOR = [
  { value: "destinatario", label: "Destinatario" },
  { value: "familiar", label: "Familiar" },
  { value: "vecino", label: "Vecino/a" },
  { value: "encargado", label: "Encargado/a" },
] as const;
export type RelacionReceptor = (typeof RELACIONES_RECEPTOR)[number]["value"];

export const FRANJAS_HORARIAS = [
  { value: "manana", label: "Mañana" },
  { value: "tarde", label: "Tarde" },
  { value: "noche", label: "Noche" },
] as const;
export type FranjaHoraria = (typeof FRANJAS_HORARIAS)[number]["value"];

/** Límite de la API por imagen (5 MB, en bytes decodificados). */
export const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;

/** Base64 de los magic bytes: JPEG (FF D8 FF) y PNG (89 50 4E 47 …). */
export const esJPEGBase64 = (b64: string) => b64.startsWith("/9j/");
export const esPNGBase64 = (b64: string) => b64.startsWith("iVBORw0KGgo");
export const bytesDeBase64 = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);

/** Fecha de hoy en UTC (YYYY-MM-DD): la API valida la reprogramación contra "hoy" en UTC. */
export function hoyUTC(ahora: Date = new Date()): string {
  return ahora.toISOString().slice(0, 10);
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Próximas `cantidad` fechas válidas para reprogramar (desde hoy en UTC). */
export function proximasFechas(cantidad = 3, ahora: Date = new Date()): { fecha: string; etiqueta: string }[] {
  const base = new Date(`${hoyUTC(ahora)}T00:00:00Z`);
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(base.getTime() + i * 86_400_000);
    const fecha = d.toISOString().slice(0, 10);
    const dia = i === 0 ? "Hoy" : i === 1 ? "Mañana" : DIAS[d.getUTCDay()];
    return { fecha, etiqueta: `${dia}\n${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` };
  });
}

/** Qué puede hacer el repartidor según el estado real del envío (CA-06 de HU-06). */
export function accionesDisponibles(estado: EstadoEnvioAPI | undefined) {
  return {
    iniciar: estado === "asignado",
    volverAsignado: estado === "en_camino",
    entregar: estado === "asignado" || estado === "en_camino",
    incidencia: estado === "asignado" || estado === "en_camino",
    reprogramar: estado === "no_entregado",
  };
}

/** Valida la incidencia (HU-07): motivo de lista cerrada, comentario si es "otro", foto JPEG ≤ 5 MB. */
export function validarIncidencia(motivo: string, comentario: string, fotoBase64?: string): string | null {
  if (!MOTIVOS_FALLO.some((m) => m.value === motivo)) return "Elegí un motivo de la lista.";
  if (motivo === "otro" && !comentario.trim()) return "Con el motivo \"Otro\" el comentario es obligatorio.";
  if (fotoBase64) return validarFoto(fotoBase64);
  return null;
}

/** Valida la confirmación (HU-08): receptor, relación, firma PNG y foto JPEG. */
export function validarConfirmacion(datos: {
  receptorNombre: string;
  relacion: string;
  firmaBase64: string | null;
  fotoBase64: string | null;
}): string | null {
  const nombre = datos.receptorNombre.trim();
  if (!nombre) return "Ingresá el nombre de quien recibe.";
  if (nombre.length > 100) return "El nombre no puede superar los 100 caracteres.";
  if (!RELACIONES_RECEPTOR.some((r) => r.value === datos.relacion)) return "Elegí la relación de quien recibe.";
  if (!datos.firmaBase64) return "Falta la firma del receptor.";
  if (!esPNGBase64(datos.firmaBase64)) return "No se pudo leer la firma. Volvé a firmar.";
  if (!datos.fotoBase64) return "Falta la foto del paquete.";
  return validarFoto(datos.fotoBase64);
}

function validarFoto(b64: string): string | null {
  if (!esJPEGBase64(b64)) return "La foto debe ser JPEG. Sacala con la cámara.";
  if (bytesDeBase64(b64) > MAX_IMAGEN_BYTES) return "La foto supera los 5 MB.";
  return null;
}

export type TrackingEventoAPI = { fecha: string; descripcion: string; motivo?: string };
export type TrackingInfo = {
  codigo_guia: string;
  estado: EstadoEnvioAPI;
  localidad: string;
  actualizado_en: string;
  historial: TrackingEventoAPI[];
};

/** Formatea una fecha UTC de la API a "22/10 · 14:05" en hora local del teléfono. */
export function formatearFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} · ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Adapta el historial público al componente de timeline del prototipo. */
export function trackingAEventos(t: TrackingInfo): TimelineEvent[] {
  return (t.historial ?? []).map((ev) => ({
    label: ev.descripcion,
    detail: t.localidad,
    timestamp: formatearFecha(ev.fecha),
    completed: true,
  }));
}

/** Mensaje legible de un error de la API ({error:{code,message}}) o de red. */
export function mensajeDeError(error: unknown, porDefecto = "No se pudo completar la operación."): string {
  if (isAxiosError(error)) {
    const mensaje = (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (mensaje) return mensaje.charAt(0).toUpperCase() + mensaje.slice(1);
    if (!error.response) return "Sin conexión con el servidor. Revisá tu red e intentá de nuevo.";
  }
  return porDefecto;
}

/** true si el error es un 404 de la API (envío inexistente o ajeno, código de tracking desconocido). */
export const esNoEncontrado = (error: unknown) => isAxiosError(error) && error.response?.status === 404;
