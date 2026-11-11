import { apiClient } from "@/services/api-client";

export interface ResumenReinicio {
  fecha: string;
  rutas_hoy: number;
  envios_hoy: number;
  envios_borrados: number;
  dias_historial_nuevos: number;
  duracion_ms: number;
}

/** Deja el día de demostración en su estado inicial (solo admin). */
export async function reiniciarDia(): Promise<ResumenReinicio> {
  const { data } = await apiClient.post<ResumenReinicio>("/admin/demo/reiniciar", undefined, { timeout: 180_000 });
  return data;
}
