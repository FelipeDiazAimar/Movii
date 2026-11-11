import { describe, expect, it } from "vitest";
import { rutaFormSchema } from "./schema";

const REPARTIDOR = "33333333-3333-3333-3333-333333333333";

describe("rutaFormSchema", () => {
  it("acepta una ruta con nombre y repartidor (zona opcional)", () => {
    const resultado = rutaFormSchema.safeParse({ nombre: "Ruta A", zona: "", repartidor_id: REPARTIDOR });
    expect(resultado.success).toBe(true);
  });

  it("rechaza sin nombre (o solo espacios) con mensaje propio", () => {
    for (const nombre of ["", "   "]) {
      const resultado = rutaFormSchema.safeParse({ nombre, zona: "", repartidor_id: REPARTIDOR });
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].path).toEqual(["nombre"]);
        expect(resultado.error.issues[0].message).toBe("El nombre es obligatorio");
      }
    }
  });

  it("recorta los espacios del nombre", () => {
    const resultado = rutaFormSchema.safeParse({ nombre: "  Ruta A  ", zona: "", repartidor_id: REPARTIDOR });
    expect(resultado.success && resultado.data.nombre).toBe("Ruta A");
  });

  it("los máximos coinciden con la base (VARCHAR(100))", () => {
    expect(rutaFormSchema.safeParse({ nombre: "n".repeat(100), zona: "", repartidor_id: REPARTIDOR }).success).toBe(true);
    expect(rutaFormSchema.safeParse({ nombre: "n".repeat(101), zona: "", repartidor_id: REPARTIDOR }).success).toBe(false);
    expect(rutaFormSchema.safeParse({ nombre: "Ruta A", zona: "z".repeat(101), repartidor_id: REPARTIDOR }).success).toBe(false);
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
