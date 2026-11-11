import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EnvioForm } from "./EnvioForm";

vi.mock("@/features/rutas/api", () => ({ listarRutas: vi.fn().mockResolvedValue([]) }));

function montar() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EnvioForm onSubmit={onSubmit} enviando={false} errorServidor={null} />
    </QueryClientProvider>,
  );
  return { onSubmit };
}

describe("EnvioForm (H8)", () => {
  it("no muestra errores antes del primer intento", () => {
    montar();
    fireEvent.change(screen.getByLabelText(/Peso/), { target: { value: "0" } });
    expect(screen.getByLabelText(/Peso/)).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("el error de un campo se limpia apenas se corrige", () => {
    const { onSubmit } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Registrar envío" }));
    expect(onSubmit).not.toHaveBeenCalled();
    const peso = screen.getByLabelText(/Peso/);
    expect(peso).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(peso, { target: { value: "2.5" } });
    expect(peso).not.toHaveAttribute("aria-invalid", "true");
    // Los demás campos obligatorios siguen marcados.
    expect(screen.getByLabelText(/Calle/)).toHaveAttribute("aria-invalid", "true");
  });

  it("el teléfono se autoformatea al salir, el peso acepta coma y el email inválido bloquea sin POST", () => {
    const { onSubmit } = montar();

    // El teléfono crudo se muestra con el formato argentino al salir del campo.
    const telefono = screen.getAllByLabelText("Teléfono")[0];
    fireEvent.change(telefono, { target: { value: "0356415412345" } });
    fireEvent.blur(telefono);
    expect(telefono).toHaveValue("3564 41-2345");

    // Completo los obligatorios con peso en coma y un email inválido.
    fireEvent.change(screen.getByLabelText("Nombre *"), { target: { value: "Juan Pérez" } });
    fireEvent.change(screen.getByLabelText(/Calle/), { target: { value: "San Martín" } });
    fireEvent.change(screen.getByLabelText(/Localidad/), { target: { value: "San Francisco" } });
    fireEvent.change(screen.getByLabelText(/Peso/), { target: { value: "2,5" } });
    expect(screen.getByLabelText(/Peso/)).toHaveValue("2.5");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "no-es-mail" } });

    fireEvent.click(screen.getByRole("button", { name: "Registrar envío" }));
    expect(screen.getByText("El email no es válido. Ejemplo: nombre@empresa.com")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    // Corrijo el email y el envío sale con peso 2.5 y el mail incluido.
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Juan@Empresa.com" } });
    expect(screen.getByLabelText("Email")).toHaveValue("juan@empresa.com");
    fireEvent.click(screen.getByRole("button", { name: "Registrar envío" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [input] = onSubmit.mock.calls[0] as unknown as [
      { paquete: { peso: number }; destinatario: { email: string } },
      string,
    ];
    expect(input.paquete.peso).toBe(2.5);
    expect(input.destinatario.email).toBe("juan@empresa.com");
  });
});
