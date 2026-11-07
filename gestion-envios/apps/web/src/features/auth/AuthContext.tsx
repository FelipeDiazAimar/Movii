import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import { TOKEN_STORAGE_KEY, setOnUnauthorized } from "@/services/api-client";
import { decodeJwt, isTokenExpired } from "./jwt";
import * as authApi from "./api";
import type { DesafioLogin, LoginInput, PrimerAccesoPendiente, Sesion } from "./types";

const EMAIL_STORAGE_KEY = "movii.web.email";

interface AuthContextValue {
  sesion: Sesion | null;
  cargando: boolean;
  /**
   * Devuelve la sesión, el desafío del código por WhatsApp (si tiene celular)
   * o, en el primer acceso (428, T1), los datos para elegir contraseña nueva.
   */
  login: (input: LoginInput) => Promise<Sesion | DesafioLogin | PrimerAccesoPendiente>;
  /** Segundo paso del login (HU-16): valida el código de 6 dígitos y abre la sesión. */
  verificarCodigo: (desafioId: string, codigo: string, email: string) => Promise<Sesion>;
  /** Abre la sesión con un token ya obtenido (primer acceso o vuelta de Google). */
  abrirSesion: (token: string, email: string) => Sesion;
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

  const loginConToken = useCallback((token: string, identificador: string): Sesion => {
    const claims = decodeJwt(token);
    if (!claims) {
      throw new Error("El servidor devolvió un token inválido");
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(EMAIL_STORAGE_KEY, identificador);

    const nuevaSesion: Sesion = {
      token,
      usuarioId: claims.sub,
      rol: claims.rol,
      email: identificador,
    };
    setSesion(nuevaSesion);
    return nuevaSesion;
  }, []);

  const login = useCallback(
    async (input: LoginInput): Promise<Sesion | DesafioLogin | PrimerAccesoPendiente> => {
      let r: authApi.LoginRespuesta;
      try {
        r = await authApi.login(input);
      } catch (err) {
        if (axios.isAxiosError<{ user_id?: string; token?: string }>(err) && err.response?.status === 428) {
          const { user_id = "", token = "" } = err.response.data ?? {};
          return { user_id, token, email: input.email };
        }
        throw err;
      }
      if ("token" in r && r.token) return loginConToken(r.token, input.email);
      return r as DesafioLogin;
    },
    [loginConToken],
  );

  const verificarCodigo = useCallback(
    async (desafioId: string, codigo: string, email: string): Promise<Sesion> => {
      const { token } = await authApi.verificarCodigo(desafioId, codigo);
      return loginConToken(token, email);
    },
    [loginConToken],
  );

  const value = useMemo(
    () => ({ sesion, cargando, login, verificarCodigo, abrirSesion: loginConToken, logout }),
    [sesion, cargando, login, verificarCodigo, loginConToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
