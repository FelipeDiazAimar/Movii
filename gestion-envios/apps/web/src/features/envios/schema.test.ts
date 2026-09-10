import { describe, expect, it } from "vitest";
import { cambiarEstadoSchema, envioFormSchema, incidenciaSchema, reprogramacionSchema, trackingCodigoSchema } from "./schema";

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

describe("cambiarEstadoSchema", () => {
  it("acepta asignado y en_camino", () => {
    expect(cambiarEstadoSchema.safeParse({ estado: "asignado" }).success).toBe(true);
    expect(cambiarEstadoSchema.safeParse({ estado: "en_camino" }).success).toBe(true);
  });

  it("rechaza entregado (va por confirmación)", () => {
    expect(cambiarEstadoSchema.safeParse({ estado: "entregado" }).success).toBe(false);
  });

  it("rechaza no_entregado (va por incidencia)", () => {
    expect(cambiarEstadoSchema.safeParse({ estado: "no_entregado" }).success).toBe(false);
  });

  it("rechaza estado desconocido o ausente", () => {
    expect(cambiarEstadoSchema.safeParse({ estado: "volando" }).success).toBe(false);
    expect(cambiarEstadoSchema.safeParse({}).success).toBe(false);
  });
});

describe("incidenciaSchema", () => {
  it("acepta un motivo con comentario", () => {
    const resultado = incidenciaSchema.safeParse({ motivo: "cliente_ausente", comentario: "Volver después de las 18" });
    expect(resultado.success).toBe(true);
  });

  it("acepta motivo sin comentario cuando no es otro", () => {
    expect(incidenciaSchema.safeParse({ motivo: "rechazado" }).success).toBe(true);
  });

  it.each(["cliente_ausente", "direccion_incorrecta", "rechazado", "zona_insegura", "otro"])(
    "acepta el motivo %s (con comentario para otro)",
    (motivo) => {
      expect(
        incidenciaSchema.safeParse({ motivo, comentario: motivo === "otro" ? "Portón cerrado" : undefined }).success,
      ).toBe(true);
    },
  );

  it("rechaza motivo fuera de la lista cerrada", () => {
    expect(incidenciaSchema.safeParse({ motivo: "se_lo_comio_el_perro" }).success).toBe(false);
  });

  it("exige comentario no-blanco cuando el motivo es otro", () => {
    expect(incidenciaSchema.safeParse({ motivo: "otro" }).success).toBe(false);
    expect(incidenciaSchema.safeParse({ motivo: "otro", comentario: "" }).success).toBe(false);
    expect(incidenciaSchema.safeParse({ motivo: "otro", comentario: "   " }).success).toBe(false);
  });

  it("acepta foto_base64 opcional", () => {
    const resultado = incidenciaSchema.safeParse({ motivo: "zona_insegura", foto_base64: "aGVsbG8=" });
    expect(resultado.success).toBe(true);
  });
});

describe("reprogramacionSchema", () => {
  it("acepta fecha YYYY-MM-DD con franja válida", () => {
    const resultado = reprogramacionSchema.safeParse({ nueva_fecha: "2026-09-20", franja: "manana" });
    expect(resultado.success).toBe(true);
  });

  it.each(["manana", "tarde", "noche"])("acepta la franja %s", (franja) => {
    expect(reprogramacionSchema.safeParse({ nueva_fecha: "2026-09-20", franja }).success).toBe(true);
  });

  it("rechaza fecha con mal formato", () => {
    expect(reprogramacionSchema.safeParse({ nueva_fecha: "20-09-2026", franja: "manana" }).success).toBe(false);
    expect(reprogramacionSchema.safeParse({ nueva_fecha: "2026/09/20", franja: "manana" }).success).toBe(false);
    expect(reprogramacionSchema.safeParse({ nueva_fecha: "", franja: "manana" }).success).toBe(false);
  });

  it("rechaza franja fuera de la lista cerrada", () => {
    expect(reprogramacionSchema.safeParse({ nueva_fecha: "2026-09-20", franja: "madrugada" }).success).toBe(false);
  });
});

describe("trackingCodigoSchema", () => {
  it("acepta un código con formato MOV-AAAAMMDD-XXXX", () => {
    expect(trackingCodigoSchema.safeParse("MOV-20260909-0001").success).toBe(true);
  });

  it("tolera espacios alrededor (trim)", () => {
    const resultado = trackingCodigoSchema.safeParse("  MOV-20260909-0001  ");
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data).toBe("MOV-20260909-0001");
  });

  it("rechaza código vacío", () => {
    expect(trackingCodigoSchema.safeParse("").success).toBe(false);
    expect(trackingCodigoSchema.safeParse("   ").success).toBe(false);
  });

  it("rechaza códigos con mal formato", () => {
    expect(trackingCodigoSchema.safeParse("MOV-2026-1").success).toBe(false);
    expect(trackingCodigoSchema.safeParse("OTRO-20260909-0001").success).toBe(false);
    expect(trackingCodigoSchema.safeParse("MOV-20260909-01").success).toBe(false);
  });
});
