import { useQuery } from "@tanstack/react-query";
import { repartidoresSugeridos } from "@/features/usuarios/api";
import { FieldWrapper } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Ruta que se edita: habilita la distancia a sus paradas. */
  rutaId?: string;
  /** Fecha de la ruta (alta): la carga se calcula para ese día. */
  fecha?: string;
}

/**
 * Selector de repartidor con contexto para decidir: rutas y envíos que ya tiene
 * ese día, distancia a la ruta y si ya salió a repartir. El primero de la lista
 * es el sugerido (más cercano y libre).
 */
export function RepartidorSelect({ value, onChange, error, rutaId, fecha }: Props) {
  const { data: repartidores = [], isError } = useQuery({
    queryKey: ["repartidores", "sugeridos", rutaId ?? "", fecha ?? ""],
    queryFn: () => repartidoresSugeridos({ rutaId, fecha }),
  });
  const elegido = repartidores.find((r) => r.id === value);

  return (
    <FieldWrapper
      label="Repartidor *"
      htmlFor="repartidor-select"
      error={error ?? (isError ? "No se pudo cargar la lista de repartidores" : undefined)}
      hint={elegido?.motivo}
    >
      <Select
        id="repartidor-select"
        value={value}
        onChange={onChange}
        invalido={Boolean(error)}
        placeholder="Seleccionar…"
        opciones={repartidores.map((r) => ({
          value: r.id,
          texto: r.nombre,
          label: (
            <span className="flex items-center gap-2">
              {r.nombre}
              {r.recomendado && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">Sugerido</span>}
              {r.actual && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">Actual</span>}
            </span>
          ),
          detalle: r.motivo,
        }))}
      />
    </FieldWrapper>
  );
}
