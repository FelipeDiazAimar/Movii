import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  actualizarEstadoEnvio,
  api,
  confirmarEntrega,
  consultarTracking,
  registrarIncidencia,
  reprogramarEnvio,
} from "@/lib/api-client";

const adapterOriginal = api.defaults.adapter;
let config: InternalAxiosRequestConfig;
let respuesta: unknown;

beforeEach(() => {
  respuesta = {};
  // Platform.OS es "web" (react-native-web): getToken lee window.localStorage.
  globalThis.window = globalThis.window ?? ({ localStorage: { getItem: () => null } } as never);
  api.defaults.adapter = async (c: InternalAxiosRequestConfig) => {
    config = c;
    return { data: respuesta, status: 200, statusText: "OK", headers: {}, config: c };
  };
});

afterEach(() => {
  api.defaults.adapter = adapterOriginal;
});

describe("llamadas de seguimiento", () => {
  it("actualizarEstadoEnvio hace PUT /envios/{id}/estado", async () => {
    await actualizarEstadoEnvio("e1", "en_camino");
    expect(config.method).toBe("put");
    expect(config.url).toBe("/envios/e1/estado");
    expect(JSON.parse(config.data)).toEqual({ estado: "en_camino" });
  });

  it("registrarIncidencia hace POST /envios/{id}/incidencia", async () => {
    await registrarIncidencia("e1", { motivo: "otro", comentario: "x" });
    expect(config.method).toBe("post");
    expect(config.url).toBe("/envios/e1/incidencia");
    expect(JSON.parse(config.data)).toEqual({ motivo: "otro", comentario: "x" });
  });

  it("confirmarEntrega hace POST /envios/{id}/confirmacion con timeout de 60 s", async () => {
    const body = { receptor_nombre: "Ana", receptor_relacion: "vecino" as const, firma_base64: "iVBOR", foto_base64: "/9j/" };
    await confirmarEntrega("e1", body);
    expect(config.method).toBe("post");
    expect(config.url).toBe("/envios/e1/confirmacion");
    expect(JSON.parse(config.data)).toEqual(body);
    expect(config.timeout).toBe(60000);
  });

  it("reprogramarEnvio hace POST /envios/{id}/reprogramacion", async () => {
    await reprogramarEnvio("e1", { nueva_fecha: "2026-10-23", franja: "tarde" });
    expect(config.method).toBe("post");
    expect(config.url).toBe("/envios/e1/reprogramacion");
    expect(JSON.parse(config.data)).toEqual({ nueva_fecha: "2026-10-23", franja: "tarde" });
  });

  it("consultarTracking hace GET con el código recortado y devuelve los datos", async () => {
    respuesta = { codigo_guia: "MOV-20261022-0001", historial: [{ fecha: "x", descripcion: "y" }] };
    const r = await consultarTracking("  MOV-20261022-0001 ");
    expect(config.method).toBe("get");
    expect(config.url).toBe("/tracking/MOV-20261022-0001");
    expect(r).toEqual(respuesta);
  });

  it("consultarTracking normaliza historial null a []", async () => {
    respuesta = { codigo_guia: "MOV-1", historial: null };
    expect((await consultarTracking("MOV-1")).historial).toEqual([]);
  });
});
