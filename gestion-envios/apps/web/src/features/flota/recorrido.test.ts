import { describe, expect, it } from "vitest";
import { distanciaM, etaParadas, indiceMasCercano, partirRecorrido } from "./recorrido";
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

  it("estima la llegada a cada parada según la velocidad media del recorrido", () => {
    const total = distanciaM(linea[0], linea[4]);
    const ahora = new Date("2026-11-11T12:00:00Z");
    // 600 s para todo el recorrido: la parada del medio llega a los 300 s, la última a los 600 s.
    const eta = etaParadas(linea, linea[0], [{ id: "a", pos: linea[2] }, { id: "b", pos: linea[4] }], total, 600, ahora);
    expect((eta.a.getTime() - ahora.getTime()) / 1000).toBeCloseTo(300, -1);
    expect((eta.b.getTime() - ahora.getTime()) / 1000).toBeCloseTo(600, -1);
  });

  it("sin recorrido o sin duración no inventa horas", () => {
    expect(etaParadas([], [0, 0], [{ id: "a", pos: [0, 0] }], 100, 60, new Date())).toEqual({});
    expect(etaParadas(linea, linea[0], [{ id: "a", pos: linea[1] }], 100, 0, new Date())).toEqual({});
  });
});
