import { useQuery } from "@tanstack/react-query";
import { listarUsuarios } from "@/features/usuarios/api";
import { InputField, SelectField } from "@/components/ui/Field";

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * Selector de repartidor para el alta/edición de rutas. `GET /users` es
 * solo para supervisor (ver services/api/internal/httprouter/router.go); un
 * operador logueado recibe 403 ahí. En ese caso no hay forma de listar
 * repartidores desde el panel todavía, así que se degrada a un campo de texto
 * para pegar el UUID del repartidor a mano.
 */
export function RepartidorSelect({ value, onChange, error }: Props) {
  const { data: usuarios, isError } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listarUsuarios,
    retry: false,
  });

  if (isError || !usuarios) {
    return (
      <InputField
        label="ID del repartidor *"
        required
        placeholder="UUID del usuario repartidor"
        hint="Tu rol no puede listar usuarios; pedile el ID a un supervisor."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
      />
    );
  }

  const repartidores = usuarios.filter((u) => u.rol === "repartidor" && u.activo);

  return (
    <SelectField label="Repartidor *" required value={value} onChange={(e) => onChange(e.target.value)} error={error}>
      <option value="">Seleccionar…</option>
      {repartidores.map((r) => (
        <option key={r.id} value={r.id}>
          {r.nombre} ({r.email})
        </option>
      ))}
    </SelectField>
  );
}
