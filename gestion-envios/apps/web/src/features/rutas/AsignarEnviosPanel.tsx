import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listarEnvios } from "@/features/envios/api";
import { asignarEnvios } from "./api";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/services/api-client";

/** Panel para elegir envíos pendientes y asignarlos a la ruta (HU-04, CA-01/02). */
export function AsignarEnviosPanel({ rutaId, onAsignado }: { rutaId: string; onAsignado: () => void }) {
  const queryClient = useQueryClient();
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const { data: pendientes, isLoading } = useQuery({
    queryKey: ["envios", { estado: "pendiente" }],
    queryFn: () => listarEnvios({ estado: "pendiente" }),
  });

  const mutation = useMutation({
    mutationFn: () => asignarEnvios(rutaId, Array.from(seleccionados)),
    onSuccess: async () => {
      setSeleccionados(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rutas", rutaId] }),
        queryClient.invalidateQueries({ queryKey: ["envios"] }),
      ]);
      onAsignado();
    },
  });

  function toggle(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) return <Spinner label="Cargando envíos pendientes…" />;

  if (!pendientes || pendientes.length === 0) {
    return <EmptyState title="No hay envíos pendientes" description="Todos los envíos ya están asignados a una ruta." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {mutation.isError && <Alert variant="error">{getApiErrorMessage(mutation.error, "No se pudo asignar los envíos")}</Alert>}

      <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {pendientes.map((envio) => (
          <li key={envio.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-movii-500 focus:ring-movii-400"
              checked={seleccionados.has(envio.id)}
              onChange={() => toggle(envio.id)}
            />
            <span className="font-medium text-gray-900">{envio.codigo_guia}</span>
            <span className="text-gray-500">{envio.destinatario}</span>
            <span className="ml-auto text-gray-500">{envio.peso} kg</span>
          </li>
        ))}
      </ul>

      <div>
        <Button
          type="button"
          disabled={seleccionados.size === 0}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Asignar {seleccionados.size > 0 ? `(${seleccionados.size})` : ""}
        </Button>
      </div>
    </div>
  );
}
