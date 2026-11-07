import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ReportesPage } from "./ReportesPage";
import * as api from "@/features/analitica/api";

vi.mock("@/features/analitica/api", () => ({
  reporteEnvios: vi.fn(),
  descargarReporteEnviosCSV: vi.fn(),
  rankingRepartidores: vi.fn(),
  reporteIncidencias: vi.fn(),
}));
vi.mock("@/services/api-client", () => ({
  getApiErrorMessage: (_e: unknown, fallback?: string) => fallback ?? "error",
}));

const periodo = { desde: "2026-10-01", hasta: "2026-10-22" };

function renderPage() {
  vi.mocked(api.reporteEnvios).mockResolvedValue({ periodo, total: 0, envios: [] });
  vi.mocked(api.descargarReporteEnviosCSV).mockResolvedValue();
  vi.mocked(api.rankingRepartidores).mockResolvedValue({
    periodo,
    ranking: [
      { posicion: 1, repartidor_id: "a", nombre: "Carla", asignados: 30, entregados: 28, fallidos: 2, tasa_efectividad: 93.33, promedio_minutos_entrega: null },
    ],
  });
  vi.mocked(api.reporteIncidencias).mockResolvedValue({
    periodo,
    total_incidencias: 45,
    distribucion: [{ motivo: "cliente_ausente", etiqueta: "Destinatario ausente", cantidad: 25, porcentaje: 55.56 }],
  });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ReportesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ReportesPage", () => {
  it("cambia de pestaña y muestra ranking e incidencias", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole("tab", { name: "Envíos" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "Repartidores" }));
    expect(screen.getByRole("tab", { name: "Repartidores" })).toHaveAttribute("aria-selected", "true");
    expect((await screen.findAllByText("Carla")).length).toBeGreaterThan(0);
    expect(screen.getByText("—")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Incidencias" }));
    expect(await screen.findByText("Destinatario ausente")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("25 (55.56%)")).toBeInTheDocument();
  });

  it("Descargar CSV llama a la API con desde/hasta", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Descargar CSV" }));
    expect(api.descargarReporteEnviosCSV).toHaveBeenCalledWith(
      expect.objectContaining({ desde: expect.stringMatching(/^\d{4}-\d{2}-01$/), hasta: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
    );
  });

  it("desde posterior a hasta muestra error de validacion", async () => {
    const user = userEvent.setup();
    renderPage();
    const hasta = screen.getByLabelText("Hasta");
    await user.clear(hasta);
    await user.type(hasta, "2000-01-01");
    expect(screen.getAllByText("La fecha desde no puede ser posterior a hasta").length).toBeGreaterThan(0);
  });
});
