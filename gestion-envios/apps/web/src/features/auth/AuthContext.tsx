import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { TOKEN_STORAGE_KEY, setOnUnauthorized } from "@/services/api-client";
import { decodeJwt, isTokenExpired } from "./jwt";
import * as authApi from "./api";
import type { LoginInput, Sesion } from "./types";

const EMAIL_STORAGE_KEY = "movii.web.email";

interface AuthContextValue {
  sesion: Sesion | null;
  cargando: boolean;
  login: (input: LoginInput) => Promise<Sesion>;
  logout: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

function leerSesionGuardada(): Sesion | null {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return null;

  const claims = decodeJwt(token);
  if (!claims || isTokenExpired(claims)) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(EMAIL_STORAGE_KEY);
    return null;
  }

  return {
    token,
    usuarioId: claims.sub,
    rol: claims.rol,
    email: localStorage.getItem(EMAIL_STORAGE_KEY) ?? "",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setSesion(leerSesionGuardada());
    setCargando(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(EMAIL_STORAGE_KEY);
    setSesion(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => logout());
    return () => setOnUnauthorized(null);
  }, [logout]);

  const login = useCallback(async (input: LoginInput): Promise<Sesion> => {
    const { token } = await authApi.login(input);
    const claims = decodeJwt(token);
    if (!claims) {
      throw new Error("El servidor devolvió un token inválido");
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(EMAIL_STORAGE_KEY, input.email);

    const nuevaSesion: Sesion = {
      token,
      usuarioId: claims.sub,
      rol: claims.rol,
      email: input.email,
    };
    setSesion(nuevaSesion);
    return nuevaSesion;
  }, []);

  const value = useMemo(() => ({ sesion, cargando, login, logout }), [sesion, cargando, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
