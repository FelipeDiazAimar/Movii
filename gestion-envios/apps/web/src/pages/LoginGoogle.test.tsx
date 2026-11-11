import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LoginPage } from "./LoginPage";

// T2: botón "Continuar con Google" (feature flag) y vuelta de Google.
// T1: el 428 del login lleva a /primer-acceso.

const login = vi.fn();
const abrirSesion = vi.fn();
const obtenerConfigAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ sesion: null, cargando: false, login, verificarCodigo: vi.fn(), abrirSesion, logout: vi.fn() }),
}));
vi.mock("@/features/auth/api", () => ({
  reenviarCodigo: vi.fn(),
  obtenerConfigAuth: () => obtenerConfigAuth(),
  urlLoginGoogle: () => "http://api.test/auth/google",
}));
vi.mock("@/services/api-client", () => ({
  getApiErrorMessage: (_e: unknown, fallback?: string) => fallback ?? "error",
}));

function EstadoPrimerAcceso() {
  const { state } = useLocation();
  return <p>Primer acceso de {(state as { email: string }).email}</p>;
}

function renderPage(url = "/login") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/operaciones" element={<p>Panel</p>} />
        <Route path="/primer-acceso" element={<EstadoPrimerAcceso />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage — Google y primer acceso", () => {
  beforeEach(() => {
    login.mockReset();
    abrirSesion.mockReset();
    obtenerConfigAuth.mockReset();
  });

  it("sin GOOGLE_* en la API el botón no aparece", async () => {
    obtenerConfigAuth.mockResolvedValue({ google: false });
    renderPage();
    await screen.findByRole("button", { name: "Ingresar" });
    await Promise.resolve();
    expect(obtenerConfigAuth).toHaveBeenCalled();
    expect(screen.queryByText("Continuar con Google")).not.toBeInTheDocument();
  });

  it("si la API falla el botón tampoco aparece", async () => {
    obtenerConfigAuth.mockRejectedValue(new Error("sin red"));
    renderPage();
    await screen.findByRole("button", { name: "Ingresar" });
    expect(screen.queryByText("Continuar con Google")).not.toBeInTheDocument();
  });

  it("con Google habilitado muestra el botón que va a /auth/google", async () => {
    obtenerConfigAuth.mockResolvedValue({ google: true });
    renderPage();
    const boton = await screen.findByRole("link", { name: "Continuar con Google" });
    expect(boton).toHaveAttribute("href", "http://api.test/auth/google");
  });

  it("muestra el error con el que vuelve de Google (?error=cancelado)", async () => {
    obtenerConfigAuth.mockResolvedValue({ google: true });
    renderPage("/login?error=cancelado");
    expect(await screen.findByRole("alert")).toHaveTextContent("Cancelaste el inicio de sesión con Google.");
  });

  it("al volver de Google con #token abre la sesión y entra", async () => {
    obtenerConfigAuth.mockResolvedValue({ google: true });
    abrirSesion.mockReturnValue({ token: "jwt", usuarioId: "u1", rol: "operador", email: "ana@gmail.com" });
    renderPage("/login#token=jwt&email=ana%40gmail.com");
    expect(await screen.findByText("Panel")).toBeInTheDocument();
    expect(abrirSesion).toHaveBeenCalledWith("jwt", "ana@gmail.com");
  });

  it("el 428 del login lleva a /primer-acceso", async () => {
    obtenerConfigAuth.mockResolvedValue({ google: false });
    login.mockResolvedValue({ user_id: "u1", token: "t428", email: "supervisor@movii.demo" });
    renderPage();
    await userEvent.click(screen.getByLabelText("Email"));
    await userEvent.paste("supervisor@movii.demo");
    await userEvent.click(screen.getByLabelText("Contraseña"));
    await userEvent.paste("clave-temporal");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("Primer acceso de supervisor@movii.demo")).toBeInTheDocument();
  });
});
