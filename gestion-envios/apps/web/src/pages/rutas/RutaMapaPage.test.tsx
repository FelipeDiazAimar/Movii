import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RutaMapaPage } from "./RutaMapaPage";
import { obtenerMapaRuta } from "@/features/analitica/api";
import type { MapaRuta } from "@/features/analitica/types";

vi.mock("@/features/analitica/api", () => ({ obtenerMapaRuta: vi.fn() }));
vi.mock("@/services/api-client", () => ({
  getApiErrorMessage: (_e: unknown, fallback?: string) => fallback ?? "error",
}));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  Polyline: () => null,
  Marker: () => <span data-testid="marker" />,
  Popup: () => null,
  useMap: () => ({ fitBounds: vi.fn() }),
}));

const mapa: MapaRuta = {
  ruta_id: "r1",
  nombre: "Ruta Centro",
  fecha: "2026-10-22",
  repartidor: { id: "u1", nombre: "Carla" },
  paradas: [
    { orden: 1, envio_id: "e1", codigo_guia: "MOV-1", estado: "entregado", destinatario_nombre: "Ana", direccion: "San Martin 1", localidad: "Rafaela", coordenadas: { lat: -31.42, lng: -62.08 } },
    { orden: 2, envio_id: "e2", codigo_guia: "MOV-2", estado: "pendiente", destinatario_nombre: "Beto", direccion: "Belgrano 2", localidad: "Rafaela", coordenadas: null },
  ],
};

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/rutas/r1/mapa"]}>
        <Routes>
          <Route path="/rutas/:id/mapa" element={<RutaMapaPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RutaMapaPage", () => {
  it("lista paradas e indica la que no tiene ubicación", async () => {
    vi.mocked(obtenerMapaRuta).mockResolvedValue(mapa);
    renderPage();
    expect(await screen.findByText("MOV-1")).toBeInTheDocument();
    expect(screen.getByText("MOV-2")).toBeInTheDocument();
    expect(screen.getAllByText("Sin ubicación geográfica")).toHaveLength(1);
    expect(screen.getAllByTestId("marker")).toHaveLength(1);
  });

  it("sin ninguna coordenada no renderiza el mapa", async () => {
    vi.mocked(obtenerMapaRuta).mockResolvedValue({ ...mapa, paradas: [mapa.paradas[1]] });
    renderPage();
    expect(await screen.findByText("Ninguna parada tiene ubicación geográfica")).toBeInTheDocument();
    expect(screen.queryByTestId("mapa")).not.toBeInTheDocument();
  });
});
