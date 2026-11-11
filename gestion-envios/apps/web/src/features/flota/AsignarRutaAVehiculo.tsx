import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listarRutas } from "@/features/rutas/api";
import { Alert } from "@/components/ui/Alert";
import { Select } from "@/components/ui/Select";
import { getApiErrorMessage } from "@/services/api-client";
import { asignarVehiculoARuta } from "./api";
import type { Vehiculo } from "./types";
import { formatearKg } from "@/utils/numeros";

/**
 * Asigna una ruta del día al vehículo (el mismo vínculo que se edita desde la
 * ruta). Lista las rutas planificadas sin vehículo, las que entran primero.
 */
export function AsignarRutaAVehiculo({ vehiculo, fecha }: { vehiculo: Vehiculo; fecha: string }) {
  const queryClient = useQueryClient();
  const rutas = useQuery({ queryKey: ["rutas", { fecha }], queryFn: () => listarRutas({ fecha }) });
  const asignar = useMutation({
    mutationFn: (rutaId: string) => asignarVehiculoARuta(rutaId, vehiculo.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operaciones", "flota"] });
      await queryClient.invalidateQueries({ queryKey: ["rutas"] });
    },
  });

  if (vehiculo.estado === "mantenimiento") return <p className="text-xs text-gray-400">En mantenimiento: no puede salir a ruta.</p>;
  const libres = (rutas.data ?? [])
    .filter((r) => r.estado === "planificada" && !r.vehiculo_id)
    .sort((a, b) => Number(a.peso_total > vehiculo.capacidad_peso) - Number(b.peso_total > vehiculo.capacidad_peso) || b.peso_total - a.peso_total);
  if (libres.length === 0) return <p className="text-xs text-gray-400">No hay rutas planificadas sin vehículo ese día.</p>;

  return (
    <div className="flex flex-col gap-2">
      <Select
        aria-label={`Asignar una ruta a ${vehiculo.patente}`}
        value=""
        placeholder="Asignar a una ruta…"
        disabled={asignar.isPending}
        onChange={(id) => id && asignar.mutate(id)}
        opciones={libres.map((r) => {
          const noEntra = r.peso_total > vehiculo.capacidad_peso;
          return {
            value: r.id,
            texto: r.nombre,
            label: `${r.nombre} · ${r.repartidor_nombre ?? "sin repartidor"}`,
            disabled: noEntra,
            detalle: noEntra
              ? `No entra: ${formatearKg(r.peso_total)} kg > ${vehiculo.capacidad_peso} kg`
              : `${r.cantidad_envios} envío(s) · ${formatearKg(r.peso_total)} kg · ${Math.round((r.peso_total / vehiculo.capacidad_peso) * 100)}% del vehículo`,
          };
        })}
      />
      {asignar.isError && <Alert variant="error">{getApiErrorMessage(asignar.error, "No se pudo asignar la ruta")}</Alert>}
    </div>
  );
}
