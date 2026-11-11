import { describe, expect, it } from "vitest";
import { accionesDisponibles, extraerBase64, notaSinAcciones } from "./AccionesEnvio";

describe("accionesDisponibles", () => {
  it("asignado no tiene acciones propias: sale cuando se inicia la ruta", () => {
    expect(accionesDisponibles("asignado")).toEqual([]);
  });

  it("en_camino solo permite registrar una incidencia", () => {
    expect(accionesDisponibles("en_camino")).toEqual(["incidencia"]);
  });

  it("no_entregado solo permite reprogramar", () => {
    expect(accionesDisponibles("no_entregado")).toEqual(["reprogramar"]);
  });

  it("entregado y pendiente no tienen acciones", () => {
    expect(accionesDisponibles("entregado")).toEqual([]);
    expect(accionesDisponibles("pendiente")).toEqual([]);
  });
});

describe("notaSinAcciones", () => {
  it("explica por qué no hay acciones en entregado y pendiente", () => {
    expect(notaSinAcciones("entregado")).toContain("entregado");
    expect(notaSinAcciones("pendiente")).toContain("ruta");
  });

  it("asignado explica que sale con la ruta", () => {
    expect(notaSinAcciones("asignado")).toContain("se inicia su ruta");
  });

  it("no hay nota cuando sí hay acciones", () => {
    expect(notaSinAcciones("en_camino")).toBeNull();
    expect(notaSinAcciones("no_entregado")).toBeNull();
  });
});

describe("extraerBase64", () => {
  it("quita el prefijo data:image que agrega FileReader", () => {
    expect(extraerBase64("data:image/png;base64,aGVsbG8=")).toBe("aGVsbG8=");
    expect(extraerBase64("data:image/jpeg;base64,aGVsbG8=")).toBe("aGVsbG8=");
  });

  it("deja intacto un base64 que ya viene sin prefijo", () => {
    expect(extraerBase64("aGVsbG8=")).toBe("aGVsbG8=");
  });
});
