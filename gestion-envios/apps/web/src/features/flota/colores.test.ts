import { describe, expect, it } from "vitest";
import { COLORES_RUTA, aclarar, colorDeVehiculo, esColorHex } from "./colores";

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
