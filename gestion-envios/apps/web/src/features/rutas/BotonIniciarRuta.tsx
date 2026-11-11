import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/services/api-client";
import { iniciarRuta } from "./api";

interface Props {
  rutaId: string;
  /** Solo se muestra con la ruta planificada (todavía en el depósito). */
  estado: string;
  /** Envíos que todavía están en el depósito: sin ninguno no hay nada que iniciar. */
  asignados?: number;
  className?: string;
}

/**
 * "Iniciar ruta": el camión sale del depósito con todo a bordo y los envíos
 * pasan a "en camino" (cada destinatario recibe su aviso). Lo hace el
 * repartidor desde la app; acá lo pueden hacer el operador y el admin.
 */
export function BotonIniciarRuta({ rutaId, estado, asignados, className = "" }: Props) {
  const { sesion } = useAuth();
  const queryClient = useQueryClient();
  const iniciar = useMutation({
    mutationFn: () => iniciarRuta(rutaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["operaciones"] });
      void queryClient.invalidateQueries({ queryKey: ["rutas"] });
      void queryClient.invalidateQueries({ queryKey: ["envios"] });
    },
  });
  if (estado !== "planificada" || (sesion?.rol !== "admin" && sesion?.rol !== "operador")) return null;
  if (asignados === 0) return null;
  return (
    <span className={`inline-flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => iniciar.mutate()}
        disabled={iniciar.isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-movii-500 px-3.5 py-2 text-sm font-bold text-movii-900 shadow-panel transition hover:bg-movii-400 disabled:cursor-wait disabled:opacity-70"
      >
        <Play className="h-4 w-4 fill-current" aria-hidden />
        {iniciar.isPending ? "Iniciando…" : "Iniciar ruta"}
      </button>
      {iniciar.isError && <span className="text-xs text-red-600">{getApiErrorMessage(iniciar.error, "No se pudo iniciar la ruta")}</span>}
    </span>
  );
}
