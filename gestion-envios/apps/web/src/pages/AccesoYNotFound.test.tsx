import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AccesoDenegadoPage } from "./AccesoDenegadoPage";
import { NotFoundPage } from "./NotFoundPage";

// H30/H32: /acceso-denegado siempre tiene salida. H31: 404 legible y con destino según la sesión.

let sesionActual: { token: string; usuarioId: string; rol: string; email: string } | null = null;
const logout = vi.fn(() => {
  sesionActual = null;
});
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ sesion: sesionActual, cargando: false, login: vi.fn(), verificarCodigo: vi.fn(), abrirSesion: vi.fn(), logout }),
}));

function renderEn(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
        <Route path="/operaciones" element={<p>Panel</p>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const repartidor = { token: "t", usuarioId: "u1", rol: "repartidor", email: "repartidor@movii.demo" };
const operador = { token: "t", usuarioId: "u2", rol: "operador", email: "operador@movii.demo" };

describe("AccesoDenegadoPage", () => {
  beforeEach(() => {
    logout.mockClear();
  });

  it("repartidor: Cerrar sesión termina en /login (H30)", async () => {
    sesionActual = repartidor;
    renderEn("/acceso-denegado");
    expect(screen.getByText(/usá la app móvil/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Volver al panel" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Pantalla de login")).toBeInTheDocument();
  });

  it("operador sin permiso: ofrece Volver al panel (H32)", async () => {
    sesionActual = operador;
    renderEn("/acceso-denegado");
    await userEvent.click(screen.getByRole("link", { name: "Volver al panel" }));
    expect(await screen.findByText("Panel")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", () => {
    sesionActual = null;
    renderEn("/acceso-denegado");
    expect(screen.getByText("Pantalla de login")).toBeInTheDocument();
  });
});

describe("NotFoundPage", () => {
  it("con sesión: título y Volver al panel a /operaciones (H31)", () => {
    sesionActual = operador;
    renderEn("/no-existe");
    expect(screen.getByRole("heading", { name: "Página no encontrada" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al panel" })).toHaveAttribute("href", "/operaciones");
  });

  it("sin sesión: lleva al login", () => {
    sesionActual = null;
    renderEn("/no-existe");
    expect(screen.getByRole("link", { name: "Ir a iniciar sesión" })).toHaveAttribute("href", "/login");
  });
});
