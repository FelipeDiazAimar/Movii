import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BotonSimulacion } from "./BotonSimulacion";

let rol = "admin";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ sesion: { rol } }) }));
const reiniciarDia = vi.fn();
vi.mock("./api", () => ({ reiniciarDia: () => reiniciarDia() }));
vi.mock("@/services/api-client", () => ({ getApiErrorMessage: (_e: unknown, f?: string) => f ?? "error" }));

function renderBoton() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BotonSimulacion />
    </QueryClientProvider>,
  );
}

describe("BotonSimulacion", () => {
  it("no lo ve quien no es admin", () => {
    rol = "operador";
    renderBoton();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("cada toque deja el estado inicial y avisa cuántas rutas quedaron", async () => {
    rol = "admin";
    reiniciarDia.mockResolvedValue({ fecha: "2026-11-11", rutas_hoy: 3, envios_hoy: 31, envios_borrados: 40, dias_historial_nuevos: 0, duracion_ms: 900 });
    renderBoton();
    const boton = screen.getByRole("button", { name: "Simular un día normal desde el inicio" });
    await userEvent.click(boton);
    expect((await screen.findAllByText("Día listo: 3 rutas y 31 envíos en reparto")).length).toBeGreaterThan(0);
    await userEvent.click(boton);
    expect(reiniciarDia).toHaveBeenCalledTimes(2);
  });

  it("si falla lo dice", async () => {
    rol = "admin";
    reiniciarDia.mockRejectedValue(new Error("x"));
    renderBoton();
    await userEvent.click(screen.getByRole("button", { name: "Simular un día normal desde el inicio" }));
    expect((await screen.findAllByText("No se pudo preparar el día")).length).toBeGreaterThan(0);
  });
});
