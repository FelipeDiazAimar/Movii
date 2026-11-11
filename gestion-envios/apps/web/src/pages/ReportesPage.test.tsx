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
    distribucion: [{ motivo: "cliente_ausente", etiqueta: "Destinatario ausente", cantidad: 25, porcentaje: 55.56, casos: [{ codigo_guia: "MOV-20261111-0002", destinatario: "Panadería Don Julio", direccion: "Bv. 25 de Mayo 1500, San Francisco", repartidor: "Diego Repartidor", fecha: "2026-11-11T15:00:00Z", comentario: "Nadie atendió" }] }],
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

  it("la tasa se aclara sobre envíos cerrados y muestra — si no hay cerrados (H28b)", async () => {
    const user = userEvent.setup();
    renderPage();
    vi.mocked(api.rankingRepartidores).mockResolvedValue({
      periodo,
      ranking: [
        { posicion: 1, repartidor_id: "a", nombre: "Carla", asignados: 30, entregados: 28, fallidos: 2, tasa_efectividad: 93.33, promedio_minutos_entrega: 12 },
        { posicion: 2, repartidor_id: "b", nombre: "Dario", asignados: 5, entregados: 0, fallidos: 0, tasa_efectividad: 0, promedio_minutos_entrega: 8 },
      ],
    });
    await user.click(screen.getByRole("tab", { name: "Repartidores" }));
    expect(await screen.findByRole("columnheader", { name: "Tasa sobre cerrados" })).toBeInTheDocument();
    expect(screen.getByText(/se calcula sobre los envíos cerrados/)).toBeInTheDocument();
    expect(screen.getByText("93,3% de efectividad")).toBeInTheDocument();
    expect(screen.getByText("Sin envíos cerrados")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("al abrir una barra de incidencias muestra qué envío fue y qué repartidor lo registró", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Incidencias" }));
    expect(screen.queryByText("Diego Repartidor")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Destinatario ausente: 25 incidencias/ }));
    expect(screen.getByText("Diego Repartidor")).toBeInTheDocument();
    expect(screen.getByText("MOV-20261111-0002")).toBeInTheDocument();
    expect(screen.getByText("Nadie atendió")).toBeInTheDocument();
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
    // Hasta: retrocede un mes en el calendario y elige un día anterior al "desde".
    await user.click(screen.getByLabelText("Hasta"));
    await user.click(screen.getByRole("button", { name: "Mes anterior" }));
    await user.click(screen.getAllByRole("gridcell").find((c) => /^15 de /.test(c.getAttribute("aria-label") ?? ""))!);
    expect(screen.getAllByText("La fecha desde no puede ser posterior a hasta").length).toBeGreaterThan(0);
  });
});
