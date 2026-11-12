import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "@/hooks/useAuth";

const login = vi.fn();
vi.mock("./api", () => ({ login: (...a: unknown[]) => login(...a) }));

function jwt(rol: string) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
  return `${b64({ alg: "HS256" })}.${b64({ sub: "u1", rol, exp: Math.floor(Date.now() / 1000) + 600 })}.firma`;
}

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("AuthContext — el panel web es solo para operadores y admins", () => {
  beforeEach(() => {
    login.mockReset();
    localStorage.clear();
  });

  it("rechaza a un repartidor y no guarda la sesión", async () => {
    login.mockResolvedValue({ token: jwt("repartidor") });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(act(() => result.current.login({ email: "r@movii.demo", password: "x" }))).rejects.toThrow(/repartidor/i);
    expect(localStorage.getItem("movii.web.token")).toBeNull();
    expect(result.current.sesion).toBeNull();
  });

  it("rechaza al repartidor en su primer acceso (428) antes de mostrar el cambio de contraseña", async () => {
    const err = Object.assign(new Error("428"), { isAxiosError: true, response: { status: 428, data: { user_id: "u1", token: "t", rol: "repartidor" } } });
    login.mockRejectedValue(err);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(act(() => result.current.login({ email: "r@movii.demo", password: "x" }))).rejects.toThrow(/repartidor/i);
  });

  it("un operador entra normal", async () => {
    login.mockResolvedValue({ token: jwt("operador") });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login({ email: "o@movii.demo", password: "x" }));
    expect(result.current.sesion?.rol).toBe("operador");
  });
});
