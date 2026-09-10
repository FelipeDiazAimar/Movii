export const ESTADOS_ENVIO = ["pendiente", "asignado", "en_camino", "entregado", "no_entregado"] as const;
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

export const TAMANOS = ["chico", "mediano", "grande"] as const;
export type Tamano = (typeof TAMANOS)[number];

export interface EnvioListItem {
  id: string;
  codigo_guia: string;
  estado: EstadoEnvio;
  peso: number;
  tamano: Tamano;
  destinatario: string;
  direccion: string;
  fecha_creacion: string;
  ruta_id: string | null;
}

export interface Destinatario {
  id: string;
  nombre: string;
  telefono: string;
  calle: string;
  numero: string;
  piso_depto: string;
  localidad: string;
  codigo_postal: string;
}

export interface EnvioDetalle {
  id: string;
  codigo_guia: string;
  estado: EstadoEnvio;
  peso: number;
  tamano: Tamano;
  tipo_contenido: string;
  fragil: boolean;
  urgente: boolean;
  remitente_id: string;
  destinatario_id: string;
  ruta_id: string | null;
  destinatario: Destinatario;
  fecha_creacion: string;
  historial: EventoEnvio[];
  reprogramado_para: string | null;
  franja: FranjaHoraria | null;
  confirmacion: ConfirmacionMetadata | null;
}

export interface CrearEnvioInput {
  remitente: {
    nombre: string;
    telefono: string;
    direccion: string;
  };
  destinatario: {
    nombre: string;
    telefono: string;
    calle: string;
    numero: string;
    piso_depto: string;
    localidad: string;
    codigo_postal: string;
  };
  paquete: {
    peso: number;
    tamano: Tamano;
    tipo_contenido: string;
    fragil: boolean;
    urgente: boolean;
  };
}

export interface CrearEnvioResponse {
  id: string;
  codigo_guia: string;
  estado: EstadoEnvio;
  peso: number;
  tamano: Tamano;
}

export interface EnviosFiltro {
  estado?: EstadoEnvio;
  fecha?: string;
}

export const MOTIVOS_FALLO = [
  "cliente_ausente",
  "direccion_incorrecta",
  "rechazado",
  "zona_insegura",
  "otro",
] as const;
export type MotivoFallo = (typeof MOTIVOS_FALLO)[number];

export const FRANJAS = ["manana", "tarde", "noche"] as const;
export type FranjaHoraria = (typeof FRANJAS)[number];

export const ESTADOS_CAMBIABLES = ["asignado", "en_camino"] as const;
export type EstadoCambiable = (typeof ESTADOS_CAMBIABLES)[number];

export interface EventoEnvio {
  fecha: string;
  actor_nombre: string | null;
  estado_anterior: EstadoEnvio | null;
  estado_nuevo: EstadoEnvio;
  motivo: string | null;
  comentario: string | null;
}

export interface ConfirmacionMetadata {
  receptor_nombre: string;
  receptor_relacion: string;
  confirmada_at: string;
  firma_url: string;
  foto_url: string;
}

export interface TrackingEvento {
  fecha: string;
  descripcion: string;
  motivo?: string;
}

export interface TrackingResponse {
  codigo_guia: string;
  estado: EstadoEnvio;
  localidad: string;
  actualizado_en: string;
  historial: TrackingEvento[];
}

export type CambiarEstadoInput = { estado: EstadoCambiable };
export type IncidenciaInput = { motivo: string; comentario?: string; foto_base64?: string };
export type ReprogramacionInput = { nueva_fecha: string; franja: FranjaHoraria };
