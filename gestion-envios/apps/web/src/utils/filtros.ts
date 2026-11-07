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

/** `conRuta`: "con" | "sin" | "" (cuántas rutas tiene según `rutas`). */
export function filtrarRepartidores(
  repartidores: RepartidorOpcion[],
  rutas: RutaListItem[],
  f: { busqueda: string; conRuta: string },
): RepartidorOpcion[] {
  return repartidores.filter((r) => {
    const suyas = rutas.filter((x) => x.repartidor_id === r.id);
    return (
      coincide(f.busqueda, r.nombre, ...suyas.map((x) => x.nombre)) &&
      (!f.conRuta || (f.conRuta === "con") === suyas.length > 0)
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
