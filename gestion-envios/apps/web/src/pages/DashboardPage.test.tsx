import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPage } from "./DashboardPage";
import { obtenerDashboard } from "@/features/analitica/api";
import type { Dashboard } from "@/features/analitica/types";

vi.mock("@/features/analitica/api", () => ({ obtenerDashboard: vi.fn() }));
vi.mock("@/services/api-client", () => ({
  getApiErrorMessage: (_e: unknown, fallback?: string) => fallback ?? "error",
}));

const base: Dashboard = {
  fecha: "2026-10-22",
  metricas: { total_envios: 150, pendientes: 25, asignados: 40, en_camino: 35, entregados: 42, no_entregados: 8, porcentaje_efectividad: 84 },
  rutas_activas: [
    { ruta_id: "r1", nombre: "Ruta Centro", repartidor_nombre: "Carla", total_paradas: 20, completadas: 14, porcentaje_avance: 70, estado_ruta: "en_curso" },
  ],
  ultimas_alertas: [{ envio_id: "e1", codigo_guia: "MOV-1", tipo: "incidencia", descripcion: "Destinatario ausente", fecha: "2026-10-22T14:35:00Z" }],
};

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  it("renderiza KPIs, ruta y alerta", async () => {
    vi.mocked(obtenerDashboard).mockResolvedValue(base);
    renderPage();
    expect(await screen.findByText("150")).toBeInTheDocument();
    expect(screen.getByText("84%")).toBeInTheDocument();
    expect(screen.getByText("Ruta Centro")).toHaveAttribute("href", "/rutas/r1");
    expect(screen.getByText("Ver mapa")).toHaveAttribute("href", "/rutas/r1/mapa");
    expect(screen.getByText("MOV-1")).toHaveAttribute("href", "/envios/e1");
  });

  it("sin rutas muestra EmptyState", async () => {
    vi.mocked(obtenerDashboard).mockResolvedValue({ ...base, rutas_activas: [] });
    renderPage();
    expect(await screen.findByText("Sin rutas para esta fecha")).toBeInTheDocument();
  });
});
