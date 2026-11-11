import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
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

// Pegado en vez de tipeo letra por letra: mismo resultado y no come el timeout del test.
async function completarCredenciales() {
  await userEvent.click(screen.getByLabelText("Email"));
  await userEvent.paste("supervisor@movii.demo");
  await userEvent.click(screen.getByLabelText("Contraseña"));
  await userEvent.paste("clave-de-prueba");
}

describe("LoginPage — login en dos pasos (HU-16)", () => {
  beforeEach(() => {
    login.mockReset();
    verificarCodigo.mockReset();
  });

  it("los campos arrancan vacíos (H1: nunca precargar credenciales)", () => {
    renderPage();
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("autocomplete", "current-password");
  });

  it("con los campos vacíos avisa y no llama a la API", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Completá el email y la contraseña.");
    expect(login).not.toHaveBeenCalled();
  });

  it("un 401 (credenciales incorrectas) se muestra sin console.error (H6)", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    login.mockRejectedValue(
      new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 401,
        statusText: "",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { error: { code: "credenciales_invalidas", message: "email o contraseña incorrectos" } },
      }),
    );
    renderPage();
    await completarCredenciales();
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo iniciar sesión");
    expect(consola).not.toHaveBeenCalled();
    consola.mockRestore();
  });

  it("sin celular entra directo con la contraseña", async () => {
    login.mockResolvedValue(sesion);
    renderPage();
    await completarCredenciales();
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(login).toHaveBeenCalledWith({ email: "supervisor@movii.demo", password: "clave-de-prueba" });
    expect(await screen.findByText("Panel")).toBeInTheDocument();
    expect(verificarCodigo).not.toHaveBeenCalled();
  });

  it("con celular pide el código de WhatsApp y recién ahí entra", async () => {
    login.mockResolvedValue({ desafio_id: "d1", telefono: "+54 9 3564 ••••45", vence_en_segundos: 300 });
    verificarCodigo.mockResolvedValue(sesion);
    renderPage();

    await completarCredenciales();
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
