export const ESTADOS_RUTA = ["planificada", "en_curso", "completada"] as const;
export type EstadoRuta = (typeof ESTADOS_RUTA)[number];

export interface RutaListItem {
  id: string;
  nombre: string;
  zona: string;
  fecha: string;
  estado: EstadoRuta;
  repartidor_id: string;
  repartidor_nombre?: string;
  cantidad_envios: number;
  /** Avance y carga (la API los manda desde el listado del 11/11). */
  entregados?: number;
  no_entregados?: number;
  peso_total?: number;
  vehiculo_patente?: string;
  vehiculo_tipo?: string;
}

/** Envío tal como viene embebido en el detalle de ruta: sin datos del destinatario. */
export interface EnvioEnRuta {
  id: string;
  codigo_guia: string;
  estado: string;
  peso: number;
  tamano: string;
  tipo_contenido: string;
  fragil: boolean;
  urgente: boolean;
  remitente_id: string;
  destinatario_id: string;
  ruta_id: string | null;
}

export interface RutaDetalle {
  id: string;
  nombre: string;
  zona: string;
  fecha: string;
  estado: EstadoRuta;
  repartidor_id: string;
  repartidor_nombre?: string;
  envios: EnvioEnRuta[];
  peso_total: number;
  cantidad_envios: number;
}

export interface RutaInput {
  nombre: string;
  zona: string;
  repartidor_id: string;
}

export interface RutasFiltro {
  fecha?: string;
}

export type NivelRecomendacion = "conviene" | "dudoso" | "no_conviene" | "sin_recomendacion";

export interface Recomendacion {
  extra_km: number;
  desvio_pct: number;
  recomendacion: NivelRecomendacion;
  motivo: string;
}
