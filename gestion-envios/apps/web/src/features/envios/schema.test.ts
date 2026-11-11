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
  fechaEntrega: "2026-12-01",
};

describe("envioFormSchema", () => {
  it("rechaza sin fecha de entrega", () => {
    expect(envioFormSchema.safeParse({ ...base, fechaEntrega: "", peso: "1" }).success).toBe(false);
  });

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

  it('fecha vacía pide "Elegí una fecha"', () => {
    const r = reprogramacionSchema.safeParse({ nueva_fecha: "", franja: "manana" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Elegí una fecha");
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

describe("envioFormSchema: máscaras y límites", () => {
  it("acepta el peso con coma y lo convierte a número", () => {
    const resultado = envioFormSchema.safeParse({ ...base, peso: "2,5" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.peso).toBe(2.5);
  });

  it("el peso fuera de 0,01–1000 kg da el error propio", () => {
    for (const peso of ["0", "1000,01"]) {
      const r = envioFormSchema.safeParse({ ...base, peso });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.message).toBe("El peso tiene que estar entre 0,01 y 1000 kg");
    }
  });

  it("los teléfonos se validan como argentinos y el email nuevo también", () => {
    expect(envioFormSchema.safeParse({ ...base, peso: "1", remitenteTelefono: "03564 15-412345" }).success).toBe(true);
    const telMal = envioFormSchema.safeParse({ ...base, peso: "1", destinatarioTelefono: "123" });
    expect(telMal.success).toBe(false);
    if (!telMal.success) expect(telMal.error.issues[0]?.message).toBe("El teléfono no es válido. Ejemplo: 3564 41-2345");

    expect(envioFormSchema.safeParse({ ...base, peso: "1", destinatarioEmail: "juan@empresa.com" }).success).toBe(true);
    const mailMal = envioFormSchema.safeParse({ ...base, peso: "1", destinatarioEmail: "no-es-mail" });
    expect(mailMal.success).toBe(false);
    if (!mailMal.success) expect(mailMal.error.issues[0]?.message).toBe("El email no es válido. Ejemplo: nombre@empresa.com");
  });

  it("código postal viejo o CPA; número solo dígitos de hasta 5", () => {
    expect(envioFormSchema.safeParse({ ...base, peso: "1", codigoPostal: "X2400ABC" }).success).toBe(true);
    expect(envioFormSchema.safeParse({ ...base, peso: "1", codigoPostal: "2400" }).success).toBe(true);
    expect(envioFormSchema.safeParse({ ...base, peso: "1", codigoPostal: "24" }).success).toBe(false);
    expect(envioFormSchema.safeParse({ ...base, peso: "1", numero: "123456" }).success).toBe(false);
    expect(envioFormSchema.safeParse({ ...base, peso: "1", numero: "12a" }).success).toBe(false);
  });

  it("los máximos nuevos coinciden con la base", () => {
    expect(envioFormSchema.safeParse({ ...base, peso: "1", destinatarioNombre: "n".repeat(100) }).success).toBe(true);
    expect(envioFormSchema.safeParse({ ...base, peso: "1", destinatarioNombre: "n".repeat(101) }).success).toBe(false);
    expect(envioFormSchema.safeParse({ ...base, peso: "1", tipoContenido: "c".repeat(101) }).success).toBe(false);
  });
});
