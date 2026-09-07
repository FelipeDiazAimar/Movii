import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { Shipment, ShipmentStatus } from "@/types/logistics";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

const TOKEN_KEY = "movii_jwt_token";

export const api = axios.create({ baseURL: API_URL, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Claims mínimas que la API pone en el JWT (ver movii/api internal/services/auth_service.go). */
export type ClaimsJWT = {
  sub: string;
  rol: string;
  exp: number;
};

/**
 * decodeJwt lee el payload de un JWT sin validar la firma — la app confía
 * en el servidor que lo emitió (vía HTTPS/la misma red); esto es solo para
 * leer sub/rol/exp y decidir qué mostrar en la UI, no para autorizar nada
 * por sí solo (eso lo hace la API en cada request).
 */
export function decodeJwt(token: string): ClaimsJWT {
  const partes = token.split(".");
  if (partes.length !== 3) {
    throw new Error("decodeJwt: el token no tiene el formato de un JWT (header.payload.signature)");
  }
  const payloadBase64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
  const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
  return JSON.parse(payloadJson) as ClaimsJWT;
}

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * login llama a POST /auth/login, guarda el token y devuelve las claims
 * decodificadas junto con el token crudo.
 */
export async function login(email: string, password: string): Promise<ClaimsJWT & { token: string }> {
  const { data } = await api.post<{ token: string }>("/auth/login", { email, password });
  await saveToken(data.token);
  const claims = decodeJwt(data.token);
  return { ...claims, token: data.token };
}

export async function logout(): Promise<void> {
  await clearToken();
}

export type EnvioDelDiaAPI = {
  id: string;
  codigo_guia: string;
  estado: string;
  peso: number;
  tamano: string;
  tipo_contenido: string;
  fragil: boolean;
  urgente: boolean;
  ruta_id: string | null;
  ruta_nombre: string;
  destinatario: {
    id: string;
    nombre: string;
    telefono: string;
    calle: string;
    numero: string;
    piso_depto: string;
    localidad: string;
    codigo_postal: string;
  };
};

export type RutaConEnviosAPI = {
  ruta_id: string;
  ruta_nombre: string;
  envios: EnvioDelDiaAPI[];
};

export type ResumenDelDiaAPI = {
  fecha: string;
  rutas: RutaConEnviosAPI[];
  total: number;
  pendientes: number;
  asignados: number;
  en_camino: number;
  entregados: number;
  no_entregados: number;
};

/**
 * mapEnvioDelDiaToShipment adapta un envío real de la API a la forma
 * Shipment que ya usan los componentes del prototipo (StopCard, etc.), para
 * no tener que rediseñar la UI. El backend todavía no tiene un estado
 * "asignado" en el vocabulario visual del prototipo, así que se muestra
 * como "pendiente" (semánticamente el más cercano: ya tiene ruta pero
 * todavía no salió a repartir).
 */
export function mapEnvioDelDiaToShipment(envio: EnvioDelDiaAPI, driverId: string, stopOrder: number): Shipment {
  const status: ShipmentStatus = envio.estado === "asignado" ? "pendiente" : (envio.estado as ShipmentStatus);

  return {
    id: envio.id,
    code: envio.codigo_guia,
    recipient: {
      name: envio.destinatario.nombre,
      address: `${envio.destinatario.calle} ${envio.destinatario.numero}`.trim(),
      locality: envio.destinatario.localidad,
      postalCode: envio.destinatario.codigo_postal,
      phone: envio.destinatario.telefono,
    },
    sender: "",
    zone: "Centro",
    driverId,
    routeName: envio.ruta_nombre,
    stopOrder,
    timeWindow: "",
    estimatedDate: "Hoy",
    status,
    packageDescription: envio.tipo_contenido || "Paquete",
    weight: `${envio.peso} kg`,
    fragile: envio.fragil,
    timeline: [],
  };
}

/** getEnviosDelDia llama a GET /repartidor/envios-del-dia?estado=. */
export async function getEnviosDelDia(estado?: string): Promise<ResumenDelDiaAPI> {
  const { data } = await api.get<ResumenDelDiaAPI>("/repartidor/envios-del-dia", {
    params: estado ? { estado } : undefined,
  });
  return data;
}
