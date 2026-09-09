import { describe, expect, it } from "vitest";
import { rutaFormSchema } from "./schema";

describe("rutaFormSchema", () => {
  it("acepta una ruta con solo fecha y repartidor", () => {
    const resultado = rutaFormSchema.safeParse({
      nombre: "",
      zona: "",
      fecha: "2026-09-10",
      repartidor_id: "33333333-3333-3333-3333-333333333333",
    });
    expect(resultado.success).toBe(true);
  });

  it("rechaza sin fecha", () => {
    const resultado = rutaFormSchema.safeParse({
      nombre: "Ruta A",
      zona: "Centro",
      fecha: "",
      repartidor_id: "33333333-3333-3333-3333-333333333333",
    });
    expect(resultado.success).toBe(false);
  });

  it("rechaza sin repartidor", () => {
    const resultado = rutaFormSchema.safeParse({
      nombre: "Ruta A",
      zona: "Centro",
      fecha: "2026-09-10",
      repartidor_id: "",
    });
    expect(resultado.success).toBe(false);
  });
});
