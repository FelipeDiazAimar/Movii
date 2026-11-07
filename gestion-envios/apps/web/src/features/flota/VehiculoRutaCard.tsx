import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Select } from "@/components/ui/Select";
import { getApiErrorMessage } from "@/services/api-client";
import { asignarVehiculoARuta, listarFlota } from "./api";
import { ETIQUETA_ESTADO_VEHICULO } from "./types";

/** Vehículo con el que se recorre la ruta (HU-18) y acceso al mapa (HU-12). */
export function VehiculoRutaCard({ rutaId, fecha }: { rutaId: string; fecha: string }) {
  const queryClient = useQueryClient();
  const flota = useQuery({ queryKey: ["operaciones", "flota", "fecha", fecha], queryFn: () => listarFlota(fecha) });
  const asignar = useMutation({
    mutationFn: (vehiculoId: string) => asignarVehiculoARuta(rutaId, vehiculoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["operaciones", "flota"] }),
  });

  const vehiculos = flota.data ?? [];
  const actual = vehiculos.find((v) => v.ruta_id === rutaId);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Vehículo</h2>
        <Link to={`/rutas/${rutaId}/mapa`} className="text-xs font-semibold text-movii-600 hover:underline">
          Ver en el mapa →
        </Link>
      </div>
      <div className="mt-3">
        <Select
          aria-label="Vehículo de la ruta"
          disabled={flota.isLoading || asignar.isPending}
          value={actual?.id ?? ""}
          onChange={(id) => asignar.mutate(id)}
          opciones={[
            { value: "", label: "Sin vehículo" },
            ...vehiculos.map((v) => {
              const ocupado = Boolean(v.ruta_id) && v.ruta_id !== rutaId;
              const taller = v.estado === "mantenimiento";
              return {
                value: v.id,
                label: `${v.patente} — ${v.modelo} (${v.capacidad_peso} kg)`,
                disabled: ocupado || taller,
                detalle: ocupado ? `Ocupado en ${v.ruta_nombre}` : taller ? ETIQUETA_ESTADO_VEHICULO.mantenimiento : undefined,
              };
            }),
          ]}
        />
      </div>
      {actual && (
        <p className="mt-2 text-xs text-gray-500">
          Carga {actual.carga_actual_peso} de {actual.capacidad_peso} kg ({actual.capacidad_porcentaje}%)
        </p>
      )}
      {asignar.isError && (
        <div className="mt-2">
          <Alert variant="error">{getApiErrorMessage(asignar.error, "No se pudo asignar el vehículo")}</Alert>
        </div>
      )}
    </Card>
  );
}
