import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actualizarVehiculo, crearVehiculo, eliminarVehiculo, listarFlota } from "@/features/flota/api";
import {
  ETIQUETA_ESTADO_VEHICULO,
  ETIQUETA_TIPO_VEHICULO,
  type EstadoVehiculo,
  type TipoVehiculo,
  type Vehiculo,
  type VehiculoInput,
} from "@/features/flota/types";
import { BarraFiltros } from "@/components/ui/BarraFiltros";
import { BotonEliminar } from "@/components/ui/BotonEliminar";
import { colorDeFlota } from "@/features/flota/colores";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { filtrarVehiculos } from "@/features/flota/filtros";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { InputField, SelectField } from "@/components/ui/Field";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { getApiErrorMessage } from "@/services/api-client";

import { Box, Gauge, Package, Pencil, Plus, Route, Truck, Weight } from "lucide-react";
import { SpotlightCard } from "@/components/ui/Efectos";
import { VehiculoIllustration } from "@/features/flota/VehiculoIllustration";
const VACIO: VehiculoInput = { patente: "", modelo: "", tipo: "camion", capacidad_peso: 3500, capacidad_volumen: 20, estado: "en_base", color: "" };

const PUNTO_ESTADO: Record<EstadoVehiculo, string> = { activo: "bg-green-500", en_base: "bg-gray-400", mantenimiento: "bg-red-500" };

function FormVehiculo({ inicial, editando, autoColor, onListo }: { inicial: VehiculoInput; editando?: string; autoColor: string; onListo: () => void }) {
  const queryClient = useQueryClient();
  const [v, setV] = useState<VehiculoInput>(inicial);
  const guardar = useMutation({
    mutationFn: () => (editando ? actualizarVehiculo(editando, v) : crearVehiculo(v)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operaciones", "flota"] });
      onListo();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" noValidate>
      {/* Vista previa: cambia sola al elegir el tipo y el color */}
      <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(120%_100%_at_70%_0%,#ffffff_0%,#f1f3f5_60%,#e4e7ea_100%)] px-4 pt-3 sm:col-span-2 lg:col-span-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Vista previa</p>
        <VehiculoIllustration
          key={v.tipo}
          tipo={v.tipo}
          containerCode={v.patente || "PATENTE"}
          color={v.estado === "mantenimiento" ? "#e9ecef" : v.color || autoColor}
          className={`mx-auto -mb-2 max-w-md ${v.estado === "mantenimiento" ? "opacity-70 grayscale" : ""}`}
        />
      </div>
      <InputField
        label="Patente"
        required
        disabled={Boolean(editando)}
        placeholder="AB123CD"
        value={v.patente}
        onChange={(e) => setV({ ...v, patente: e.target.value.toUpperCase() })}
      />
      <InputField label="Modelo" required placeholder="Mercedes-Benz Accelo 1016" value={v.modelo} onChange={(e) => setV({ ...v, modelo: e.target.value })} />
      <SelectField label="Tipo" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as TipoVehiculo })}>
        {Object.entries(ETIQUETA_TIPO_VEHICULO).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </SelectField>
      <InputField
        label="Capacidad (kg)"
        type="number"
        min={1}
        value={v.capacidad_peso}
        onChange={(e) => setV({ ...v, capacidad_peso: Number(e.target.value) })}
      />
      <InputField
        label="Volumen (m³)"
        type="number"
        min={1}
        step="0.5"
        value={v.capacidad_volumen}
        onChange={(e) => setV({ ...v, capacidad_volumen: Number(e.target.value) })}
      />
      <SelectField label="Estado" value={v.estado} onChange={(e) => setV({ ...v, estado: e.target.value as EstadoVehiculo })}>
        {Object.entries(ETIQUETA_ESTADO_VEHICULO).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </SelectField>
      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
        <span className="text-sm font-medium text-gray-700">Color</span>
        <ColorPicker value={v.color ?? ""} onChange={(color) => setV({ ...v, color })} automatico={autoColor} />
        <p className="text-xs text-gray-500">Se usa en el vehículo, en su ruta y en el marcador del mapa del panel.</p>
      </div>
      {guardar.isError && (
        <div className="sm:col-span-2 lg:col-span-3">
          <Alert variant="error">{getApiErrorMessage(guardar.error, "No se pudo guardar el vehículo")}</Alert>
        </div>
      )}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" loading={guardar.isPending}>
          {editando ? "Guardar cambios" : "Agregar vehículo"}
        </Button>
        <Button type="button" variant="ghost" onClick={onListo}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function aInput(v: Vehiculo): VehiculoInput {
  return { patente: v.patente, modelo: v.modelo, tipo: v.tipo, capacidad_peso: v.capacidad_peso, capacidad_volumen: v.capacidad_volumen, estado: v.estado, color: v.color };
}

/** HU-18: alta y estado de los vehículos de la flota. */
export function VehiculosPage() {
  const [nuevo, setNuevo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["operaciones", "flota"], queryFn: () => listarFlota() });
  const colores = useMemo(() => colorDeFlota(data ?? []), [data]);
  const colorNuevo = useMemo(() => colorDeFlota([...(data ?? []), { id: "nuevo" }]).nuevo, [data]);
  const visibles = data ? filtrarVehiculos(data, { busqueda, estado, tipo }) : [];
  const hayFiltros = Boolean(busqueda || estado || tipo);
  const limpiar = () => {
    setBusqueda("");
    setEstado("");
    setTipo("");
  };

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        title="Vehículos" icon={Truck}
        description="La flota: capacidad, estado y la ruta que tiene asignada hoy."
        action={
          !nuevo && (
            <Button type="button" onClick={() => setNuevo(true)}>
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              Nuevo vehículo
            </Button>
          )
        }
      />
      {nuevo && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Nuevo vehículo</h2>
          <FormVehiculo inicial={VACIO} autoColor={colorNuevo} onListo={() => setNuevo(false)} />
        </Card>
      )}
      {isLoading && <Spinner label="Cargando flota…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudo cargar la flota")}</Alert>}
      {data && data.length === 0 && <EmptyState title="Todavía no hay vehículos" />}
      {data && data.length > 0 && (
        <BarraFiltros
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por patente, modelo, chofer o ruta…"
          hayFiltros={hayFiltros}
          onLimpiar={limpiar}
          resumen={`${visibles.length} de ${data.length}`}
        >
          <SelectField label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ETIQUETA_ESTADO_VEHICULO).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ETIQUETA_TIPO_VEHICULO).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </SelectField>
        </BarraFiltros>
      )}
      {data && data.length > 0 && visibles.length === 0 && <EmptyState title="Ningún vehículo coincide con la búsqueda" />}
      {visibles.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((v) => (
            <SpotlightCard key={v.id} className="flex flex-col">
              {editando === v.id ? (
                <div className="p-5">
                  <FormVehiculo inicial={aInput(v)} editando={v.id} autoColor={colores[v.id]} onListo={() => setEditando(null)} />
                </div>
              ) : (
                <>
                  <div className="relative bg-[radial-gradient(120%_100%_at_70%_0%,#ffffff_0%,#f1f3f5_60%,#e4e7ea_100%)] px-5 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-expandida text-xl font-black text-gray-900">{v.patente}</p>
                        <p className="text-sm text-gray-500">
                          {ETIQUETA_TIPO_VEHICULO[v.tipo]}, {v.modelo}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-panel">
                        <span className={`h-2 w-2 rounded-full ${PUNTO_ESTADO[v.estado]}`} />
                        {ETIQUETA_ESTADO_VEHICULO[v.estado]}
                      </span>
                    </div>
                    <VehiculoIllustration
                      tipo={v.tipo}
                      containerCode={v.patente}
                      color={v.estado === "mantenimiento" ? "#e9ecef" : colores[v.id]}
                      className={`-mb-2 mt-1 ${v.estado === "mantenimiento" ? "opacity-70 grayscale" : ""}`}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Weight className="h-3.5 w-3.5" aria-hidden />
                          Carga
                        </span>
                        <span className="tabular font-medium text-gray-700">
                          {v.carga_actual_peso} de {v.capacidad_peso} kg
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-hormigon-100">
                        <div className="h-full rounded-full bg-movii-500 transition-[width] duration-700" style={{ width: `${Math.min(100, v.capacidad_porcentaje)}%` }} />
                      </div>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-hormigon-50 py-2">
                        <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-500"><Package className="h-3 w-3" aria-hidden />Paquetes</dt>
                        <dd className="font-expandida text-lg font-black text-gray-900">{v.total_paquetes}</dd>
                      </div>
                      <div className="rounded-xl bg-hormigon-50 py-2">
                        <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-500"><Box className="h-3 w-3" aria-hidden />Volumen</dt>
                        <dd className="font-expandida text-lg font-black text-gray-900">{v.capacidad_volumen}<span className="text-xs font-semibold text-gray-400"> m³</span></dd>
                      </div>
                      <div className="rounded-xl bg-hormigon-50 py-2">
                        <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-500"><Gauge className="h-3 w-3" aria-hidden />Velocidad</dt>
                        <dd className="font-expandida text-lg font-black text-gray-900">{Math.round(v.velocidad)}<span className="text-xs font-semibold text-gray-400"> km/h</span></dd>
                      </div>
                    </dl>
                    <div className="flex items-center gap-3 rounded-xl border border-hormigon-200 p-3 text-sm">
                      <Route className="h-4 w-4 shrink-0 text-movii-600" aria-hidden />
                      {v.ruta_id ? (
                        <p className="min-w-0 flex-1 truncate text-gray-700">
                          <Link to={`/rutas/${v.ruta_id}`} className="font-semibold text-gray-900 hover:underline">
                            {v.ruta_nombre}
                          </Link>
                          <span className="text-gray-500"> con {v.repartidor_nombre}</span>
                        </p>
                      ) : (
                        <p className="flex-1 text-gray-400">Sin ruta asignada hoy</p>
                      )}
                    </div>
                    <div className="mt-auto flex justify-end gap-2">
                      <BotonEliminar nombre={v.patente} eliminar={() => eliminarVehiculo(v.id)} invalidar={[["operaciones", "flota"]]} />
                      <Button type="button" variant="secondary" onClick={() => setEditando(v.id)}>
                        <Pencil className="h-4 w-4" aria-hidden />
                        Editar
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </SpotlightCard>
          ))}
        </div>
      )}
    </div>
  );
}
