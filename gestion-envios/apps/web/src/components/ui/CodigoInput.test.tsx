import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CodigoInput } from "./CodigoInput";

function Demo({ onCompleto }: { onCompleto?: (v: string) => void }) {
  const [v, setV] = useState("");
  return <CodigoInput value={v} onChange={setV} onCompleto={onCompleto} />;
}

describe("CodigoInput", () => {
  it("filtra no-dígitos, limita a 6 y avisa al completar", async () => {
    const onCompleto = vi.fn();
    render(<Demo onCompleto={onCompleto} />);
    await userEvent.type(screen.getByLabelText("Código de verificación"), "12a3456789");
    expect(screen.getByLabelText("Código de verificación")).toHaveValue("123456");
    expect(screen.getByText("6/6")).toBeInTheDocument();
    expect(onCompleto).toHaveBeenCalledTimes(1);
    expect(onCompleto).toHaveBeenCalledWith("123456");
  });

  it("cada casilla tiene su aria-label (Dígito 1 de 6, ...) con el valor cargado", async () => {
    render(<Demo />);
    expect(screen.getByRole("listitem", { name: "Dígito 1 de 6, vacío" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    await userEvent.type(screen.getByLabelText("Código de verificación"), "48");
    expect(screen.getByRole("listitem", { name: "Dígito 1 de 6: 4" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Dígito 2 de 6: 8" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Dígito 6 de 6, vacío" })).toBeInTheDocument();
  });

  it("el botón Pegar lee el portapapeles y completa las celdas", async () => {
    render(<Demo />);
    Object.defineProperty(navigator, "clipboard", { value: { readText: () => Promise.resolve("code: 482 915") }, configurable: true });
    await userEvent.click(screen.getByRole("button", { name: /Pegar código/ }));
    expect(await screen.findByText("¡Pegado!")).toBeInTheDocument();
    expect(screen.getByLabelText("Código de verificación")).toHaveValue("482915");
  });

  it("si el portapapeles no se puede leer, avisa en vez de romper", async () => {
    render(<Demo />);
    Object.defineProperty(navigator, "clipboard", { value: { readText: () => Promise.reject(new Error("denegado")) }, configurable: true });
    await userEvent.click(screen.getByRole("button", { name: /Pegar código/ }));
    expect(await screen.findByText(/Ctrl\+V/)).toBeInTheDocument();
  });
});
