import { describe, expect, it } from "vitest";
import { COLORES_RUTA, aclarar, colorAutomatico, colorDeFlota, colorDeVehiculo, esColorHex } from "./colores";

describe("colorDeVehiculo", () => {
  it("usa el color propio si es válido", () => expect(colorDeVehiculo("#112233", 0)).toBe("#112233"));
  it("cae al automático si está vacío o inválido", () => {
    expect(colorDeVehiculo("", 1)).toBe(COLORES_RUTA[1]);
    expect(colorDeVehiculo("rojo", 9)).toBe(COLORES_RUTA[9 % COLORES_RUTA.length]);
    expect(colorDeVehiculo(undefined, 0)).toBe(COLORES_RUTA[0]);
  });
});

describe("esColorHex / aclarar", () => {
  it("valida #RRGGBB", () => {
    expect(esColorHex("#aBc123")).toBe(true);
    expect(esColorHex("#abc")).toBe(false);
  });
  it("mezcla con blanco y negro", () => {
    expect(aclarar("#000000", 1)).toBe("#ffffff");
    expect(aclarar("#ffffff", -1)).toBe("#000000");
    expect(aclarar("#102030", 0)).toBe("#102030");
  });
});

describe("colorDeFlota (H22: automático estable)", () => {
  const a = { id: "id-a", patente: "AB123CD", color: "" };
  const b = { id: "id-b", patente: "TRK-318", color: "" };
  const c = { id: "id-c", patente: "AE456FG", color: "#112233" };

  it("el automático no depende del orden de la flota", () => {
    const uno = colorDeFlota([a, b, c]);
    const otro = colorDeFlota([c, b, a]);
    expect(uno).toEqual(otro);
  });

  it("el automático sale de la patente y es de la paleta", () => {
    expect(colorDeFlota([b])[b.id]).toBe(colorAutomatico("TRK-318"));
    expect(colorAutomatico("trk-318")).toBe(colorAutomatico("TRK-318"));
    expect(COLORES_RUTA).toContain(colorAutomatico("TRK-318"));
  });

  it("respeta el color elegido y usa el id si no hay patente", () => {
    expect(colorDeFlota([c])[c.id]).toBe("#112233");
    expect(colorDeFlota([{ id: "solo-id" }])["solo-id"]).toBe(colorAutomatico("solo-id"));
  });
});
