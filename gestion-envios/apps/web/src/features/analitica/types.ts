export interface DashboardMetricas {
  total_envios: number;
  pendientes: number;
  asignados: number;
  en_camino: number;
  entregados: number;
  no_entregados: number;
  porcentaje_efectividad: number;
}

export interface RutaActivaResumen {
  ruta_id: string;
  nombre: string;
  repartidor_nombre: string;
  total_paradas: number;
  completadas: number;
  porcentaje_avance: number;
  estado_ruta: string;
}

export interface AlertaDashboard {
  envio_id: string;
  codigo_guia: string;
  tipo: string;
  descripcion: string;
  fecha: string;
}

export interface Dashboard {
  fecha: string;
  metricas: DashboardMetricas;
  rutas_activas: RutaActivaResumen[];
  ultimas_alertas: AlertaDashboard[];
}

export interface ParadaMapa {
  orden: number;
  envio_id: string;
  codigo_guia: string;
  estado: string;
  destinatario_nombre: string;
  direccion: string;
  localidad: string;
  coordenadas: { lat: number; lng: number } | null;
}

export interface MapaRuta {
  ruta_id: string;
  nombre: string;
  fecha: string;
  repartidor: { id: string; nombre: string };
  paradas: ParadaMapa[];
}

export interface PeriodoFiltro {
  desde: string;
  hasta: string;
}

export interface ReporteEnviosFiltro extends PeriodoFiltro {
  estado?: string;
}

export interface ReporteEnvioFila {
  codigo_guia: string;
  fecha_creacion: string;
  remitente: string;
  destinatario: string;
  direccion: string;
  localidad: string;
  estado: string;
  ultima_actualizacion: string;
  motivo_fallo: string | null;
}

export interface ReporteEnvios {
  periodo: PeriodoFiltro;
  total: number;
  envios: ReporteEnvioFila[];
}

export interface RankingFila {
  posicion: number;
  repartidor_id: string;
  nombre: string;
  asignados: number;
  entregados: number;
  fallidos: number;
  tasa_efectividad: number;
  promedio_minutos_entrega: number | null;
}

export interface RankingRepartidores {
  periodo: PeriodoFiltro;
  ranking: RankingFila[];
}

export interface DistribucionMotivo {
  motivo: string;
  etiqueta: string;
  cantidad: number;
  porcentaje: number;
}

export interface ReporteIncidencias {
  periodo: PeriodoFiltro;
  total_incidencias: number;
  distribucion: DistribucionMotivo[];
}
