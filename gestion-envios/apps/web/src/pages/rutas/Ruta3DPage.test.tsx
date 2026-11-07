import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/pages/rutas/RutaMapaPage", () => ({ RutaMapaPage: () => <div>vista-2d</div> }));

import { Ruta3DPage } from "./Ruta3DPage";
import { hayWebGL } from "@/features/mapas/webgl";

describe("Ruta3DPage", () => {
  it("sin WebGL (jsdom) cae a la vista 2D", () => {
    expect(hayWebGL()).toBe(false);
    render(
      <MemoryRouter initialEntries={["/rutas/1/3d"]}>
        <Routes>
          <Route path="/rutas/:id/3d" element={<Ruta3DPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("vista-2d")).toBeInTheDocument();
  });
});
