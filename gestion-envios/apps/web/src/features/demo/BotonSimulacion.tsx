import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/services/api-client";
import { reiniciarDia } from "./api";

/**
 * Botón ▶: deja el día de demostración en su estado inicial (rutas de hoy
 * recién empezadas, camiones listos, pendientes y rutas de mañana) para
 * simular un día normal. Cada vez que se toca vuelve a ese estado. Solo
 * reescribe los datos de demostración: usuarios, vehículos propios y envíos
 * reales quedan como están. Solo lo ve el admin.
 */
export function BotonSimulacion() {
  const { sesion } = useAuth();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const reiniciar = useMutation({
    mutationFn: reiniciarDia,
    onSuccess: (r) => {
      setAviso({ tipo: "ok", texto: `Día listo: ${r.rutas_hoy} rutas y ${r.envios_hoy} envíos en reparto` });
      // Todo lo que muestra la web cambió: se vuelve a pedir (sin esperar para avisar).
      void queryClient.invalidateQueries();
    },
    onError: (err) => setAviso({ tipo: "error", texto: getApiErrorMessage(err, "No se pudo preparar el día") }),
  });
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  if (sesion?.rol !== "admin") return null;
  const enCurso = reiniciar.isPending;
  return (
    <div className="relative flex items-center gap-2">
      {(enCurso || aviso) && (
        <span
          role="status"
          className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:inline ${
            enCurso ? "bg-hormigon-100 text-gray-600" : aviso?.tipo === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {enCurso ? "Preparando el día…" : aviso?.texto}
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          setAviso(null);
          reiniciar.mutate();
        }}
        disabled={enCurso}
        title="Simular un día normal desde el inicio"
        aria-label="Simular un día normal desde el inicio"
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-movii-500 text-movii-900 shadow-panel ring-2 ring-white transition hover:scale-105 hover:bg-movii-400 focus-visible:outline-none focus-visible:ring-movii-700 disabled:cursor-wait ${
          enCurso ? "animate-pulse" : ""
        }`}
      >
        <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={2.2} aria-hidden />
      </button>
      {aviso && (
        <span role="status" className={`absolute right-0 top-full mt-1 whitespace-nowrap text-[11px] font-semibold sm:hidden ${aviso.tipo === "ok" ? "text-emerald-700" : "text-red-700"}`}>
          {aviso.texto}
        </span>
      )}
    </div>
  );
}
