import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actualizarVehiculo, crearVehiculo, listarFlota } from "@/features/flota/api";
import {
  ETIQUETA_ESTADO_VEHICULO,
  ETIQUETA_TIPO_VEHICULO,
  type EstadoVehiculo,
  type TipoVehiculo,
  type Vehiculo,
  type VehiculoInput,
} from "@/features/flota/types";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { InputField, SelectField } from "@/components/ui/Field";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { getApiErrorMessage } from "@/services/api-client";

const VACIO: VehiculoInput = { patente: "", modelo: "", tipo: "camion", capacidad_peso: 3500, capacidad_volumen: 20, estado: "en_base" };

const PUNTO_ESTADO: Record<EstadoVehiculo, string> = { activo: "bg-green-500", en_base: "bg-gray-400", mantenimiento: "bg-red-500" };

function FormVehiculo({ inicial, editando, onListo }: { inicial: VehiculoInput; editando?: string; onListo: () => void }) {
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
  return { patente: v.patente, modelo: v.modelo, tipo: v.tipo, capacidad_peso: v.capacidad_peso, capacidad_volumen: v.capacidad_volumen, estado: v.estado };
}

/** HU-18: alta y estado de los vehículos de la flota. */
export function VehiculosPage() {
  const [nuevo, setNuevo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["operaciones", "flota"], queryFn: () => listarFlota() });

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        title="Vehículos"
        description="La flota: capacidad, estado y la ruta que tiene asignada hoy."
        action={
          !nuevo && (
            <Button type="button" onClick={() => setNuevo(true)}>
              + Nuevo vehículo
            </Button>
          )
        }
      />
      {nuevo && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Nuevo vehículo</h2>
          <FormVehiculo inicial={VACIO} onListo={() => setNuevo(false)} />
        </Card>
      )}
      {isLoading && <Spinner label="Cargando flota…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudo cargar la flota")}</Alert>}
      {data && data.length === 0 && <EmptyState title="Todavía no hay vehículos" />}
      {data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((v) => (
            <Card key={v.id} className="flex flex-col gap-3">
              {editando === v.id ? (
                <FormVehiculo inicial={aInput(v)} editando={v.id} onListo={() => setEditando(null)} />
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-black text-gray-900">{v.patente}</p>
                      <p className="text-sm text-gray-500">
                        {ETIQUETA_TIPO_VEHICULO[v.tipo]} · {v.modelo}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
                      <span className={`h-2 w-2 rounded-full ${PUNTO_ESTADO[v.estado]}`} />
                      {ETIQUETA_ESTADO_VEHICULO[v.estado]}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Carga</span>
                      <span>
                        {v.carga_actual_peso} / {v.capacidad_peso} kg
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-movii-500" style={{ width: `${Math.min(100, v.capacidad_porcentaje)}%` }} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">
                    {v.ruta_id ? (
                      <>
                        Hoy: <Link to={`/rutas/${v.ruta_id}`} className="font-medium text-movii-600 hover:underline">{v.ruta_nombre}</Link> ·{" "}
                        {v.repartidor_nombre} · {v.total_paquetes} paquetes
                      </>
                    ) : (
                      <span className="text-gray-400">Sin ruta asignada hoy</span>
                    )}
                  </p>
                  <div className="mt-auto flex justify-end">
                    <Button type="button" variant="secondary" onClick={() => setEditando(v.id)}>
                      Editar
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
