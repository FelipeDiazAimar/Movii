import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { EnviosListPage } from "./EnviosListPage";
import * as api from "@/features/envios/api";

vi.mock("@/features/envios/api", () => ({ listarEnvios: vi.fn(), eliminarEnvio: vi.fn() }));
vi.mock("@/components/ui/BotonEliminar", () => ({ BotonEliminar: () => null }));

function montar(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EnviosListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EnviosListPage cache", () => {
  it("la segunda visita no muestra el loader y filtra por búsqueda", async () => {
    vi.mocked(api.listarEnvios).mockResolvedValue([
      { id: "e1", codigo_guia: "MOV-001", destinatario: "Juan", direccion: "Mitre 10", peso: 1, estado: "pendiente", fecha_creacion: "2026-10-01T10:00:00Z", ruta_id: null, ruta_nombre: null, repartidor_nombre: null },
    ] as never);
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, retry: false } } });

    const primera = montar(client);
    expect(screen.getByRole("status", { name: "Cargando envíos…" })).toBeInTheDocument();
    expect((await screen.findAllByText("MOV-001")).length).toBeGreaterThan(0);
    primera.unmount();

    montar(client);
    expect(screen.queryByRole("status", { name: "Cargando envíos…" })).not.toBeInTheDocument();
    expect(screen.getAllByText("MOV-001").length).toBeGreaterThan(0);
  });
});
