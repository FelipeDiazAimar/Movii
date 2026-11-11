import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RutaForm } from "./RutaForm";

vi.mock("./RepartidorSelect", () => ({
  RepartidorSelect: ({ value, error }: { value: string; error?: string }) => (
    <div>
      <span data-testid="repartidor">{value}</span>
      {error && <p>{error}</p>}
    </div>
  ),
}));

const REPARTIDOR = "33333333-3333-3333-3333-333333333333";

describe("RutaForm", () => {
  it("sin nombre no envía y muestra el error junto al campo", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RutaForm valoresIniciales={{ nombre: "", zona: "", repartidor_id: REPARTIDOR }} onSubmit={onSubmit} enviando={false} errorServidor={null} />);

    await userEvent.click(screen.getByRole("button", { name: "Crear ruta" }));

    expect(await screen.findByText("El nombre es obligatorio")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/)).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("con nombre envía los datos recortados", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RutaForm valoresIniciales={{ nombre: "", zona: "", repartidor_id: REPARTIDOR }} onSubmit={onSubmit} enviando={false} errorServidor={null} />);

    await userEvent.type(screen.getByLabelText(/Nombre/), "  Ruta Centro ");
    await userEvent.click(screen.getByRole("button", { name: "Crear ruta" }));

    expect(onSubmit).toHaveBeenCalledWith({ nombre: "Ruta Centro", zona: "", repartidor_id: REPARTIDOR });
  });
});
