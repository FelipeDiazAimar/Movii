import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./LoginPage";

const login = vi.fn();
const verificarCodigo = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ sesion: null, cargando: false, login, verificarCodigo, abrirSesion: vi.fn(), logout: vi.fn() }),
}));
vi.mock("@/features/auth/api", () => ({
  reenviarCodigo: vi.fn(),
  obtenerConfigAuth: vi.fn().mockResolvedValue({ google: false }),
  urlLoginGoogle: () => "http://api.test/auth/google",
}));
vi.mock("@/services/api-client", () => ({
  getApiErrorMessage: (_e: unknown, fallback?: string) => fallback ?? "error",
}));

async function escribirCredenciales() {
  await userEvent.type(screen.getByLabelText("Email"), "supervisor@movii.demo");
  await userEvent.type(screen.getByLabelText("Contraseña"), "clave-de-prueba");
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/operaciones" element={<p>Panel</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const sesion = { token: "t", usuarioId: "u1", rol: "admin", email: "supervisor@movii.demo" };

describe("LoginPage — login en dos pasos (HU-16)", () => {
  beforeEach(() => {
    login.mockReset();
    verificarCodigo.mockReset();
  });

  it("sin celular entra directo con la contraseña", async () => {
    login.mockResolvedValue(sesion);
    renderPage();
    await escribirCredenciales();
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("Panel")).toBeInTheDocument();
    expect(verificarCodigo).not.toHaveBeenCalled();
  });

  it("con celular pide el código de WhatsApp y recién ahí entra", async () => {
    login.mockResolvedValue({ desafio_id: "d1", telefono: "+54 9 3564 ••••45", vence_en_segundos: 300 });
    verificarCodigo.mockResolvedValue(sesion);
    renderPage();
    await escribirCredenciales();

    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText(/\+54 9 3564 ••••45/)).toBeInTheDocument();
    const boton = screen.getByRole("button", { name: "Verificar e ingresar" });
    expect(boton).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Código de verificación"), "12a3456");
    expect(boton).toBeEnabled();
    await userEvent.click(boton);

    expect(verificarCodigo).toHaveBeenCalledWith("d1", "123456", "supervisor@movii.demo");
    expect(await screen.findByText("Panel")).toBeInTheDocument();
  });
});
