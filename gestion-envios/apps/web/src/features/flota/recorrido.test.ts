import { describe, expect, it } from "vitest";
import { indiceMasCercano, partirRecorrido, proyectarEnRuta, ubicarEnRuta } from "./recorrido";
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

  it("proyecta al camión sobre el tramo (no solo sobre los vértices) aunque los vértices estén lejos", () => {
    // Un único tramo largo (como una recta entre dos paradas): el camión va por la mitad.
    const larga: LatLng[] = [
      [-31.43, -62.1],
      [-31.43, -62.06],
    ];
    const camion: LatLng = [-31.4301, -62.08]; // ~11 m al costado de la recta
    const r = proyectarEnRuta(larga, camion)!;
    expect(r.indice).toBe(0);
    expect(r.distanciaM).toBeLessThan(15);
    expect(r.punto[1]).toBeCloseTo(-62.08, 4);
    const { hecho, resto } = partirRecorrido(larga, camion);
    expect(hecho).toHaveLength(2); // origen + punto del camión sobre la recta
    expect(resto).toHaveLength(2); // punto del camión + final
    expect(hecho[0]).toEqual(larga[0]);
    expect(resto[1]).toEqual(larga[1]);
  });

  it("la ruta completa se conserva: lo hecho más lo que falta cubre todo el recorrido", () => {
    const { hecho, resto } = partirRecorrido(linea, [-31.43, -62.0775]);
    expect(hecho[0]).toEqual(linea[0]);
    expect(resto[resto.length - 1]).toEqual(linea[linea.length - 1]);
    // El punto de corte es compartido: no queda hueco entre el tramo hecho y el que falta.
    expect(hecho[hecho.length - 1]).toEqual(resto[0]);
  });

  it("antes del inicio no hay tramo hecho y pasado el final no queda tramo por hacer", () => {
    const antes = partirRecorrido(linea, [-31.43, -62.2]);
    expect(antes.hecho.length).toBeLessThanOrEqual(1); // un punto no es una línea
    expect(antes.resto).toHaveLength(linea.length); // la ruta entera sigue por delante
    const despues = partirRecorrido(linea, [-31.43, -61.9]);
    expect(despues.hecho).toHaveLength(linea.length);
    expect(despues.resto.length).toBeLessThanOrEqual(1);
    expect(partirRecorrido([], [0, 0])).toEqual({ hecho: [], resto: [], indice: 0 });
  });

  describe("ubicarEnRuta (recorridos que vuelven por la misma calle)", () => {
    // Ida y vuelta por la misma calle: el punto del medio se repite.
    const idaYVuelta: LatLng[] = [
      [-31.43, -62.08],
      [-31.43, -62.07],
      [-31.43, -62.06], // punta
      [-31.43, -62.07],
      [-31.43, -62.08],
    ];

    it("con el avance previo en la vuelta, sigue en la vuelta y no salta a la ida", () => {
      const enLaVuelta = ubicarEnRuta(idaYVuelta, [-31.43, -62.0702], 2);
      expect(enLaVuelta?.indice).toBe(3); // segmento de la vuelta
    });

    it("sin avance previo y en un punto que la ruta recorre dos veces, toma el primer pasaje", () => {
      expect(ubicarEnRuta(idaYVuelta, [-31.43, -62.0702])?.indice).toBe(0);
    });

    it("si el camión quedó lejos del tramo donde se lo esperaba (reinicio de la demo), retrocede en vez de quedarse trabado", () => {
      const lAvance: LatLng[] = [
        [-31.43, -62.08],
        [-31.43, -62.07],
        [-31.43, -62.06],
        [-31.44, -62.06], // la ruta dobla hacia el sur
      ];
      // Estaba en el último tramo (previo = 2) y ahora aparece de nuevo en el depósito (inicio).
      expect(ubicarEnRuta(lAvance, [-31.43, -62.0799], 2)?.indice).toBe(0);
      // Y si sigue avanzando normal, no retrocede.
      expect(ubicarEnRuta(lAvance, [-31.435, -62.06], 2)?.indice).toBe(2);
    });
  });
});
