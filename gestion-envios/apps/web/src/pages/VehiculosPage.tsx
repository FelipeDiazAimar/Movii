import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { eliminarVehiculo, listarFlota } from "@/features/flota/api";
import { ETIQUETA_ESTADO_VEHICULO, ETIQUETA_TIPO_VEHICULO, type EstadoVehiculo, type Vehiculo, type VehiculoInput } from "@/features/flota/types";
import { BarraFiltros, FiltroSelect } from "@/components/ui/BarraFiltros";
import { DialogoEliminar, usePuedeEliminar } from "@/components/ui/BotonEliminar";
import { MenuAcciones } from "@/components/ui/MenuAcciones";
import { colorDeFlota } from "@/features/flota/colores";
import { filtrarVehiculos } from "@/features/flota/filtros";
import { FormVehiculo } from "@/features/flota/FormVehiculo";
import { EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { SkeletonTarjetas } from "@/components/ui/Skeleton";
import { DateField } from "@/components/ui/Field";
import { AsignarRutaAVehiculo } from "@/features/flota/AsignarRutaAVehiculo";
import { hoyISO } from "@/features/analitica/fechas";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { getApiErrorMessage } from "@/services/api-client";
import { Box, ChevronRight, Gauge, LayoutDashboard, Package, Pencil, Plus, Route, Trash2, Truck, Weight, Wrench, X } from "lucide-react";
import { SpotlightCard } from "@/components/ui/Efectos";
import { VehiculoIllustration } from "@/features/flota/VehiculoIllustration";

const VACIO: VehiculoInput = { patente: "", modelo: "", tipo: "camion", capacidad_peso: 3500, capacidad_volumen: 20, estado: "en_base", color: "" };

const PUNTO_ESTADO: Record<EstadoVehiculo, string> = { activo: "bg-green-500", en_base: "bg-gray-400", mantenimiento: "bg-red-500" };
const ORDEN_ESTADO: Record<EstadoVehiculo, number> = { activo: 0, en_base: 1, mantenimiento: 2 };

function aInput(v: Vehiculo): VehiculoInput {
  return { patente: v.patente, modelo: v.modelo, tipo: v.tipo, capacidad_peso: v.capacidad_peso, capacidad_volumen: v.capacidad_volumen, estado: v.estado, color: v.color };
}

const kg = (n: number) => `${Math.round(n).toLocaleString("es-AR")} kg`;

/** Panel modal para el alta y la edición (el formulario necesita ancho; no entra en una tarjeta). */
function PanelFormulario({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
    };
  }, [onCerrar]);
  // En un portal: el contenedor principal forma su propio contexto de apilamiento y recortaría el fondo.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-[1050] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0" aria-hidden onClick={onCerrar} />
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-hormigon-100 px-5 py-4">
          <h2 className="font-expandida text-lg font-extrabold text-gray-900">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-2 text-gray-500 hover:bg-hormigon-100 hover:text-gray-900">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function Resumen({ vehiculos }: { vehiculos: Vehiculo[] }) {
  const activos = vehiculos.filter((v) => v.estado === "activo");
  const capacidad = activos.reduce((s, v) => s + v.capacidad_peso, 0);
  const carga = activos.reduce((s, v) => s + v.carga_actual_peso, 0);
  const uso = capacidad > 0 ? Math.round((carga / capacidad) * 100) : 0;
  const tiles: Array<{ titulo: string; valor: string; detalle: string; icono: typeof Truck; tono: string }> = [
    { titulo: "En servicio", valor: String(activos.length), detalle: `de ${vehiculos.length} vehículos`, icono: Truck, tono: "bg-movii-500 text-movii-900" },
    { titulo: "En base", valor: String(vehiculos.filter((v) => v.estado === "en_base").length), detalle: "Disponibles para asignar", icono: LayoutDashboard, tono: "bg-hormigon-100 text-gray-700" },
    { titulo: "Mantenimiento", valor: String(vehiculos.filter((v) => v.estado === "mantenimiento").length), detalle: "Fuera de servicio", icono: Wrench, tono: "bg-red-50 text-red-600" },
    { titulo: "Carga en calle", valor: `${uso}%`, detalle: `${kg(carga)} de ${kg(capacidad)}`, icono: Weight, tono: "bg-hormigon-100 text-gray-700" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <SpotlightCard key={t.titulo} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-500">{t.titulo}</p>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.tono}`}>
              <t.icono className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
            </span>
          </div>
          <p className="font-expandida mt-2 text-3xl font-black leading-none text-gray-900">{t.valor}</p>
          <p className="mt-2 truncate text-xs text-gray-500">{t.detalle}</p>
        </SpotlightCard>
      ))}
    </div>
  );
}

function TarjetaVehiculo({ v, color, fecha, onEditar, onEliminar }: { v: Vehiculo; color: string; fecha: string; onEditar: () => void; onEliminar?: () => void }) {
  const enTaller = v.estado === "mantenimiento";
  const uso = Math.min(100, Math.round(v.capacidad_porcentaje));
  return (
    <SpotlightCard className="flex flex-col">
      <div className="relative bg-[radial-gradient(120%_100%_at_70%_0%,#ffffff_0%,#f1f3f5_60%,#e4e7ea_100%)] px-5 pt-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white" style={{ background: enTaller ? "#9ca3af" : color }} aria-hidden />
              <span className="font-expandida truncate text-xl font-black text-gray-900">{v.patente}</span>
            </p>
            <p className="truncate text-sm text-gray-500" title={v.modelo}>
              {ETIQUETA_TIPO_VEHICULO[v.tipo]} · {v.modelo}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-panel">
            <span className={`h-2 w-2 rounded-full ${PUNTO_ESTADO[v.estado]}`} />
            {ETIQUETA_ESTADO_VEHICULO[v.estado]}
          </span>
          <MenuAcciones
            nombre={v.patente}
            className="-mr-2 -mt-1"
            acciones={[
              { etiqueta: "Editar", icono: Pencil, onClick: onEditar },
              { etiqueta: "Ver ruta de hoy", icono: Route, to: v.ruta_id ? `/rutas/${v.ruta_id}` : undefined, oculta: !v.ruta_id },
              { etiqueta: "Ver en operaciones", icono: LayoutDashboard, to: "/operaciones" },
              { etiqueta: "Eliminar vehículo", icono: Trash2, peligro: true, oculta: !onEliminar, onClick: onEliminar },
            ]}
          />
        </div>
        <VehiculoIllustration tipo={v.tipo} containerCode={v.patente} color={enTaller ? "#e9ecef" : color} className={`-mb-2 mt-1 ${enTaller ? "opacity-70 grayscale" : ""}`} />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Weight className="h-3.5 w-3.5" aria-hidden />
              Carga de hoy
            </span>
            <span className="tabular font-medium text-gray-700">
              {kg(v.carga_actual_peso)} / {kg(v.capacidad_peso)} · {uso}%
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-hormigon-100">
            <div className={`h-full rounded-full transition-[width] duration-700 ${uso > 90 ? "bg-red-500" : "bg-movii-500"}`} style={{ width: `${uso}%` }} />
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-hormigon-50 py-2">
            <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
              <Package className="h-3 w-3" aria-hidden />
              Paquetes
            </dt>
            <dd className="font-expandida text-lg font-black text-gray-900">{v.total_paquetes}</dd>
          </div>
          <div className="rounded-xl bg-hormigon-50 py-2">
            <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
              <Box className="h-3 w-3" aria-hidden />
              Volumen
            </dt>
            <dd className="font-expandida text-lg font-black text-gray-900">
              {v.capacidad_volumen}
              <span className="text-xs font-semibold text-gray-400"> m³</span>
            </dd>
          </div>
          <div className="rounded-xl bg-hormigon-50 py-2">
            <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
              <Gauge className="h-3 w-3" aria-hidden />
              Velocidad
            </dt>
            <dd className="font-expandida text-lg font-black text-gray-900">
              {Math.round(v.velocidad)}
              <span className="text-xs font-semibold text-gray-400"> km/h</span>
            </dd>
          </div>
        </dl>
        {v.ruta_id ? (
          <Link
            to={`/rutas/${v.ruta_id}`}
            className="group mt-auto flex items-center gap-3 rounded-xl border border-hormigon-200 p-3 text-sm transition-colors hover:border-hormigon-300 hover:bg-hormigon-50"
          >
            <Route className="h-4 w-4 shrink-0 text-movii-600" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-gray-900">{v.ruta_nombre}</span>
              <span className="block truncate text-xs text-gray-500">
                {v.repartidor_nombre} · {v.paquetes_entregados} de {v.total_paquetes} entregados
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : (
          <div className="mt-auto flex flex-col gap-2">
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-hormigon-200 p-3 text-sm text-gray-400">
              <Route className="h-4 w-4 shrink-0" aria-hidden />
              {enTaller ? "En el taller: no se puede asignar" : `Sin ruta asignada ${fecha === hoyISO() ? "hoy" : "ese día"}`}
            </div>
            {!enTaller && <AsignarRutaAVehiculo vehiculo={v} fecha={fecha} />}
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}

/** HU-18: alta y estado de los vehículos de la flota. */
export function VehiculosPage() {
  const puedeEliminar = usePuedeEliminar();
  const [form, setForm] = useState<{ modo: "nuevo" } | { modo: "editar"; v: Vehiculo } | null>(null);
  const [aEliminar, setAEliminar] = useState<Vehiculo | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["operaciones", "flota", "fecha", fecha], queryFn: () => listarFlota(fecha) });
  const colores = useMemo(() => colorDeFlota(data ?? []), [data]);
  const visibles = useMemo(
    () =>
      (data ? filtrarVehiculos(data, { busqueda, estado, tipo }) : []).sort(
        (a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.patente.localeCompare(b.patente),
      ),
    [data, busqueda, estado, tipo],
  );
  const conteo = (e: string) => (data ?? []).filter((v) => !e || v.estado === e).length;
  const cerrarForm = () => setForm(null);

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        title="Vehículos"
        icon={Truck}
        description="La flota: estado, carga y la ruta que tiene asignada cada vehículo el día elegido."
        action={
          <Button type="button" onClick={() => setForm({ modo: "nuevo" })}>
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Nuevo vehículo
          </Button>
        }
      />

      {isLoading && <SkeletonTarjetas label="Cargando flota…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudo cargar la flota")}</Alert>}
      {data && data.length === 0 && (
        <EmptyState title="Todavía no hay vehículos" description="Cargá el primero con el botón Nuevo vehículo." />
      )}

      {data && data.length > 0 && (
        <>
          <Resumen vehiculos={data} />
          <div role="tablist" aria-label="Estado" className="flex w-fit max-w-full flex-wrap rounded-2xl bg-hormigon-100 p-1">
            {(["", "activo", "en_base", "mantenimiento"] as const).map((e) => (
              <button
                key={e || "todos"}
                type="button"
                role="tab"
                aria-selected={estado === e}
                onClick={() => setEstado(e)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  estado === e ? "bg-white text-gray-900 shadow-panel" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {e && <span className={`h-2 w-2 rounded-full ${PUNTO_ESTADO[e]}`} aria-hidden />}
                {e ? ETIQUETA_ESTADO_VEHICULO[e] : "Todos"}
                <span className={`tabular rounded-full px-1.5 text-[11px] ${estado === e ? "bg-movii-500 text-movii-900" : "bg-hormigon-200 text-gray-600"}`}>{conteo(e)}</span>
              </button>
            ))}
          </div>
          <BarraFiltros
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            placeholder="Buscar por patente, modelo, chofer o ruta…"
            hayFiltros={Boolean(busqueda || tipo || estado || fecha !== hoyISO())}
            onLimpiar={() => {
              setBusqueda("");
              setEstado("");
              setTipo("");
              setFecha(hoyISO());
            }}
            resumen={`${visibles.length} de ${data.length}`}
          >
            <DateField label="Fecha" value={fecha} onChange={(v) => setFecha(v || hoyISO())} />
            <FiltroSelect label="Tipo" value={tipo} onChange={setTipo}>
              <option value="">Todos</option>
              {Object.entries(ETIQUETA_TIPO_VEHICULO).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </FiltroSelect>
          </BarraFiltros>
        </>
      )}

      {data && data.length > 0 && visibles.length === 0 && <EmptyState title="Ningún vehículo coincide con la búsqueda" />}
      {visibles.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((v) => (
            <TarjetaVehiculo
              key={v.id}
              v={v}
              color={colores[v.id]}
              fecha={fecha}
              onEditar={() => setForm({ modo: "editar", v })}
              onEliminar={puedeEliminar ? () => setAEliminar(v) : undefined}
            />
          ))}
        </div>
      )}

      {form && (
        <PanelFormulario titulo={form.modo === "nuevo" ? "Nuevo vehículo" : `Editar ${form.v.patente}`} onCerrar={cerrarForm}>
          {form.modo === "nuevo" ? (
            <FormVehiculo inicial={VACIO} onListo={cerrarForm} />
          ) : (
            <FormVehiculo inicial={aInput(form.v)} editando={form.v.id} autoColor={colores[form.v.id]} onListo={cerrarForm} />
          )}
        </PanelFormulario>
      )}
      {aEliminar && (
        <DialogoEliminar
          nombre={aEliminar.patente}
          eliminar={() => eliminarVehiculo(aEliminar.id)}
          invalidar={[["operaciones", "flota"]]}
          onCerrar={() => setAEliminar(null)}
        />
      )}
    </div>
  );
}
