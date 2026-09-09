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
