import { coincide } from "@/components/ui/BarraFiltros";
import type { Vehiculo } from "./types";

export interface FiltrosVehiculo {
  busqueda: string;
  estado: string;
  tipo: string;
}

/** Busca por patente, modelo, chofer o ruta; estado y tipo vacíos = todos. */
export function filtrarVehiculos(vs: Vehiculo[], f: FiltrosVehiculo): Vehiculo[] {
  return vs.filter(
    (v) =>
      (!f.estado || v.estado === f.estado) &&
      (!f.tipo || v.tipo === f.tipo) &&
      coincide(f.busqueda, v.patente, v.modelo, v.repartidor_nombre, v.ruta_nombre),
  );
}
