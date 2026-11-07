import { useState } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/services/api-client";
import { Button } from "./Button";
import { Alert } from "./Alert";

interface BotonEliminarProps {
  /** Nombre o código que se muestra en la confirmación. */
  nombre: string;
  eliminar: () => Promise<unknown>;
  /** Query keys a invalidar tras borrar. */
  invalidar?: QueryKey[];
  onEliminado?: () => void;
}

/** Botón de borrado con confirmación; solo visible para el rol admin. */
export function BotonEliminar({ nombre, eliminar, invalidar = [], onEliminado }: BotonEliminarProps) {
  const { sesion } = useAuth();
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);

  const mutacion = useMutation({
    mutationFn: eliminar,
    onSuccess: async () => {
      await Promise.all(invalidar.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      setAbierto(false);
      onEliminado?.();
    },
  });

  if (sesion?.rol !== "admin") return null;

  const cerrar = () => {
    mutacion.reset();
    setAbierto(false);
  };

  return (
    <>
      <Button type="button" variant="ghost" title={`Eliminar ${nombre}`} aria-label={`Eliminar ${nombre}`} onClick={() => setAbierto(true)} className="!px-2.5 text-red-600 hover:bg-red-50">
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
      {abierto && (
        <div role="dialog" aria-modal="true" aria-label="Confirmar eliminación" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-sm text-gray-800">¿Eliminar {nombre}? Esta acción no se puede deshacer.</p>
            {mutacion.isError && <Alert variant="error">{getApiErrorMessage(mutacion.error, "No se pudo eliminar")}</Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={cerrar} disabled={mutacion.isPending}>Cancelar</Button>
              <Button type="button" variant="danger" loading={mutacion.isPending} onClick={() => mutacion.mutate()}>Eliminar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
