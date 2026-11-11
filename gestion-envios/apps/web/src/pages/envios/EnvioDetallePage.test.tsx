import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import { EnvioDetallePage } from "./EnvioDetallePage";
import * as api from "@/features/envios/api";

vi.mock("@/features/envios/api", () => ({ obtenerEnvio: vi.fn(), eliminarEnvio: vi.fn() }));

function errorHttp(status: number) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("fallo", "ERR_BAD_REQUEST", config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: { error: { code: "not_found", message: "el envío no existe" } },
  });
}

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/envios/no-existe"]}>
        <Routes>
          <Route path="/envios/:id" element={<EnvioDetallePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EnvioDetallePage (H33)", () => {
  it("un envío inexistente muestra un estado vacío con título y vuelta al listado", async () => {
    vi.mocked(api.obtenerEnvio).mockRejectedValue(errorHttp(404));
    montar();
    expect(await screen.findByRole("heading", { name: "Envío no encontrado" })).toBeInTheDocument();
    expect(screen.getByText("Este envío no existe")).toBeInTheDocument();
    const volver = screen.getAllByRole("link", { name: /Volver a envíos/ });
    expect(volver.length).toBeGreaterThan(0);
    volver.forEach((l) => expect(l).toHaveAttribute("href", "/envios"));
  });

  it("otros errores siguen mostrando el mensaje de la API", async () => {
    vi.mocked(api.obtenerEnvio).mockRejectedValue(errorHttp(500));
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent("El envío no existe");
  });
});
