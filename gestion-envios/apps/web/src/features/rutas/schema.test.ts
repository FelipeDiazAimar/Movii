import { describe, expect, it } from "vitest";
import { rutaFormSchema } from "./schema";

describe("rutaFormSchema", () => {
  it("acepta una ruta con solo repartidor", () => {
    const resultado = rutaFormSchema.safeParse({
      nombre: "",
      zona: "",
      repartidor_id: "33333333-3333-3333-3333-333333333333",
    });
    expect(resultado.success).toBe(true);
  });

  it("rechaza sin repartidor", () => {
    const resultado = rutaFormSchema.safeParse({
      nombre: "Ruta A",
      zona: "Centro",
      repartidor_id: "",
    });
    expect(resultado.success).toBe(false);
  });
});
