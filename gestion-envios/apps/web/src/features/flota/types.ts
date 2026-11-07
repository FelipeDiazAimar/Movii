/** Coordenada [lat, lng] lista para Leaflet. */
export type LatLng = [number, number];

export interface Recorrido {
  /** Polilínea por calles: [[lat, lng], ...]. */
  geometria: LatLng[];
  distancia_m: number;
  duracion_s: number;
}

export type EstadoVehiculo = "activo" | "en_base" | "mantenimiento";
export type TipoVehiculo = "camion" | "furgon" | "utilitario" | "moto";

export interface Vehiculo {
  id: string;
  patente: string;
  modelo: string;
  tipo: TipoVehiculo;
  capacidad_peso: number;
  capacidad_volumen: number;
  estado: EstadoVehiculo;
  /** #RRGGBB propio; vacío = automático. */
  color: string;
  latitud: number;
  longitud: number;
  velocidad: number;
  rumbo: number;
  temperatura: number;
  posicion_at: string;
  ruta_id: string | null;
  ruta_nombre: string;
  ruta_zona: string;
  ruta_estado: string;
  repartidor_id: string | null;
  repartidor_nombre: string;
  carga_actual_peso: number;
  capacidad_porcentaje: number;
  total_paquetes: number;
  paquetes_entregados: number;
  paquetes_fallidos: number;
}

export interface PaqueteVehiculo {
  orden: number;
  envio_id: string;
  codigo_guia: string;
  estado: string;
  peso: number;
  tamano: string;
  tipo_contenido: string;
  fragil: boolean;
  urgente: boolean;
  destinatario_nombre: string;
  direccion: string;
  localidad: string;
  coordenadas: { lat: number; lng: number } | null;
}

export interface VehiculoDetalle extends Vehiculo {
  paquetes: PaqueteVehiculo[];
  recorrido: Recorrido | null;
}

/** Evento SSE "posicion". */
export interface PosicionVehiculo {
  vehiculo_id: string;
  patente: string;
  ruta_id: string | null;
  lat: number;
  lng: number;
  velocidad: number;
  rumbo: number;
  en: string;
}

export interface TrayectoEnvio {
  envio_id: string;
  codigo_guia: string;
  estado: string;
  destino: { lat: number; lng: number } | null;
  direccion: string;
  vehiculo: PosicionVehiculo | null;
  recorrido: Recorrido | null;
  paradas_antes: number;
}

export interface VehiculoInput {
  patente: string;
  modelo: string;
  tipo: TipoVehiculo;
  capacidad_peso: number;
  capacidad_volumen: number;
  estado: EstadoVehiculo;
  color?: string;
}

export const ETIQUETA_ESTADO_VEHICULO: Record<EstadoVehiculo, string> = {
  activo: "En servicio",
  en_base: "En base",
  mantenimiento: "Mantenimiento",
};

export const ETIQUETA_TIPO_VEHICULO: Record<TipoVehiculo, string> = {
  camion: "Camión",
  furgon: "Furgón",
  utilitario: "Utilitario",
  moto: "Moto",
};
