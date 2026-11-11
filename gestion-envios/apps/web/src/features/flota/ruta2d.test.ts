import { describe, expect, it } from "vitest";
import { mezclarColor, svgVehiculoArriba } from "./ruta2d";

describe("mezclarColor", () => {
  it("devuelve los extremos y el punto medio", () => {
    expect(mezclarColor("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mezclarColor("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mezclarColor("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
  it("acota t fuera de rango", () => {
    expect(mezclarColor("#102030", "#405060", 3)).toBe("#405060");
  });
});

describe("svgVehiculoArriba", () => {
  it("pinta la caja con el color del vehículo y respeta el tamaño por tipo", () => {
    const camion = svgVehiculoArriba("camion", "#7c3aed");
    expect(camion).toContain('fill="#7c3aed"');
    expect(camion).toContain('width="20"');
    expect(svgVehiculoArriba("moto", "#7c3aed")).toContain('width="10"');
  });
});
