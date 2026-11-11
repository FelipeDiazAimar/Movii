import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/services/api-client";
import { Button } from "./Button";
import { Alert } from "./Alert";

interface EliminarProps {
  /** Nombre o código que se muestra en la confirmación. */
  nombre: string;
  eliminar: () => Promise<unknown>;
  /** Query keys a invalidar tras borrar. */
  invalidar?: QueryKey[];
  onEliminado?: () => void;
}

/** true si la sesión puede borrar (solo admin). */
export function usePuedeEliminar(): boolean {
  const { sesion } = useAuth();
  return sesion?.rol === "admin";
}

/** Diálogo de confirmación de borrado, controlado desde afuera (menús de acciones). */
export function DialogoEliminar({ nombre, eliminar, invalidar = [], onEliminado, onCerrar }: EliminarProps & { onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const mutacion = useMutation({
    mutationFn: eliminar,
    onSuccess: async () => {
      await Promise.all(invalidar.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      onCerrar();
      onEliminado?.();
    },
  });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar eliminación"
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !mutacion.isPending) onCerrar();
      }}
    >
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Trash2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-gray-900">¿Eliminar {nombre}?</p>
            <p className="mt-1 text-sm text-gray-600">Esta acción no se puede deshacer.</p>
          </div>
        </div>
        {mutacion.isError && <Alert variant="error">{getApiErrorMessage(mutacion.error, "No se pudo eliminar")}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" autoFocus onClick={onCerrar} disabled={mutacion.isPending}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" loading={mutacion.isPending} onClick={() => mutacion.mutate()}>
            Eliminar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Botón de borrado con confirmación; solo visible para el rol admin. */
export function BotonEliminar(props: EliminarProps) {
  const puede = usePuedeEliminar();
  const [abierto, setAbierto] = useState(false);
  if (!puede) return null;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        title={`Eliminar ${props.nombre}`}
        aria-label={`Eliminar ${props.nombre}`}
        onClick={() => setAbierto(true)}
        className="!px-2.5 text-red-600 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
      {abierto && <DialogoEliminar {...props} onCerrar={() => setAbierto(false)} />}
    </>
  );
}
