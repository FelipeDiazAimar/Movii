import { useQuery } from "@tanstack/react-query";
import { listarRepartidores } from "@/features/usuarios/api";
import { SelectField } from "@/components/ui/Field";

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** Selector de repartidor para el alta/edición de rutas (GET /repartidores, disponible para operador y admin). */
export function RepartidorSelect({ value, onChange, error }: Props) {
  const { data: repartidores = [], isError } = useQuery({ queryKey: ["repartidores"], queryFn: listarRepartidores });

  return (
    <SelectField
      label="Repartidor *"
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error ?? (isError ? "No se pudo cargar la lista de repartidores" : undefined)}
    >
      <option value="">Seleccionar…</option>
      {repartidores.map((r) => (
        <option key={r.id} value={r.id}>
          {r.nombre}
        </option>
      ))}
    </SelectField>
  );
}
