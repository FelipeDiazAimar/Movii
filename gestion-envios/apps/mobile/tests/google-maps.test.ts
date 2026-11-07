import { describe, expect, it } from "vitest";

import { urlGoogleMaps } from "@/lib/google-maps";

const p = (n: number) => ({ lat: n, lng: -n });

describe("urlGoogleMaps", () => {
  it("sin paradas devuelve null", () => {
    expect(urlGoogleMaps({ paradas: [], modo: "proximo" })).toBeNull();
  });

  it("1 parada con dirección de texto", () => {
    const u = new URL(urlGoogleMaps({ paradas: ["Belgrano 100, Rafaela"], modo: "completo" })!);
    expect(u.searchParams.get("destination")).toBe("Belgrano 100, Rafaela");
    expect(u.searchParams.has("waypoints")).toBe(false);
    expect(u.searchParams.get("travelmode")).toBe("driving");
  });

  it("proximo vs completo con 3 paradas", () => {
    const paradas = [p(2), p(3), p(4)];
    const prox = new URL(urlGoogleMaps({ origen: p(1), paradas, modo: "proximo" })!);
    expect(prox.searchParams.get("destination")).toBe("2,-2");
    expect(prox.searchParams.has("waypoints")).toBe(false);
    const comp = new URL(urlGoogleMaps({ origen: p(1), paradas, modo: "completo" })!);
    expect(comp.searchParams.get("origin")).toBe("1,-1");
    expect(comp.searchParams.get("destination")).toBe("4,-4");
    expect(comp.searchParams.get("waypoints")).toBe("2,-2|3,-3");
  });

  it("modo completo con 2 paradas de texto genera waypoint de la primera y destino en la segunda", () => {
    const paradas = ["San Martín 100, Rafaela", "Mitre 250, Rafaela"];
    const u = new URL(urlGoogleMaps({ paradas, modo: "completo" })!);
    expect(u.searchParams.get("destination")).toBe("Mitre 250, Rafaela");
    expect(u.searchParams.get("waypoints")).toBe("San Martín 100, Rafaela");
  });

  it("máximo 9 waypoints", () => {
    const paradas = Array.from({ length: 15 }, (_, i) => p(i + 1));
    const u = new URL(urlGoogleMaps({ paradas, modo: "completo" })!);
    expect(u.searchParams.get("waypoints")!.split("|")).toHaveLength(9);
  });
});
