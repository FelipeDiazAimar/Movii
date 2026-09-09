import { z } from "zod";

/** Espeja validarRuta en services/api: solo repartidor_id y fecha son obligatorios. */
export const rutaFormSchema = z.object({
  nombre: z.string().max(120),
  zona: z.string().max(120),
  fecha: z.string().min(1, "La fecha es obligatoria"),
  repartidor_id: z.string().min(1, "El repartidor es obligatorio"),
});

export type RutaFormValues = z.infer<typeof rutaFormSchema>;
