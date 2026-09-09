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

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegistroInput {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
}

export interface UsuarioCreado {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}
