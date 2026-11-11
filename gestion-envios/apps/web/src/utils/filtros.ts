import { coincide } from "@/components/ui/BarraFiltros";
import type { Usuario, RepartidorOpcion } from "@/features/usuarios/api";
import type { RutaListItem } from "@/features/rutas/types";
import type { EnvioListItem as Envio } from "@/features/envios/types";

export function filtrarUsuarios(usuarios: Usuario[], f: { busqueda: string; rol: string; estado: string }): Usuario[] {
  return usuarios.filter(
    (u) =>
      coincide(f.busqueda, u.nombre, u.email, u.telefono) &&
      (!f.rol || u.rol === f.rol) &&
      (!f.estado || (f.estado === "activo") === u.activo),
  );
}

/** Situación del repartidor el día `hoy`: libre, con una ruta planificada o ya en ruta. */
export function estadoHoy(suyas: RutaListItem[], hoy: string): "libre" | "planificada" | "en_ruta" {
  const deHoy = suyas.filter((x) => x.fecha === hoy);
  if (deHoy.some((x) => x.estado === "en_curso")) return "en_ruta";
  return deHoy.some((x) => x.estado === "planificada") ? "planificada" : "libre";
}

export interface FiltrosRepartidor {
  busqueda: string;
  conRuta: string;
  /** Zona exacta de alguna de sus rutas; vacío = todas. */
  zona?: string;
  /** "con" | "sin": tiene o no vehículo asignado en alguna de sus rutas. */
  vehiculo?: string;
  /** "libre" | "planificada" | "en_ruta" según `hoy`. */
  hoyEstado?: string;
  hoy?: string;
}

/** `conRuta`: "con" | "sin" | "" (cuántas rutas tiene según `rutas`). */
export function filtrarRepartidores(
  repartidores: RepartidorOpcion[],
  rutas: RutaListItem[],
  f: FiltrosRepartidor,
): RepartidorOpcion[] {
  return repartidores.filter((r) => {
    const suyas = rutas.filter((x) => x.repartidor_id === r.id);
    return (
      coincide(f.busqueda, r.nombre, ...suyas.map((x) => x.nombre), ...suyas.map((x) => x.zona), ...suyas.map((x) => x.vehiculo_patente)) &&
      (!f.conRuta || (f.conRuta === "con") === suyas.length > 0) &&
      (!f.zona || suyas.some((x) => x.zona === f.zona)) &&
      (!f.vehiculo || (f.vehiculo === "con") === suyas.some((x) => Boolean(x.vehiculo_id))) &&
      (!f.hoyEstado || estadoHoy(suyas, f.hoy ?? "") === f.hoyEstado)
    );
  });
}

export function filtrarRutas(rutas: RutaListItem[], f: { busqueda: string; estado: string; repartidor: string }): RutaListItem[] {
  return rutas.filter(
    (r) =>
      coincide(f.busqueda, r.nombre, r.zona, r.repartidor_nombre) &&
      (!f.estado || r.estado === f.estado) &&
      (!f.repartidor || r.repartidor_id === f.repartidor),
  );
}

export function filtrarEnvios(envios: Envio[], busqueda: string): Envio[] {
  return envios.filter((e) => coincide(busqueda, e.codigo_guia, e.destinatario, e.direccion, e.ruta_nombre, e.repartidor_nombre));
}
