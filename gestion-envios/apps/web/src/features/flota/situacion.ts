import type { Vehiculo } from "./types";

export type CodigoSituacion = "en_camino" | "esperando" | "terminada" | "sin_paquetes" | "sin_ruta" | "mantenimiento";

export interface Situacion {
  codigo: CodigoSituacion;
  etiqueta: string;
  /** Texto corto bajo la patente. */
  detalle: string;
  /** Orden en la lista: lo que se está moviendo primero. */
  prioridad: number;
}

type DatosVehiculo = Pick<Vehiculo, "estado" | "ruta_id" | "total_paquetes" | "paquetes_entregados" | "paquetes_fallidos" | "paquetes_en_camino">;

/** En qué está hoy un vehículo, a partir del estado de los envíos de su ruta. */
export function situacionVehiculo(v: DatosVehiculo): Situacion {
  if (v.estado === "mantenimiento") return { codigo: "mantenimiento", etiqueta: "Mantenimiento", detalle: "Fuera de servicio", prioridad: 5 };
  if (!v.ruta_id) return { codigo: "sin_ruta", etiqueta: "Sin ruta", detalle: "Disponible", prioridad: 4 };
  const enCamino = v.paquetes_en_camino ?? 0;
  const pendientes = v.total_paquetes - v.paquetes_entregados - v.paquetes_fallidos;
  if (enCamino > 0) return { codigo: "en_camino", etiqueta: "En camino", detalle: `${enCamino} de ${v.total_paquetes} en la calle`, prioridad: 0 };
  if (pendientes > 0) return { codigo: "esperando", etiqueta: "Sin salir", detalle: `${pendientes} paq. esperando salida`, prioridad: 1 };
  if (v.total_paquetes > 0) {
    const fallidos = v.paquetes_fallidos ? `, ${v.paquetes_fallidos} fallidos` : "";
    return { codigo: "terminada", etiqueta: "Ruta terminada", detalle: `${v.paquetes_entregados} entregados${fallidos}`, prioridad: 3 };
  }
  return { codigo: "sin_paquetes", etiqueta: "Sin paquetes", detalle: "Ruta vacía", prioridad: 2 };
}

/** Cuántos vehículos hay en cada situación (para el resumen del encabezado). */
export function contarSituaciones(vehiculos: DatosVehiculo[]): Record<CodigoSituacion, number> {
  const cuenta: Record<CodigoSituacion, number> = { en_camino: 0, esperando: 0, terminada: 0, sin_paquetes: 0, sin_ruta: 0, mantenimiento: 0 };
  for (const v of vehiculos) cuenta[situacionVehiculo(v).codigo]++;
  return cuenta;
}
