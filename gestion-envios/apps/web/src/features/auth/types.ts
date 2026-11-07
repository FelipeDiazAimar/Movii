export const ROLES = ["operador", "admin", "repartidor"] as const;
export type Rol = (typeof ROLES)[number];

export interface JwtClaims {
  sub: string;
  rol: Rol;
  exp: number;
}

export interface Sesion {
  token: string;
  usuarioId: string;
  rol: Rol;
  email: string;
}

/** Segundo paso pendiente del login: el código ya salió por WhatsApp o por mail. */
export interface DesafioLogin {
  desafio_id: string;
  /** Celular enmascarado para mostrar (+54 9 3564 ••••45); vacío si salió por mail. */
  telefono: string;
  /** Por dónde salió el código (T1). */
  canal?: "whatsapp" | "mail";
  /** Celular o mail enmascarado (a•••@movii.demo). */
  destino?: string;
  vence_en_segundos: number;
}

/** 428 del login (T1): primer acceso pendiente, hay que elegir contraseña nueva. */
export interface PrimerAccesoPendiente {
  user_id: string;
  /** Solo sirve para cambiar la contraseña (vence a los 15 minutos). */
  token: string;
  email: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegistroInput {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
  /** Celular (opcional) para entrar con código y recibir avisos por WhatsApp. */
  telefono?: string;
}

export interface UsuarioCreado {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}
