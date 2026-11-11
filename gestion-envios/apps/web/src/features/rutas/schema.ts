import { z } from "zod";

/**
 * Espeja validarRuta en services/api (repartidor obligatorio) y además exige
 * nombre en la web: sin nombre las rutas no se distinguen en los listados (QA 10/11).
 */
export const rutaFormSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100, "El nombre no puede superar los 100 caracteres"),
  zona: z.string().trim().max(100, "La zona no puede superar los 100 caracteres"),
  repartidor_id: z.string().min(1, "El repartidor es obligatorio"),
  fecha: z.string().optional(),
});

export type RutaFormValues = z.infer<typeof rutaFormSchema>;
