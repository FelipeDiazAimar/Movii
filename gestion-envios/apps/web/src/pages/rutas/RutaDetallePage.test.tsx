import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RutaDetallePage } from "./RutaDetallePage";
import { obtenerRuta } from "@/features/rutas/api";
import { obtenerMapaRuta } from "@/features/analitica/api";
import type { RutaDetalle } from "@/features/rutas/types";
import type { MapaRuta } from "@/features/analitica/types";

vi.mock("@/features/rutas/api", () => ({
  obtenerRuta: vi.fn(),
  editarRuta: vi.fn(),
  desasignarEnvio: vi.fn(),
  eliminarRuta: vi.fn(),
}));
vi.mock("@/features/analitica/api", () => ({ obtenerMapaRuta: vi.fn() }));
vi.mock("@/features/flota/VehiculoRutaCard", () => ({ VehiculoRutaCard: () => null }));
vi.mock("@/features/mapas/BotonAbrirMaps", () => ({ BotonAbrirMaps: () => null }));
vi.mock("@/features/rutas/AsignarEnviosPanel", () => ({ AsignarEnviosPanel: () => null }));
vi.mock("@/components/ui/BotonEliminar", () => ({ BotonEliminar: () => null }));
vi.mock("@/features/rutas/BotonIniciarRuta", () => ({ BotonIniciarRuta: () => null }));
vi.mock("@/services/api-client", () => ({
  getApiErrorMessage: (_e: unknown, fallback?: string) => fallback ?? "error",
}));

const envioBase = { peso: 2, tamano: "chico", tipo_contenido: "documentacion", fragil: false, urgente: false, remitente_id: "r", destinatario_id: "d", ruta_id: "r1" };

const ruta: RutaDetalle = {
  id: "r1",
  nombre: "Ruta Centro",
  zona: "Centro",
  fecha: "2026-11-10",
  estado: "planificada",
  repartidor_id: "u1",
  repartidor_nombre: "Carla",
  envios: [
    { id: "e1", codigo_guia: "MOV-1", estado: "asignado", ...envioBase },
    { id: "e2", codigo_guia: "MOV-2", estado: "asignado", ...envioBase },
  ],
  peso_total: 4,
  cantidad_envios: 2,
};

const mapa: MapaRuta = {
  ruta_id: "r1",
  nombre: "Ruta Centro",
  fecha: "2026-11-10",
  repartidor: { id: "u1", nombre: "Carla" },
  paradas: [
    { orden: 1, envio_id: "e1", codigo_guia: "MOV-1", estado: "asignado", destinatario_nombre: "Ana Pérez", direccion: "San Martín 1", localidad: "Rafaela", coordenadas: null },
  ],
};

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/rutas/r1"]}>
        <Routes>
          <Route path="/rutas/:id" element={<RutaDetallePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RutaDetallePage", () => {
  it("muestra la fecha legible, el destinatario y el código como link al envío", async () => {
    vi.mocked(obtenerRuta).mockResolvedValue(ruta);
    vi.mocked(obtenerMapaRuta).mockResolvedValue(mapa);
    renderPage();

    expect((await screen.findAllByText("Fecha")).length).toBeGreaterThan(0);
    expect(screen.queryByText("2026-11-10")).not.toBeInTheDocument();
    expect(screen.getAllByText(/nov/).length).toBeGreaterThan(0);

    expect(screen.getByRole("columnheader", { name: "Destinatario" })).toBeInTheDocument();
    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("San Martín 1, Rafaela")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "MOV-1" })).toHaveAttribute("href", "/envios/e1");
    expect(screen.getByRole("link", { name: "MOV-2" })).toHaveAttribute("href", "/envios/e2");
  });
});
