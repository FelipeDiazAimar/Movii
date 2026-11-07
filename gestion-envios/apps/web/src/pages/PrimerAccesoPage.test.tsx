import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PrimerAccesoPage } from "./PrimerAccesoPage";

const abrirSesion = vi.fn();
const cambiarPasswordPrimerAcceso = vi.fn();
const verificarPrimerAcceso = vi.fn();
const reenviarPrimerAcceso = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ abrirSesion }) }));
vi.mock("@/features/auth/api", () => ({
  cambiarPasswordPrimerAcceso: (...a: unknown[]) => cambiarPasswordPrimerAcceso(...a),
  verificarPrimerAcceso: (...a: unknown[]) => verificarPrimerAcceso(...a),
  reenviarPrimerAcceso: (...a: unknown[]) => reenviarPrimerAcceso(...a),
}));
vi.mock("@/services/api-client", () => ({
  getApiErrorMessage: (_e: unknown, fallback?: string) => fallback ?? "error",
}));

const pendiente = { user_id: "u1", token: "t428", email: "nuevo@movii.demo" };

function renderPage(entrada: string | { pathname: string; state: unknown } = { pathname: "/primer-acceso", state: pendiente }) {
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/primer-acceso" element={<PrimerAccesoPage />} />
        <Route path="/login" element={<p>Login</p>} />
        <Route path="/operaciones" element={<p>Panel</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function elegirPassword(nueva: string, repetir = nueva) {
  await userEvent.type(screen.getByLabelText("Contraseña nueva"), nueva);
  await userEvent.type(screen.getByLabelText("Repetí la contraseña"), repetir);
  await userEvent.click(screen.getByRole("button", { name: "Guardar y continuar" }));
}

describe("PrimerAccesoPage (T1)", () => {
  beforeEach(() => {
    [abrirSesion, cambiarPasswordPrimerAcceso, verificarPrimerAcceso, reenviarPrimerAcceso].forEach((f) => f.mockReset());
  });

  it("sin venir del login vuelve a /login", () => {
    renderPage("/primer-acceso");
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("valida las reglas de la contraseña antes de llamar a la API", async () => {
    renderPage();
    await elegirPassword("corta1A");
    expect(screen.getByText("Usá al menos 8 caracteres")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Contraseña nueva"));
    await userEvent.clear(screen.getByLabelText("Repetí la contraseña"));
    await elegirPassword("sinmayuscula1");
    expect(screen.getByText("Incluí al menos una mayúscula")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Contraseña nueva"));
    await userEvent.clear(screen.getByLabelText("Repetí la contraseña"));
    await elegirPassword("NuevaClave1", "NuevaClave2");
    expect(screen.getByText("Las contraseñas no coinciden")).toBeInTheDocument();
    expect(cambiarPasswordPrimerAcceso).not.toHaveBeenCalled();
  });

  it("cambia la contraseña, muestra el canal (mail) y entra con el código", async () => {
    cambiarPasswordPrimerAcceso.mockResolvedValue({ desafio_id: "d1", telefono: "", canal: "mail", destino: "n•••@movii.demo", vence_en_segundos: 600 });
    verificarPrimerAcceso.mockResolvedValue({ token: "jwt" });
    abrirSesion.mockReturnValue({ token: "jwt", usuarioId: "u1", rol: "operador", email: "nuevo@movii.demo" });
    renderPage();

    await elegirPassword("NuevaClave1");
    expect(cambiarPasswordPrimerAcceso).toHaveBeenCalledWith("u1", "t428", "NuevaClave1");
    expect(await screen.findByText("por mail a n•••@movii.demo")).toBeInTheDocument();
    expect(screen.getByText(/Vence en 10 minutos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reenviar código en/ })).toBeDisabled();

    const boton = screen.getByRole("button", { name: "Verificar e ingresar" });
    expect(boton).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Código de verificación"), "12a3456");
    await userEvent.click(boton);
    expect(verificarPrimerAcceso).toHaveBeenCalledWith("d1", "123456");
    await waitFor(() => expect(abrirSesion).toHaveBeenCalledWith("jwt", "nuevo@movii.demo")); // tras la ola verde de aceptación
    expect(await screen.findByText("Panel")).toBeInTheDocument();
  });

  it("muestra el error de la API si el código es incorrecto", async () => {
    cambiarPasswordPrimerAcceso.mockResolvedValue({ desafio_id: "d1", telefono: "+54 9 3564 ••••22", canal: "whatsapp", destino: "+54 9 3564 ••••22", vence_en_segundos: 600 });
    verificarPrimerAcceso.mockRejectedValue(new Error("401"));
    renderPage();
    await elegirPassword("NuevaClave1");
    expect(await screen.findByText("por WhatsApp al +54 9 3564 ••••22")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Código de verificación"), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Verificar e ingresar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo verificar el código");
    expect(abrirSesion).not.toHaveBeenCalled();
  });

  it("al volver de Google con el primer acceso pendiente va directo al código", async () => {
    renderPage("/primer-acceso#desafio_id=d9&canal=mail&destino=a%E2%80%A2%E2%80%A2%E2%80%A2%40gmail.com&vence_en_segundos=600&email=ana%40gmail.com");
    expect(screen.getByText("por mail a a•••@gmail.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("Contraseña nueva")).not.toBeInTheDocument();
  });
});
