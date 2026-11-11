import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BotonIniciarRuta } from "./BotonIniciarRuta";

let rol = "operador";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ sesion: { rol } }) }));
const iniciarRuta = vi.fn();
vi.mock("./api", () => ({ iniciarRuta: (id: string) => iniciarRuta(id) }));
vi.mock("@/services/api-client", () => ({ getApiErrorMessage: (_e: unknown, f?: string) => f ?? "error" }));

function renderBoton(estado: string, asignados?: number) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BotonIniciarRuta rutaId="r1" estado={estado} asignados={asignados} />
    </QueryClientProvider>,
  );
}

describe("BotonIniciarRuta", () => {
  it("con la ruta planificada lo inicia", async () => {
    rol = "operador";
    iniciarRuta.mockResolvedValue({ envios_en_camino: 5 });
    renderBoton("planificada", 5);
    await userEvent.click(screen.getByRole("button", { name: /Iniciar ruta/ }));
    expect(iniciarRuta).toHaveBeenCalledWith("r1");
  });

  it("no aparece si la ruta ya salió, si no hay nada en el depósito o para el repartidor", () => {
    rol = "operador";
    renderBoton("en_curso", 5);
    renderBoton("planificada", 0);
    rol = "repartidor";
    renderBoton("planificada", 5);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
