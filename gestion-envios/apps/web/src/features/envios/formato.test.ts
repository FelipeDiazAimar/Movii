import { describe, expect, it } from "vitest";
import { altaCompacta, comentarioLegible, fechaLegible, franjaLegible, hoyISO, textoCompromiso } from "./formato";

describe("formato de envíos", () => {
  it("hoyISO usa la fecha local", () => {
    expect(hoyISO(new Date(2026, 10, 5, 23, 59))).toBe("2026-11-05");
  });

  it("fechaLegible arma '12 nov. 2026' y deja igual lo que no es fecha", () => {
    expect(fechaLegible("2026-11-12")).toBe("12 nov. 2026");
    expect(fechaLegible("2026-01-01")).toBe("1 ene. 2026");
    expect(fechaLegible("mañana")).toBe("mañana");
  });

  it("franjaLegible pone la tilde", () => {
    expect(franjaLegible("manana")).toBe("mañana");
    expect(franjaLegible(null)).toBe("");
  });

  it("textoCompromiso (H26)", () => {
    expect(textoCompromiso("2026-11-12", "manana")).toBe("Comprometido para 12 nov. 2026 (mañana)");
    expect(textoCompromiso("2026-11-12", null)).toBe("Comprometido para 12 nov. 2026");
  });

  it("comentarioLegible traduce los comentarios viejos de reprogramación", () => {
    expect(comentarioLegible("reprogramado para 2026-11-12 (manana)")).toBe("Reprogramado para el 12 nov. 2026 (mañana)");
    expect(comentarioLegible("el perro no deja pasar")).toBe("el perro no deja pasar");
  });

  it("altaCompacta separa día y hora (H36)", () => {
    const { dia, hora } = altaCompacta(new Date(2026, 10, 10, 14, 5).toISOString());
    expect(dia).toBe("10 nov. 2026");
    expect(hora).toBe("14:05");
    expect(altaCompacta("cualquiera")).toEqual({ dia: "cualquiera", hora: "" });
  });
});
