import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "./AppLayout";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    sesion: { email: "operador@movii.test", rol: "operador" },
    logout: vi.fn(),
  }),
}));

const CLAVE = "movii.web.sidebar";

function renderLayout() {
  render(
    <MemoryRouter initialEntries={["/operaciones"]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/operaciones" element={<div>Contenido</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AppLayout (sidebar escritorio)", () => {
  it("arranca contraído cuando no hay preferencia guardada", () => {
    renderLayout();
    expect(screen.getByRole("button", { name: "Expandir menú" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });

  it("respeta la preferencia guardada de menú expandido", () => {
    localStorage.setItem(CLAVE, "0");
    renderLayout();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contraer menú" })).toBeInTheDocument();
  });

  it("se expande al pasar el cursor y se contrae a los 250 ms al salir", () => {
    renderLayout();
    const panel = screen.getByTestId("sidebar");
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();

    fireEvent.mouseEnter(panel);
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fijar menú" })).toBeInTheDocument();

    fireEvent.mouseLeave(panel);
    // Demora: sigue abierto justo después de salir.
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });

  it("la zona del borde izquierdo también expande el panel", () => {
    renderLayout();
    fireEvent.mouseEnter(screen.getByTestId("borde-expandir"));
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("el foco del teclado expande y al salir contrae", () => {
    renderLayout();
    const link = screen.getByRole("link", { name: "Operaciones" });
    fireEvent.focus(link);
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    fireEvent.blur(link);
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });

  it("el botón fija el menú expandido, guarda la preferencia y lo vuelve a contraer", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: "Expandir menú" }));
    expect(localStorage.getItem(CLAVE)).toBe("0");
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    const contraer = screen.getByRole("button", { name: "Contraer menú" });
    expect(contraer).toHaveAttribute("aria-expanded", "true");

    // Fijado: salir con el cursor no lo contrae.
    fireEvent.mouseLeave(screen.getByTestId("sidebar"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Contraer menú" }));
    expect(localStorage.getItem(CLAVE)).toBe("1");
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
    expect(screen.getByRole("button", { name: "Expandir menú" })).toBeInTheDocument();
  });
});

describe("AppLayout (modo claro)", () => {
  afterEach(() => {
    delete document.documentElement.dataset.tema;
  });

  it("arranca en el look de siempre y alterna a claro, recordando la elección", () => {
    renderLayout();
    expect(document.documentElement.dataset.tema).toBe("oscuro");

    fireEvent.click(screen.getAllByRole("button", { name: "Modo claro" })[0]);
    expect(document.documentElement.dataset.tema).toBe("claro");
    expect(localStorage.getItem("movii.web.tema")).toBe("claro");
    expect(screen.getAllByRole("button", { name: "Modo oscuro" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Modo oscuro" })[0]);
    expect(document.documentElement.dataset.tema).toBe("oscuro");
    expect(localStorage.getItem("movii.web.tema")).toBe("oscuro");
  });

  it("respeta el tema claro guardado", () => {
    localStorage.setItem("movii.web.tema", "claro");
    renderLayout();
    expect(document.documentElement.dataset.tema).toBe("claro");
  });
});
