import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export const TOKEN_STORAGE_KEY = "movii.web.token";

/** Callback registrado por AuthProvider para reaccionar a un 401 global. */
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export const apiClient = axios.create({
  baseURL: API_URL,
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

/** Extrae un mensaje legible de un error de axios contra esta API. */
export function getApiErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado"): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.error?.message;
    if (message) return message;
    if (error.code === "ERR_NETWORK") {
      return "No se pudo conectar con el servidor. Verificá que la API esté corriendo.";
    }
  }
  return fallback;
}
