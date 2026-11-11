import { useId, useState, type FormEvent } from "react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { actualizarVehiculo, crearVehiculo } from "./api";
import { ETIQUETA_ESTADO_VEHICULO, ETIQUETA_TIPO_VEHICULO, type EstadoVehiculo, type TipoVehiculo, type VehiculoInput } from "./types";
import { colorAutomatico } from "./colores";
import { VehiculoIllustration } from "./VehiculoIllustration";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { InputField, SelectField } from "@/components/ui/Field";
import { getApiErrorMessage, type ApiErrorBody } from "@/services/api-client";
import { limpiarDecimalAlEscribir, limpiarPatenteAlEscribir, soloDigitos } from "@/utils/mascaras";

const PATENTE_VALIDA = /^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/;

type ErroresVehiculo = Partial<Record<"patente" | "modelo" | "capacidad_peso" | "capacidad_volumen", string>>;

function codigoDeError(error: unknown): string | undefined {
  return axios.isAxiosError<ApiErrorBody>(error) ? error.response?.data?.error?.code : undefined;
}

export function FormVehiculo({ inicial, editando, autoColor, onListo }: { inicial: VehiculoInput; editando?: string; autoColor?: string; onListo: () => void }) {
  const queryClient = useQueryClient();
  const uid = useId();
  const [v, setV] = useState<VehiculoInput>(inicial);
  // Las capacidades se escriben como texto: así borrar el campo no deja un
  // `Number("") === 0` silencioso y el entero/decimal se valida al guardar.
  const [pesoTxt, setPesoTxt] = useState(inicial.capacidad_peso ? String(inicial.capacidad_peso) : "");
  const [volumenTxt, setVolumenTxt] = useState(inicial.capacidad_volumen ? String(inicial.capacidad_volumen) : "");
  const [errores, setErrores] = useState<ErroresVehiculo>({});
  const guardar = useMutation({
    mutationFn: (input: VehiculoInput) => (editando ? actualizarVehiculo(editando, input) : crearVehiculo(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operaciones", "flota"] });
      onListo();
    },
    onError: (err) => {
      // La patente repetida se marca en su campo, no en un cartel general.
      if (codigoDeError(err) === "patente_en_uso") setErrores((prev) => ({ ...prev, patente: "Ya existe un vehículo con esa patente." }));
    },
  });
  // Un vehículo nuevo toma el color automático de su patente (el mismo que tendrá en la flota).
  const colorAuto = autoColor ?? colorAutomatico(v.patente || "nuevo");
  const errorGeneral = guardar.isError && codigoDeError(guardar.error) !== "patente_en_uso";

  // Al corregir un campo se borra su error.
  function cambiar<K extends keyof VehiculoInput>(campo: K, valor: VehiculoInput[K]) {
    setV((prev) => ({ ...prev, [campo]: valor }));
    if (campo in errores) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  function cambiarTexto(campo: "capacidad_peso" | "capacidad_volumen", valor: string, set: (s: string) => void) {
    set(valor);
    if (campo in errores) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const nuevos: ErroresVehiculo = {};
    const patente = v.patente.trim();
    if (!editando) {
      if (!patente) nuevos.patente = "Ingresá la patente.";
      else if (!PATENTE_VALIDA.test(patente)) nuevos.patente = "Patente inválida. Usá un formato como AB123CD, ABC123 o TRK-318.";
    }
    const modelo = v.modelo.trim();
    if (!modelo) nuevos.modelo = "Ingresá el modelo.";
    else if (modelo.length > 60) nuevos.modelo = "El modelo no puede superar los 60 caracteres.";

    const peso = pesoTxt.trim() === "" ? NaN : Number(pesoTxt.trim());
    if (!Number.isInteger(peso) || peso < 1 || peso > 40000) {
      nuevos.capacidad_peso = "La capacidad tiene que ser un número entero entre 1 y 40000 kg.";
    }
    const volumen = volumenTxt.trim() === "" ? NaN : Number(volumenTxt.trim().replace(",", "."));
    if (!(volumen >= 0.5) || volumen > 120 || Math.abs(volumen * 2 - Math.round(volumen * 2)) > 1e-9) {
      nuevos.capacidad_volumen = "El volumen tiene que estar entre 0,5 y 120 m³, de a 0,5.";
    }

    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;
    guardar.mutate({ ...v, patente, modelo, capacidad_peso: peso, capacidad_volumen: volumen });
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
          color={v.estado === "mantenimiento" ? "#e9ecef" : v.color || colorAuto}
          className={`mx-auto -mb-2 max-w-md ${v.estado === "mantenimiento" ? "opacity-70 grayscale" : ""}`}
        />
      </div>
      <InputField
        id={`${uid}-patente`}
        name="patente"
        label="Patente"
        required
        disabled={Boolean(editando)}
        placeholder="AB123CD"
        maxLength={9}
        autoComplete="off"
        value={v.patente}
        error={errores.patente}
        onChange={(e) => cambiar("patente", limpiarPatenteAlEscribir(e.target.value))}
      />
      <InputField
        id={`${uid}-modelo`}
        name="modelo"
        label="Modelo"
        required
        placeholder="Mercedes-Benz Accelo 1016"
        maxLength={60}
        autoComplete="off"
        value={v.modelo}
        error={errores.modelo}
        onChange={(e) => cambiar("modelo", e.target.value)}
      />
      <SelectField id={`${uid}-tipo`} label="Tipo" value={v.tipo} onChange={(e) => cambiar("tipo", e.target.value as TipoVehiculo)}>
        {Object.entries(ETIQUETA_TIPO_VEHICULO).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </SelectField>
      <InputField
        id={`${uid}-peso`}
        label="Capacidad (kg)"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="3500"
        value={pesoTxt}
        error={errores.capacidad_peso}
        onChange={(e) => cambiarTexto("capacidad_peso", soloDigitos(e.target.value, 5), setPesoTxt)}
      />
      <InputField
        id={`${uid}-volumen`}
        label="Volumen (m³)"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="20"
        value={volumenTxt}
        error={errores.capacidad_volumen}
        onChange={(e) => cambiarTexto("capacidad_volumen", limpiarDecimalAlEscribir(e.target.value), setVolumenTxt)}
      />
      <SelectField id={`${uid}-estado`} label="Estado" value={v.estado} onChange={(e) => cambiar("estado", e.target.value as EstadoVehiculo)}>
        {Object.entries(ETIQUETA_ESTADO_VEHICULO).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </SelectField>
      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
        <span className="text-sm font-medium text-gray-700">Color</span>
        <ColorPicker value={v.color ?? ""} onChange={(color) => cambiar("color", color)} automatico={colorAuto} />
        <p className="text-xs text-gray-500">Se usa en el vehículo, en su ruta y en el marcador del mapa del panel.</p>
      </div>
      {errorGeneral && (
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
