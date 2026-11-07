import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Toggle2D3D } from "./Toggle2D3D";

describe("Toggle2D3D", () => {
  it("muestra enlaces a 2D y 3D con el modo 2D activo", () => {
    render(
      <MemoryRouter>
        <Toggle2D3D rutaId="r1" modo="2d" />
      </MemoryRouter>,
    );

    const enlace2D = screen.getByRole("link", { name: /vista 2d/i });
    const enlace3D = screen.getByRole("link", { name: /vista 3d/i });

    expect(enlace2D).toHaveAttribute("href", "/rutas/r1/mapa");
    expect(enlace2D).toHaveAttribute("aria-current", "page");
    expect(enlace3D).toHaveAttribute("href", "/rutas/r1/3d");
    expect(enlace3D).not.toHaveAttribute("aria-current");
  });

  it("resalta modo 3D cuando modo='3d'", () => {
    render(
      <MemoryRouter>
        <Toggle2D3D rutaId="r2" modo="3d" />
      </MemoryRouter>,
    );

    const enlace3D = screen.getByRole("link", { name: /vista 3d/i });
    expect(enlace3D).toHaveAttribute("aria-current", "page");
  });
});
