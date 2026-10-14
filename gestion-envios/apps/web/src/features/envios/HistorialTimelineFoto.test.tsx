import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistorialTimeline } from "./HistorialTimeline";
import { apiClient } from "@/services/api-client";
import type { EventoEnvio, TrackingEvento } from "./types";

vi.mock("@/services/api-client", () => ({
  apiClient: { get: vi.fn() },
  getApiErrorMessage: (_e: unknown, fallback?: string) => fallback ?? "error",
}));

const apiGet = vi.mocked(apiClient.get);

function incidencia(overrides: Partial<EventoEnvio> = {}): EventoEnvio {
  return {
    id: "ev-foto-1",
    fecha: "2026-09-10T10:00:00Z",
    actor_nombre: "Juan Repartidor",
    estado_anterior: "en_camino",
    estado_nuevo: "no_entregado",
    motivo: "cliente_ausente",
    comentario: null,
    tiene_foto: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:foto-falsa");
  URL.revokeObjectURL = vi.fn();
});

describe("HistorialTimeline botón Ver foto (HU-07)", () => {
  it("muestra Ver foto solo en incidencias (motivo no-null) con tiene_foto", () => {
    render(
      <HistorialTimeline
        envioId="env-1"
        eventos={[
          incidencia(),
          incidencia({ id: "ev-sin-foto", motivo: "otro", tiene_foto: false }),
          incidencia({ id: "ev-transicion", motivo: null, estado_nuevo: "en_camino", tiene_foto: true }),
        ]}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Ver foto" })).toHaveLength(1);
  });

  it("sin envioId no muestra el botón aunque haya foto (tracking)", () => {
    render(<HistorialTimeline eventos={[incidencia()]} />);
    expect(screen.queryByRole("button", { name: "Ver foto" })).not.toBeInTheDocument();
  });

  it("eventos de tracking nunca muestran el botón", () => {
    const eventos: TrackingEvento[] = [
      { fecha: "2026-09-10T10:00:00Z", descripcion: "No se pudo entregar: cliente ausente", motivo: "cliente_ausente" },
    ];
    render(<HistorialTimeline envioId="env-1" eventos={eventos} />);
    expect(screen.queryByRole("button", { name: "Ver foto" })).not.toBeInTheDocument();
  });

  it("clic descarga el blob y muestra la imagen; segundo clic la oculta", async () => {
    const user = userEvent.setup();
    apiGet.mockResolvedValueOnce({ data: new Blob(["foto"], { type: "image/jpeg" }) } as never);
    render(<HistorialTimeline envioId="env-1" eventos={[incidencia()]} />);

    await user.click(screen.getByRole("button", { name: "Ver foto" }));

    expect(apiGet).toHaveBeenCalledWith("/envios/env-1/eventos/ev-foto-1/foto", { responseType: "blob" });
    await waitFor(() => expect(screen.getByAltText("Foto de incidencia")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Ocultar foto" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ocultar foto" }));
    expect(screen.queryByAltText("Foto de incidencia")).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("si la descarga falla muestra un error", async () => {
    const user = userEvent.setup();
    apiGet.mockRejectedValueOnce(new Error("boom"));
    render(<HistorialTimeline envioId="env-1" eventos={[incidencia()]} />);

    await user.click(screen.getByRole("button", { name: "Ver foto" }));

    await waitFor(() => expect(screen.getByText("No se pudo cargar la foto")).toBeInTheDocument());
    expect(screen.queryByAltText("Foto de incidencia")).not.toBeInTheDocument();
  });
});
