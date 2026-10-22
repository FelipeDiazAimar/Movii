import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import {
  accionesDisponibles,
  bytesDeBase64,
  esJPEGBase64,
  esNoEncontrado,
  esPNGBase64,
  hoyUTC,
  mensajeDeError,
  proximasFechas,
  trackingAEventos,
  validarConfirmacion,
  validarIncidencia,
  type TrackingInfo,
} from "@/lib/seguimiento";

const JPEG = "/9j/AAAA";
const PNG = "iVBORw0KGgoAAAA";

const axiosError = (response?: { status: number; data?: unknown }) =>
  new AxiosError("fallo", "ERR", undefined, undefined, response as never);

describe("hoyUTC", () => {
  it("devuelve la fecha UTC", () => {
    expect(hoyUTC(new Date("2026-10-22T02:30:00Z"))).toBe("2026-10-22");
  });

  it("usa UTC y no la hora local", () => {
    expect(hoyUTC(new Date("2026-10-21T23:30:00-03:00"))).toBe("2026-10-22");
  });
});

describe("proximasFechas", () => {
  it("devuelve fechas consecutivas desde hoy UTC con etiquetas", () => {
    const r = proximasFechas(3, new Date("2026-10-22T02:30:00Z"));
    expect(r.map((x) => x.fecha)).toEqual(["2026-10-22", "2026-10-23", "2026-10-24"]);
    expect(r[0].etiqueta.startsWith("Hoy")).toBe(true);
    expect(r[1].etiqueta.startsWith("Mañana")).toBe(true);
    r.forEach((x) => expect(x.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  });
});

describe("accionesDisponibles", () => {
  it("asignado", () => {
    expect(accionesDisponibles("asignado")).toMatchObject({ iniciar: true, entregar: true, incidencia: true, reprogramar: false });
  });

  it("en_camino", () => {
    expect(accionesDisponibles("en_camino")).toMatchObject({ volverAsignado: true, iniciar: false });
  });

  it("no_entregado solo permite reprogramar", () => {
    expect(accionesDisponibles("no_entregado")).toEqual({
      iniciar: false,
      volverAsignado: false,
      entregar: false,
      incidencia: false,
      reprogramar: true,
    });
  });

  it("entregado y undefined no permiten nada", () => {
    const nada = { iniciar: false, volverAsignado: false, entregar: false, incidencia: false, reprogramar: false };
    expect(accionesDisponibles("entregado")).toEqual(nada);
    expect(accionesDisponibles(undefined)).toEqual(nada);
  });
});

describe("validarIncidencia", () => {
  it("rechaza un motivo fuera de la lista", () => {
    expect(validarIncidencia("inventado", "")).toEqual(expect.any(String));
  });

  it("exige comentario con motivo otro", () => {
    expect(validarIncidencia("otro", "")).toEqual(expect.any(String));
    expect(validarIncidencia("otro", "   ")).toEqual(expect.any(String));
    expect(validarIncidencia("otro", "algo")).toBeNull();
  });

  it("valida el formato y tamaño de la foto", () => {
    expect(validarIncidencia("rechazado", "", PNG)).toEqual(expect.any(String));
    expect(validarIncidencia("rechazado", "", JPEG)).toBeNull();
    const grande = "/9j/" + "A".repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3));
    expect(validarIncidencia("rechazado", "", grande)).toEqual(expect.any(String));
  });
});

describe("validarConfirmacion", () => {
  const ok = { receptorNombre: "Ana", relacion: "vecino", firmaBase64: PNG, fotoBase64: JPEG };

  it("acepta un caso completo", () => {
    expect(validarConfirmacion(ok)).toBeNull();
  });

  it.each([
    ["nombre vacío", { receptorNombre: "  " }],
    ["nombre de 101 caracteres", { receptorNombre: "a".repeat(101) }],
    ["relación inválida", { relacion: "amigo" }],
    ["firma null", { firmaBase64: null }],
    ["firma no PNG", { firmaBase64: JPEG }],
    ["foto null", { fotoBase64: null }],
    ["foto no JPEG", { fotoBase64: PNG }],
  ])("rechaza %s", (_, cambio) => {
    expect(validarConfirmacion({ ...ok, ...cambio })).toEqual(expect.any(String));
  });
});

describe("base64", () => {
  it("detecta JPEG y PNG", () => {
    expect(esJPEGBase64(JPEG)).toBe(true);
    expect(esJPEGBase64(PNG)).toBe(false);
    expect(esPNGBase64(PNG)).toBe(true);
    expect(esPNGBase64(JPEG)).toBe(false);
  });

  it("calcula bytes decodificados", () => {
    expect(bytesDeBase64("AAAA")).toBe(3);
    expect(bytesDeBase64("AAA=")).toBe(2);
    expect(bytesDeBase64("AA==")).toBe(1);
  });
});

describe("trackingAEventos", () => {
  const base: TrackingInfo = {
    codigo_guia: "MOV-1",
    estado: "en_camino",
    localidad: "Rosario",
    actualizado_en: "2026-10-22T10:00:00Z",
    historial: [{ fecha: "2026-10-22T10:00:00Z", descripcion: "En camino" }],
  };

  it("mapea el historial a eventos completados", () => {
    const [ev] = trackingAEventos(base);
    expect(ev.label).toBe("En camino");
    expect(ev.completed).toBe(true);
    expect(ev.timestamp).not.toBe("");
  });

  it("devuelve [] con historial vacío", () => {
    expect(trackingAEventos({ ...base, historial: [] })).toEqual([]);
  });
});

describe("mensajeDeError", () => {
  it("usa el mensaje de la API con la primera letra en mayúscula", () => {
    const e = axiosError({ status: 400, data: { error: { code: "x", message: "la fecha debe..." } } });
    expect(mensajeDeError(e)).toBe("La fecha debe...");
  });

  it("avisa de falta de conexión sin response", () => {
    expect(mensajeDeError(axiosError())).toContain("conexión");
  });

  it("devuelve el mensaje por defecto con otros errores", () => {
    expect(mensajeDeError(new Error("x"), "por defecto")).toBe("por defecto");
  });
});

describe("esNoEncontrado", () => {
  it("es true solo con un 404", () => {
    expect(esNoEncontrado(axiosError({ status: 404 }))).toBe(true);
    expect(esNoEncontrado(axiosError({ status: 409 }))).toBe(false);
    expect(esNoEncontrado(new Error("x"))).toBe(false);
  });
});
