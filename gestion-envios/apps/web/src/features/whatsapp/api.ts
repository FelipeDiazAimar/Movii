import { apiClient } from "@/services/api-client";

export interface EstadoWhatsapp {
  habilitado: boolean;
  conectado: boolean;
  vinculado: boolean;
  numero?: string;
  qr_imagen?: string;
  qr_vence?: string;
  /** Canal de respaldo de los avisos (mail). */
  mail?: { configurado: boolean; proveedor: "gmail" | "smtp" | "resend" | "log"; remitente?: string };
}

export interface AvisoEnvio {
  tipo: string;
  canal?: "whatsapp" | "mail";
  estado: "pendiente" | "enviado" | "fallido" | "omitido" | "simulado";
  mensaje: string;
  error: string | null;
  created_at: string;
}

export async function estadoWhatsapp(): Promise<EstadoWhatsapp> {
  const { data } = await apiClient.get<EstadoWhatsapp>("/admin/whatsapp/estado");
  return data;
}

export async function desvincularWhatsapp(): Promise<void> {
  await apiClient.post("/admin/whatsapp/desvincular");
}

export async function avisosDeEnvio(envioId: string): Promise<AvisoEnvio[]> {
  const { data } = await apiClient.get<AvisoEnvio[]>(`/envios/${envioId}/avisos`);
  return data;
}

export async function actualizarTelefono(usuarioId: string, telefono: string): Promise<string> {
  const { data } = await apiClient.put<{ telefono: string }>(`/users/${usuarioId}/telefono`, { telefono });
  return data.telefono;
}

/** 5493564412345 → +54 9 3564412345 (solo para mostrar). */
export function formatearTelefono(tel: string): string {
  return /^549\d{10}$/.test(tel) ? `+54 9 ${tel.slice(3)}` : tel;
}
