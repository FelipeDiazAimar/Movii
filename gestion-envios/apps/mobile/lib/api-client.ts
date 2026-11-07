import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { FranjaHoraria, MotivoFallo, RelacionReceptor, TrackingInfo } from "@/lib/seguimiento";
import type { Shipment, ShipmentStatus } from "@/types/logistics";

// En web servida por un túnel (devtunnels: <id>-8081.dominio) la API va por el túnel
// del 8080: una página https no puede llamar a http://IP-de-la-LAN (contenido mixto).
const hostTunel = Platform.OS === "web" && typeof window !== "undefined" ? window.location.host : "";
const API_URL = /-8081\./.test(hostTunel)
  ? `https://${hostTunel.replace("-8081.", "-8080.")}`
  : (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080");

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
  nombre?: string;
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
  // atob existe en Hermes (RN), web y Node 16+; Buffer no existe en el navegador.
  const binario = atob(payloadBase64.padEnd(Math.ceil(payloadBase64.length / 4) * 4, "="));
  const payloadJson = decodeURIComponent(binario.replace(/[\s\S]/g, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")));
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
export async function login(email: string, password: string): Promise<(ClaimsJWT & { token: string }) | DesafioLogin> {
  const { data } = await api.post<{ token?: string } & Partial<DesafioLogin>>("/auth/login", { email, password });
  if (!data.token) {
    // Segundo paso (HU-16): el código de 6 dígitos ya salió por WhatsApp.
    return { desafio_id: data.desafio_id ?? "", telefono: data.telefono ?? "", vence_en_segundos: data.vence_en_segundos ?? 300 };
  }
  await saveToken(data.token);
  const claims = decodeJwt(data.token);
  return { ...claims, token: data.token };
}

/** Segundo paso pendiente del login: el código ya salió por WhatsApp (o por mail, primer acceso T1). */
export type DesafioLogin = {
  desafio_id: string;
  /** Celular enmascarado (+54 9 3564 ••••45); vacío si salió por mail. */
  telefono: string;
  canal?: "whatsapp" | "mail";
  /** Celular o mail enmascarado. */
  destino?: string;
  vence_en_segundos: number;
};

/** Métodos de login disponibles (T2): sin GOOGLE_* en la API, google es false. */
export async function obtenerConfigAuth(): Promise<{ google: boolean }> {
  const { data } = await api.get<{ google: boolean }>("/auth/config");
  return data;
}

const ERRORES_GOOGLE: Record<string, string> = {
  cancelado: "Cancelaste el inicio de sesión con Google.",
  google_denied: "Google no autorizó el inicio de sesión.",
  email_no_verificado: "Tu cuenta de Google no tiene el email verificado.",
  cuenta_inactiva: "Tu usuario está dado de baja.",
  google_otra_cuenta: "Ese email ya está vinculado a otra cuenta de Google.",
  google_no_configurado: "El ingreso con Google no está habilitado.",
  codigo_no_enviado: "No pudimos enviarte el código de verificación. Probá de nuevo en un minuto.",
};

/**
 * Lee la URL con la que la API vuelve a la app después de Google (T2):
 * movii://auth#token=...&email=..., movii://auth#desafio_id=...&canal=... (primer
 * acceso) o movii://auth?error=cancelado.
 */
export function leerVueltaGoogle(url: string): { token?: string; email?: string; desafio?: DesafioLogin; error?: string } {
  const i = url.search(/[?#]/);
  const p: Record<string, string> = {};
  for (const par of (i < 0 ? "" : url.slice(i + 1)).split(/[&#?]/)) {
    const [k, v = ""] = par.split("=");
    if (k) p[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  if (p.error) return { error: ERRORES_GOOGLE[p.error] ?? "No se pudo iniciar sesión con Google." };
  if (p.token) return { token: p.token, email: p.email };
  if (p.desafio_id) {
    const canal = p.canal === "whatsapp" ? "whatsapp" : "mail";
    const destino = p.destino ?? "";
    return {
      email: p.email,
      desafio: { desafio_id: p.desafio_id, canal, destino, telefono: canal === "whatsapp" ? destino : "", vence_en_segundos: Number(p.vence_en_segundos) || 600 },
    };
  }
  return { error: "No se pudo iniciar sesión con Google." };
}

/** Canjea el código de WhatsApp por el token y lo guarda (igual que login). */
export async function verificarCodigoLogin(desafioId: string, codigo: string): Promise<ClaimsJWT & { token: string }> {
  const { data } = await api.post<{ token: string }>("/auth/login/verificar", { desafio_id: desafioId, codigo });
  await saveToken(data.token);
  return { ...decodeJwt(data.token), token: data.token };
}

/** Manda un código nuevo (invalida el anterior). */
export async function reenviarCodigoLogin(desafioId: string): Promise<DesafioLogin> {
  const { data } = await api.post<DesafioLogin>("/auth/login/reenviar", { desafio_id: desafioId });
  return data;
}

export async function logout(): Promise<void> {
  await clearToken();
}

/**
 * Estados de un envio tal como los nombra la API (internal/domain/envio.go).
 * "asignado" es el estado con el que un envio entra en la ruta del dia del
 * repartidor; el prototipo lo muestra como "pendiente" (ver
 * mapEnvioDelDiaToShipment) porque no tiene un badge visual propio.
 */
export type EstadoEnvioAPI = "pendiente" | "asignado" | "en_camino" | "entregado" | "no_entregado";

export type EnvioDelDiaAPI = {
  id: string;
  codigo_guia: string;
  estado: EstadoEnvioAPI;
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
  /** Vacio cuando el repartidor no tiene nada asignado hoy. */
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
    estadoApi: envio.estado,
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
export async function getEnviosDelDia(estado?: EstadoEnvioAPI): Promise<ResumenDelDiaAPI> {
  const { data } = await api.get<ResumenDelDiaAPI>("/repartidor/envios-del-dia", {
    params: estado ? { estado } : undefined,
  });
  // La API ya devuelve [] cuando el repartidor no tiene envios hoy, pero se
  // normaliza igual por si responde una version anterior que mandaba null:
  // con null la pantalla rompia y mostraba un error de conexion enganoso.
  return { ...data, rutas: data.rutas ?? [] };
}

// ---------- Sprint 2: seguimiento de la entrega (HU-06 a HU-10) ----------
// Mismos endpoints que usa la web; la API valida pertenencia por el JWT (un
// envío de otro repartidor responde 404) y la matriz de transiciones.

/** HU-06: PUT /envios/{id}/estado (asignado ⇄ en_camino). */
export async function actualizarEstadoEnvio(id: string, nuevoEstado: "asignado" | "en_camino"): Promise<void> {
  await api.put(`/envios/${id}/estado`, { estado: nuevoEstado });
}

/** HU-07: POST /envios/{id}/incidencia → no_entregado. La foto va en base64 JPEG, sin prefijo data:. */
export async function registrarIncidencia(
  id: string,
  data: { motivo: MotivoFallo; comentario?: string; foto_base64?: string },
): Promise<void> {
  await api.post(`/envios/${id}/incidencia`, data);
}

/** HU-08: POST /envios/{id}/confirmacion → entregado (firma PNG + foto JPEG en base64). */
export async function confirmarEntrega(
  id: string,
  data: { receptor_nombre: string; receptor_relacion: RelacionReceptor; firma_base64: string; foto_base64: string },
): Promise<void> {
  // Dos imágenes de hasta 5 MB tardan más que el timeout por defecto en redes móviles.
  await api.post(`/envios/${id}/confirmacion`, data, { timeout: 60000 });
}

/** HU-09: POST /envios/{id}/reprogramacion → pendiente (fecha ≥ hoy UTC, franja obligatoria). */
export async function reprogramarEnvio(id: string, data: { nueva_fecha: string; franja: FranjaHoraria }): Promise<void> {
  await api.post(`/envios/${id}/reprogramacion`, data);
}

/** HU-10: GET /tracking/{codigo}, público (no necesita sesión). */
export async function consultarTracking(codigo: string): Promise<TrackingInfo> {
  const { data } = await api.get<TrackingInfo>(`/tracking/${encodeURIComponent(codigo.trim())}`);
  return { ...data, historial: data.historial ?? [] };
}

// ---------- Sprint 3: mapa de ruta (HU-12) ----------

export type ParadaMapaAPI = {
  orden: number;
  envio_id: string;
  codigo_guia: string;
  estado: EstadoEnvioAPI;
  destinatario_nombre: string;
  direccion: string;
  localidad: string;
  /** null cuando la dirección no pudo geocodificarse. */
  coordenadas: { lat: number; lng: number } | null;
};

export type PosicionVehiculoAPI = {
  vehiculo_id: string;
  patente: string;
  ruta_id: string | null;
  lat: number;
  lng: number;
  velocidad: number;
  rumbo: number;
  en: string;
};

export type RecorridoAPI = {
  /** Polilínea por calles [[lat, lng], ...]. */
  geometria: [number, number][];
  distancia_m: number;
  duracion_s: number;
};

export type MapaRutaAPI = {
  ruta_id: string;
  nombre: string;
  fecha: string;
  repartidor: { id: string; nombre: string };
  paradas: ParadaMapaAPI[];
  /** Vehículo de la ruta con su última posición (GPS simulado en la demo). */
  vehiculo?: PosicionVehiculoAPI | null;
  /** Recorrido por calles depósito → paradas. */
  recorrido?: RecorridoAPI | null;
  deposito?: { lat: number; lng: number };
};

export type TrayectoAPI = {
  envio_id: string;
  codigo_guia: string;
  estado: EstadoEnvioAPI;
  destino: { lat: number; lng: number } | null;
  direccion: string;
  vehiculo: PosicionVehiculoAPI | null;
  recorrido: RecorridoAPI | null;
  paradas_antes: number;
};

/** HU-12: GET /rutas/{id}/mapa (404 si la ruta no existe o es de otro repartidor). */
export async function obtenerMapaRuta(rutaId: string): Promise<MapaRutaAPI> {
  const { data } = await api.get<MapaRutaAPI>(`/rutas/${encodeURIComponent(rutaId)}/mapa`);
  return { ...data, paradas: data.paradas ?? [] };
}

/** Camino por calles desde el vehículo hasta el destino del envío (solo envíos de mis rutas). */
export async function obtenerTrayecto(envioId: string): Promise<TrayectoAPI> {
  const { data } = await api.get<TrayectoAPI>(`/envios/${encodeURIComponent(envioId)}/trayecto`);
  return data;
}


// ---------- Perfil del repartidor ----------

export type PerfilRepartidorAPI = {
  nombre: string;
  email: string;
  /** Enmascarado: ••••45 (vacío si no tiene). */
  telefono: string;
  rol: string;
  miembro_desde: string;
  con_google: boolean;
  historico: {
    entregados: number;
    no_entregados: number;
    efectividad: number;
    kg_entregados: number;
    rutas_completadas: number;
    dias_trabajados: number;
    promedio_por_dia: number;
    mejor_dia: number;
    fragiles_entregados: number;
  };
  /** Últimos 7 días, del más viejo a hoy. */
  ultimos_dias: { fecha: string; entregados: number; no_entregados: number }[];
  motivos_fallo: { motivo: string; cantidad: number }[];
  vehiculo_hoy: {
    patente: string;
    modelo: string;
    tipo: string;
    color: string;
    capacidad_peso: number;
    carga_actual_peso: number;
    capacidad_porcentaje: number;
    velocidad: number;
    temperatura: number;
  } | null;
  rutas_hoy: number;
  primera_entrega_hoy?: string;
  ultima_entrega_hoy?: string;
};

/** GET /repartidor/perfil: cuenta, vehículo de hoy y rendimiento histórico. */
export async function obtenerPerfil(): Promise<PerfilRepartidorAPI> {
  const { data } = await api.get<PerfilRepartidorAPI>("/repartidor/perfil");
  return { ...data, ultimos_dias: data.ultimos_dias ?? [], motivos_fallo: data.motivos_fallo ?? [] };
}
