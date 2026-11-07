import { describe, expect, it } from "vitest";
import { urlGoogleMaps } from "./googleMaps";

const p = (n: number) => ({ lat: n, lng: -n });

describe("urlGoogleMaps", () => {
  it("sin paradas devuelve null", () => {
    expect(urlGoogleMaps({ paradas: [], modo: "completo" })).toBeNull();
  });

  it("1 parada: solo destino, sin waypoints", () => {
    const u = new URL(urlGoogleMaps({ origen: p(1), paradas: [p(2)], modo: "completo" })!);
    expect(u.searchParams.get("origin")).toBe("1,-1");
    expect(u.searchParams.get("destination")).toBe("2,-2");
    expect(u.searchParams.has("waypoints")).toBe(false);
    expect(u.searchParams.get("travelmode")).toBe("driving");
    expect(u.searchParams.get("api")).toBe("1");
  });

  it("modo proximo: destino = primera parada", () => {
    const u = new URL(urlGoogleMaps({ paradas: [p(2), p(3), p(4)], modo: "proximo" })!);
    expect(u.searchParams.get("destination")).toBe("2,-2");
    expect(u.searchParams.has("waypoints")).toBe(false);
    expect(u.searchParams.has("origin")).toBe(false);
  });

  it("modo completo con 3 paradas: waypoints separados por | y destino final", () => {
    const url = urlGoogleMaps({ paradas: [p(2), p(3), p(4)], modo: "completo" })!;
    const u = new URL(url);
    expect(u.searchParams.get("destination")).toBe("4,-4");
    expect(u.searchParams.get("waypoints")).toBe("2,-2|3,-3");
    expect(url).toContain("waypoints=2%2C-2%7C3%2C-3");
  });

  it("limita a 9 waypoints y acepta direcciones de texto", () => {
    const paradas = Array.from({ length: 15 }, (_, i) => `Calle ${i} 100, Rafaela`);
    const u = new URL(urlGoogleMaps({ paradas, modo: "completo" })!);
    expect(u.searchParams.get("waypoints")!.split("|")).toHaveLength(9);
    expect(u.searchParams.get("destination")).toBe("Calle 14 100, Rafaela");
  });
});
