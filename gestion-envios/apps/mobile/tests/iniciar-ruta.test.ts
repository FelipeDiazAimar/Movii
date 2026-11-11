import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { api, iniciarRuta, type EstadoEnvioAPI } from "@/lib/api-client";
import { rutaSinIniciar, type RutaDelDia } from "@/lib/envios-del-dia";
import type { Shipment, ShipmentStatus } from "@/types/logistics";

const envio = (id: string, estadoApi: EstadoEnvioAPI | undefined, status: ShipmentStatus): Shipment =>
  ({ id, estadoApi, status }) as Shipment;

const ruta = (envios: Shipment[]): RutaDelDia => ({ rutaId: "r1", rutaNombre: "Ruta Centro 01", envios });

describe("rutaSinIniciar", () => {
  it("es true cuando todos los envíos están asignados", () => {
    expect(rutaSinIniciar(ruta([envio("1", "asignado", "pendiente"), envio("2", "asignado", "pendiente")]))).toBe(true);
  });

  it("es false cuando alguno ya está en camino", () => {
    expect(
      rutaSinIniciar(ruta([envio("1", "asignado", "pendiente"), envio("2", "en_camino", "en_camino")])),
    ).toBe(false);
  });

  it("es false cuando alguno ya se entregó o no se entregó", () => {
    expect(rutaSinIniciar(ruta([envio("1", "asignado", "pendiente"), envio("2", "entregado", "entregado")]))).toBe(
      false,
    );
    expect(
      rutaSinIniciar(ruta([envio("1", "asignado", "pendiente"), envio("2", "no_entregado", "no_entregado")])),
    ).toBe(false);
  });

  it("es false cuando no queda nada asignado o la ruta está vacía", () => {
    expect(rutaSinIniciar(ruta([envio("1", "en_camino", "en_camino")]))).toBe(false);
    expect(rutaSinIniciar(ruta([envio("1", "pendiente", "pendiente")]))).toBe(false);
    expect(rutaSinIniciar(ruta([]))).toBe(false);
  });

  it("en modo demo (sin estadoApi) el pendiente del prototipo cuenta como asignado", () => {
    expect(rutaSinIniciar(ruta([envio("1", undefined, "pendiente"), envio("2", undefined, "pendiente")]))).toBe(
      true,
    );
    expect(rutaSinIniciar(ruta([envio("1", undefined, "pendiente"), envio("2", undefined, "en_camino")]))).toBe(
      false,
    );
  });
});

describe("iniciarRuta", () => {
  const adapterOriginal = api.defaults.adapter;
  let config: InternalAxiosRequestConfig;

  beforeEach(() => {
    // Platform.OS es "web" (react-native-web): getToken lee window.localStorage.
    globalThis.window = globalThis.window ?? ({ localStorage: { getItem: () => null } } as never);
    api.defaults.adapter = async (c: InternalAxiosRequestConfig) => {
      config = c;
      return { data: { envios_en_camino: 9 }, status: 200, statusText: "OK", headers: {}, config: c };
    };
  });

  afterEach(() => {
    api.defaults.adapter = adapterOriginal;
  });

  it("hace POST /rutas/{id}/iniciar y devuelve cuántos envíos salieron", async () => {
    await expect(iniciarRuta("r1")).resolves.toEqual({ envios_en_camino: 9 });
    expect(config.method).toBe("post");
    expect(config.url).toBe("/rutas/r1/iniciar");
  });
});
