import { describe, expect, it } from "vitest";
import { descripcionEvento, dotClassForEstado, motivoLegible } from "./HistorialTimeline";
import type { EventoEnvio } from "./types";

function evento(overrides: Partial<EventoEnvio>): EventoEnvio {
  return {
    fecha: "2026-09-09T15:40:00Z",
    actor_nombre: null,
    estado_anterior: null,
    estado_nuevo: "pendiente",
    motivo: null,
    comentario: null,
    ...overrides,
  };
}

describe("descripcionEvento", () => {
  it("evento raíz (sin anterior) → Envío registrado", () => {
    expect(descripcionEvento(evento({ estado_anterior: null, estado_nuevo: "pendiente" }))).toBe("Envío registrado");
  });

  it("mapea asignado / en_camino / entregado", () => {
    expect(descripcionEvento(evento({ estado_anterior: "pendiente", estado_nuevo: "asignado" }))).toBe(
      "Asignado a ruta de reparto",
    );
    expect(descripcionEvento(evento({ estado_anterior: "asignado", estado_nuevo: "en_camino" }))).toBe("En camino");
    expect(descripcionEvento(evento({ estado_anterior: "en_camino", estado_nuevo: "entregado" }))).toBe("Entregado");
  });

  it("no_entregado sin motivo lo indica", () => {
    expect(descripcionEvento(evento({ estado_anterior: "en_camino", estado_nuevo: "no_entregado" }))).toBe(
      "No se pudo entregar: motivo no especificado",
    );
  });

  it("no_entregado traduce cada motivo de fallo", () => {
    const casos: [string, string][] = [
      ["cliente_ausente", "No se pudo entregar: cliente ausente"],
      ["direccion_incorrecta", "No se pudo entregar: dirección incorrecta"],
      ["rechazado", "No se pudo entregar: rechazado por el destinatario"],
      ["zona_insegura", "No se pudo entregar: zona insegura"],
      ["otro", "No se pudo entregar: otro motivo"],
    ];
    for (const [motivo, esperado] of casos) {
      expect(descripcionEvento(evento({ estado_anterior: "en_camino", estado_nuevo: "no_entregado", motivo }))).toBe(
        esperado,
      );
    }
  });

  it("pendiente desde no_entregado → reprogramado; desde asignado → desasignado", () => {
    expect(descripcionEvento(evento({ estado_anterior: "no_entregado", estado_nuevo: "pendiente" }))).toBe(
      "Reprogramado para un nuevo intento",
    );
    expect(descripcionEvento(evento({ estado_anterior: "asignado", estado_nuevo: "pendiente" }))).toBe(
      "Desasignado de la ruta de reparto",
    );
  });

  it("caso no contemplado → Actualización de estado", () => {
    expect(descripcionEvento(evento({ estado_anterior: "en_camino", estado_nuevo: "pendiente" }))).toBe(
      "Actualización de estado",
    );
  });
});

describe("motivoLegible", () => {
  it("devuelve tal cual un motivo desconocido", () => {
    expect(motivoLegible("cualquier_cosa")).toBe("cualquier_cosa");
  });
});

describe("dotClassForEstado", () => {
  it("mapea cada estado a su color semántico", () => {
    expect(dotClassForEstado("entregado")).toContain("green");
    expect(dotClassForEstado("asignado")).toContain("blue");
    expect(dotClassForEstado("en_camino")).toContain("amber");
    expect(dotClassForEstado("no_entregado")).toContain("red");
    expect(dotClassForEstado("pendiente")).toContain("gray");
    expect(dotClassForEstado("desconocido")).toContain("gray");
  });
});
