import { describe, expect, it } from "vitest";
import { indiceMasCercano, partirRecorrido } from "./recorrido";
import type { LatLng } from "./types";

// Recta hacia el este: cada 0.001° de longitud ≈ 95 m en esta latitud.
const linea: LatLng[] = [0, 1, 2, 3, 4].map((i) => [-31.43, -62.08 + i * 0.001] as LatLng);

describe("recorrido", () => {
  it("encuentra el vértice más cercano", () => {
    expect(indiceMasCercano(linea, [-31.43, -62.0775])).toBe(2);
    expect(indiceMasCercano([], [0, 0])).toBe(-1);
  });

  it("parte el recorrido en lo andado y lo que falta, ambos pasando por el camión", () => {
    const camion: LatLng = [-31.43, -62.0785];
    const { hecho, resto } = partirRecorrido(linea, camion);
    expect(hecho[hecho.length - 1]).toEqual(camion);
    expect(resto[0]).toEqual(camion);
    expect(hecho.length + resto.length).toBeGreaterThanOrEqual(linea.length);
  });
});
