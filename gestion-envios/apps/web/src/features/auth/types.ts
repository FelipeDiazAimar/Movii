export const ROLES = ["operador", "supervisor", "repartidor"] as const;
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

/** Segundo paso pendiente del login: el código ya salió por WhatsApp. */
export interface DesafioLogin {
  desafio_id: string;
  /** Celular enmascarado para mostrar (+54 9 3564 ••••45). */
  telefono: string;
  vence_en_segundos: number;
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
