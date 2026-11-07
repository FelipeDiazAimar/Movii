import { describe, expect, it } from "vitest";
import { acumulados, caja, distanciaM, distanciaSobreLinea, mezclarAngulo, puntoEnDistancia, rumbo, type LngLat } from "./geo3d";

// Un tramo hacia el norte y otro hacia el este, en Rafaela.
const linea: LngLat[] = [
  [-61.49, -31.25],
  [-61.49, -31.24],
  [-61.48, -31.24],
];

describe("geo3d", () => {
  it("mide distancias y rumbos", () => {
    expect(distanciaM(linea[0], linea[1])).toBeCloseTo(1113, -1);
    expect(rumbo(linea[0], linea[1])).toBeCloseTo(0, 0);
    expect(rumbo(linea[1], linea[2])).toBeCloseTo(90, 0);
  });

  it("avanza sobre la línea y se acota a sus extremos", () => {
    const acum = acumulados(linea);
    const mitad = puntoEnDistancia(linea, acum, acum[1] / 2);
    expect(mitad.pos[1]).toBeCloseTo(-31.245, 4);
    expect(mitad.rumbo).toBeCloseTo(0, 0);
    expect(puntoEnDistancia(linea, acum, -10).pos).toEqual(linea[0]);
    expect(puntoEnDistancia(linea, acum, 1e9).pos[0]).toBeCloseTo(linea[2][0], 6);
  });

  it("ubica un punto en vivo sobre la línea", () => {
    const acum = acumulados(linea);
    expect(distanciaSobreLinea(linea, acum, [-61.4801, -31.2401])).toBe(acum[2]);
  });

  it("arma la caja del camión cerrada y del tamaño pedido", () => {
    const anillo = caja(linea[0], 90, 10, 4);
    expect(anillo).toHaveLength(5);
    expect(anillo[0]).toEqual(anillo[4]);
    // Mirando al este, el largo queda sobre el eje este-oeste.
    expect(distanciaM(anillo[0], anillo[3])).toBeCloseTo(10, 0);
    expect(distanciaM(anillo[0], anillo[1])).toBeCloseTo(4, 0);
  });

  it("mezcla ángulos por el camino corto", () => {
    expect(mezclarAngulo(350, 10, 0.5)).toBeCloseTo(0, 5);
    expect(mezclarAngulo(10, 350, 0.5)).toBeCloseTo(0, 5);
  });
});
