import { describe, expect, it } from "vitest";
import { envioFormSchema } from "./schema";

/**
 * Estas reglas tienen que coincidir con validarCrearEnvioInput en
 * services/api/internal/services/envio_service.go: nombre del destinatario,
 * calle, localidad y peso > 0 son obligatorios; el resto es opcional.
 */
const base = {
  remitenteNombre: "",
  remitenteTelefono: "",
  remitenteDireccion: "",
  destinatarioNombre: "Cliente Test",
  destinatarioTelefono: "",
  calle: "Mitre",
  numero: "250",
  pisoDepto: "",
  localidad: "San Francisco",
  codigoPostal: "",
  tamano: "mediano" as const,
  tipoContenido: "",
  fragil: false,
  urgente: false,
};

describe("envioFormSchema", () => {
  it("acepta un envío con solo los campos obligatorios", () => {
    const resultado = envioFormSchema.safeParse({ ...base, peso: "3.5" });
    expect(resultado.success).toBe(true);
  });

  it("rechaza destinatarioNombre vacío", () => {
    const resultado = envioFormSchema.safeParse({ ...base, destinatarioNombre: "", peso: "1" });
    expect(resultado.success).toBe(false);
  });

  it("rechaza calle vacía", () => {
    const resultado = envioFormSchema.safeParse({ ...base, calle: "", peso: "1" });
    expect(resultado.success).toBe(false);
  });

  it("rechaza localidad vacía", () => {
    const resultado = envioFormSchema.safeParse({ ...base, localidad: "", peso: "1" });
    expect(resultado.success).toBe(false);
  });

  it("rechaza peso 0 o negativo", () => {
    expect(envioFormSchema.safeParse({ ...base, peso: "0" }).success).toBe(false);
    expect(envioFormSchema.safeParse({ ...base, peso: "-2" }).success).toBe(false);
  });

  it("rechaza peso vacío", () => {
    expect(envioFormSchema.safeParse({ ...base, peso: "" }).success).toBe(false);
  });

  it("rechaza un tamaño fuera de chico/mediano/grande", () => {
    const resultado = envioFormSchema.safeParse({ ...base, peso: "1", tamano: "enorme" });
    expect(resultado.success).toBe(false);
  });
});
