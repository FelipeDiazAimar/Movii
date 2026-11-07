import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BotonEliminar } from "./BotonEliminar";

let rol = "operador";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ sesion: { rol } }) }));
vi.mock("@/services/api-client", () => ({
  getApiErrorMessage: (_e: unknown, fallback?: string) => fallback ?? "error",
}));

function renderBoton(eliminar = vi.fn().mockResolvedValue(undefined)) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BotonEliminar nombre="Ruta Norte" eliminar={eliminar} />
    </QueryClientProvider>,
  );
  return eliminar;
}

describe("BotonEliminar", () => {
  it("no se ve con rol operador", () => {
    rol = "operador";
    renderBoton();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("con admin confirma y llama a eliminar", async () => {
    rol = "admin";
    const eliminar = renderBoton();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar Ruta Norte" }));
    expect(screen.getByText(/¿Eliminar Ruta Norte\?/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(eliminar).toHaveBeenCalledTimes(1);
  });
});
