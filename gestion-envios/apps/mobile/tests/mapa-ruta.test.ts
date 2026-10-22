import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { api, obtenerMapaRuta, type MapaRutaAPI, type ParadaMapaAPI } from "@/lib/api-client";
import { colorEstado, paradasConUbicacion, paradasSinUbicacion, regionInicial } from "@/lib/mapa-ruta";

const parada = (orden: number, coordenadas: ParadaMapaAPI["coordenadas"]): ParadaMapaAPI => ({
  orden,
  envio_id: `e${orden}`,
  codigo_guia: `MOV-${orden}`,
  estado: "asignado",
  destinatario_nombre: "Ana",
  direccion: "San Martín 100",
  localidad: "Villa María",
  coordenadas,
});
const mapa = (paradas: ParadaMapaAPI[]): MapaRutaAPI => ({
  ruta_id: "r1",
  nombre: "Ruta 1",
  fecha: "2026-10-22",
  repartidor: { id: "u1", nombre: "Juan" },
  paradas,
});

describe("lógica del mapa de ruta", () => {
  const m = mapa([parada(1, { lat: -31.4, lng: -62.0 }), parada(2, null), parada(3, { lat: -31.5, lng: -62.2 })]);

  it("separa paradas con y sin ubicación", () => {
    expect(paradasConUbicacion(m).map((p) => p.orden)).toEqual([1, 3]);
    expect(paradasSinUbicacion(m).map((p) => p.orden)).toEqual([2]);
  });

  it("regionInicial contiene todas las coordenadas con margen", () => {
    const r = regionInicial(paradasConUbicacion(m))!;
    expect(r.latitude).toBeCloseTo(-31.45);
    expect(r.longitude).toBeCloseTo(-62.1);
    expect(r.latitudeDelta).toBeGreaterThan(0.1);
    expect(r.longitudeDelta).toBeGreaterThan(0.2);
  });

  it("regionInicial usa un delta mínimo con una parada y devuelve null sin paradas", () => {
    expect(regionInicial(paradasConUbicacion(mapa([parada(1, { lat: -31.4, lng: -62 })])))!.latitudeDelta).toBe(0.01);
    expect(regionInicial([])).toBeNull();
  });

  it("colorEstado sigue los tonos del StatusBadge", () => {
    expect(colorEstado("entregado")).toBe("#34C759");
    expect(colorEstado("en_camino")).toBe("#FF9F0A");
    expect(colorEstado("no_entregado")).toBe("#FF3B30");
    expect(colorEstado("asignado")).toBe(colorEstado("pendiente"));
  });
});

describe("obtenerMapaRuta", () => {
  const adapterOriginal = api.defaults.adapter;
  let config: InternalAxiosRequestConfig;
  let respuesta: unknown;

  beforeEach(() => {
    globalThis.window = globalThis.window ?? ({ localStorage: { getItem: () => null } } as never);
    api.defaults.adapter = async (c: InternalAxiosRequestConfig) => {
      config = c;
      return { data: respuesta, status: 200, statusText: "OK", headers: {}, config: c };
    };
  });
  afterEach(() => {
    api.defaults.adapter = adapterOriginal;
  });

  it("hace GET /rutas/{id}/mapa y devuelve los datos", async () => {
    respuesta = mapa([parada(1, null)]);
    expect(await obtenerMapaRuta("r1")).toEqual(respuesta);
    expect(config.method).toBe("get");
    expect(config.url).toBe("/rutas/r1/mapa");
  });

  it("normaliza paradas null a []", async () => {
    respuesta = { ...mapa([]), paradas: null };
    expect((await obtenerMapaRuta("r1")).paradas).toEqual([]);
  });
});
