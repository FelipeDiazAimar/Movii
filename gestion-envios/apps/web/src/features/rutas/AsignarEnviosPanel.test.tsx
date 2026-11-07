import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AsignarEnviosPanel } from "./AsignarEnviosPanel";
import { asignarEnvios, recomendarEnvio } from "./api";
import { listarEnvios } from "@/features/envios/api";

vi.mock("./api", () => ({ asignarEnvios: vi.fn(), recomendarEnvio: vi.fn() }));
vi.mock("@/features/envios/api", () => ({ listarEnvios: vi.fn() }));
vi.mock("@/services/api-client", () => ({ getApiErrorMessage: (_e: unknown, f?: string) => f ?? "error" }));

const envio = { id: "e1", codigo_guia: "MOV-1", destinatario: "Ana", peso: 2 };

function renderPanel() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AsignarEnviosPanel rutaId="r1" onAsignado={() => {}} />
    </QueryClientProvider>,
  );
}

describe("AsignarEnviosPanel (T4)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listarEnvios).mockResolvedValue([envio] as never);
    vi.mocked(asignarEnvios).mockResolvedValue({ asignados: 1 });
  });

  it("verde: muestra el badge y asigna sin forzar", async () => {
    vi.mocked(recomendarEnvio).mockResolvedValue({ extra_km: 1.2, desvio_pct: 8, recomendacion: "conviene", motivo: "" });
    renderPanel();
    await userEvent.click(await screen.findByRole("checkbox"));
    expect(await screen.findByText("Conviene (+1.2km, +8%)")).toBeInTheDocument();
    const boton = screen.getByRole("button", { name: /Asignar/ });
    await waitFor(() => expect(boton).toBeEnabled());
    await userEvent.click(boton);
    await waitFor(() => expect(asignarEnvios).toHaveBeenCalledWith("r1", ["e1"], false));
  });

  it("direccion invalida (422): deshabilita Asignar", async () => {
    vi.mocked(recomendarEnvio).mockRejectedValue(Object.assign(new Error("x"), { isAxiosError: true, response: { status: 422 } }));
    renderPanel();
    await userEvent.click(await screen.findByRole("checkbox"));
    expect(await screen.findByText("Dirección inválida")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Asignar/ })).toBeDisabled();
  });

  it("rojo: exige Asignar igual y manda forzar=true", async () => {
    vi.mocked(recomendarEnvio).mockResolvedValue({ extra_km: 9, desvio_pct: 80, recomendacion: "no_conviene", motivo: "" });
    renderPanel();
    await userEvent.click(await screen.findByRole("checkbox"));
    expect(await screen.findByText(/No conviene/)).toBeInTheDocument();
    const boton = screen.getByRole("button", { name: /Asignar \(1\)/ });
    expect(boton).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Asignar igual"));
    await waitFor(() => expect(boton).toBeEnabled());
    await userEvent.click(boton);
    await waitFor(() => expect(asignarEnvios).toHaveBeenCalledWith("r1", ["e1"], true));
  });
});
