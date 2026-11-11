import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RepartidorDetallePage } from "./RepartidorDetallePage";
import { listarRepartidores } from "@/features/usuarios/api";
import { listarRutas } from "@/features/rutas/api";
import type { RutaListItem } from "@/features/rutas/types";

vi.mock("@/features/usuarios/api", () => ({ listarRepartidores: vi.fn() }));
vi.mock("@/features/rutas/api", () => ({ listarRutas: vi.fn(), editarRuta: vi.fn() }));
vi.mock("@/services/api-client", () => ({ getApiErrorMessage: (_e: unknown, f?: string) => f ?? "error" }));

const base = { zona: "Centro", estado: "planificada", repartidor_id: "u1", repartidor_nombre: "Carla", cantidad_envios: 1, peso_total: 0, vehiculo_id: "", vehiculo_patente: "" } as const;
const rutas: RutaListItem[] = [
  { ...base, id: "r1", nombre: "Ruta Centro", fecha: "2026-11-09" },
  { ...base, id: "r2", nombre: "Ruta Centro", fecha: "2026-11-10" },
];

describe("RepartidorDetallePage (H28a)", () => {
  it("cada ruta muestra su fecha (más recientes primero) y linkea a su detalle", async () => {
    vi.mocked(listarRepartidores).mockResolvedValue([{ id: "u1", nombre: "Carla" }] as never);
    vi.mocked(listarRutas).mockResolvedValue(rutas);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/repartidores/u1"]}>
          <Routes>
            <Route path="/repartidores/:id" element={<RepartidorDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("columnheader", { name: "Fecha" })).toBeInTheDocument();
    const filas = screen.getAllByRole("row").slice(1);
    expect(filas).toHaveLength(2);
    expect(within(filas[0]).getByRole("link", { name: "Ruta Centro" })).toHaveAttribute("href", "/rutas/r2");
    expect(within(filas[1]).getByRole("link", { name: "Ruta Centro" })).toHaveAttribute("href", "/rutas/r1");
    expect(within(filas[0]).getByText(/10/)).toBeInTheDocument();
    expect(screen.queryByText("2026-11-10")).not.toBeInTheDocument();
  });
});
