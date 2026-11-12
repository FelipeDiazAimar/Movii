import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export const TOKEN_STORAGE_KEY = "movii.web.token";

/** Callback registrado por AuthProvider para reaccionar a un 401 global. */
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  // Ninguna pantalla queda "cargando" para siempre si la API no responde.
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

/** Forma uniforme de error que devuelve la API: { error: { code, message } }. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

/** Primera letra en mayúscula: la API manda sus mensajes en minúscula. */
function conMayuscula(texto: string): string {
  const limpio = texto.trim();
  return limpio.charAt(0).toLocaleUpperCase("es") + limpio.slice(1);
}

/**
 * Extrae un mensaje legible de un error de axios contra esta API. Es el único
 * lugar por donde pasan los mensajes de la API hacia la interfaz: acá se les
 * pone la mayúscula inicial.
 */
export function getApiErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado"): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.error?.message;
    if (message?.trim()) return conMayuscula(message);
    if (error.code === "ECONNABORTED") {
      return "El servidor tardó demasiado en responder. Probá de nuevo.";
    }
    if (error.code === "ERR_NETWORK") {
      return "No se pudo conectar con el servidor. Verificá que la API esté corriendo.";
    }
  }
  if (error instanceof Error && error.name === "RolNoPermitidoError") return error.message;
  return fallback;
}
