import { mapEnvioDelDiaToShipment, type EstadoEnvioAPI, type ResumenDelDiaAPI } from "@/lib/api-client";
import type { Shipment } from "@/types/logistics";

export type { EstadoEnvioAPI, ResumenDelDiaAPI };

/** Una ruta del día con sus envíos ya adaptados a la forma del prototipo. */
export type RutaDelDia = {
  rutaId: string;
  rutaNombre: string;
  envios: Shipment[];
};

/** Contadores del resumen del día que muestra la vista del repartidor. */
export type ContadoresDelDia = {
  total: number;
  entregados: number;
  pendientes: number;
  noEntregados: number;
  progreso: number;
};

const DRIVER_ID_REAL = "drv-real";

/**
 * agruparEnviosPorRuta arma una sección por cada ruta del día (CA-03 de
 * HU-05), numerando las paradas desde 1 dentro de cada ruta.
 *
 * `rutas` puede llegar vacío: es un repartidor sin nada asignado hoy, no un
 * error. Se tolera además que llegue nulo, que es lo que devolvía la API antes
 * de que se corrigiera la serialización del slice vacío — con null la pantalla
 * mostraba "no se pudo cargar la ruta del día" en vez del estado vacío.
 */
export function agruparEnviosPorRuta(resumen: ResumenDelDiaAPI | null): RutaDelDia[] {
  if (!resumen?.rutas) return [];

  return resumen.rutas.map((ruta) => ({
    rutaId: ruta.ruta_id,
    rutaNombre: ruta.ruta_nombre,
    envios: ruta.envios.map((envio, indice) => mapEnvioDelDiaToShipment(envio, DRIVER_ID_REAL, indice + 1)),
  }));
}

/**
 * filtrarPorEstado deja solo los envíos en el estado pedido (CA-04 de HU-05) y
 * descarta las rutas que quedan sin ninguno. Filtra por `estadoApi` y no por
 * `status`, porque el prototipo colapsa "asignado" en el badge "pendiente" y
 * con `status` el filtro de "Asignados" no encontraría nada.
 */
export function filtrarPorEstado(rutas: RutaDelDia[], estado: EstadoEnvioAPI | null): RutaDelDia[] {
  if (!estado) return rutas;

  return rutas
    .map((ruta) => ({ ...ruta, envios: ruta.envios.filter((envio) => envio.estadoApi === estado) }))
    .filter((ruta) => ruta.envios.length > 0);
}

/**
 * contadoresDelDia calcula el resumen del día (CA-05 de HU-05) sobre el total
 * de envíos, no sobre lo que quedó a la vista después de aplicar un filtro: el
 * resumen tiene que seguir describiendo el día entero.
 *
 * "Pendientes" es todo lo que todavía no se cerró (pendiente + asignado + en
 * camino), que es lo que al repartidor le queda por hacer.
 */
export function contadoresDelDia(resumen: ResumenDelDiaAPI | null): ContadoresDelDia {
  const total = resumen?.total ?? 0;
  const entregados = resumen?.entregados ?? 0;
  const noEntregados = resumen?.no_entregados ?? 0;

  return {
    total,
    entregados,
    noEntregados,
    pendientes: Math.max(total - entregados - noEntregados, 0),
    progreso: total === 0 ? 0 : Math.round((entregados / total) * 100),
  };
}
