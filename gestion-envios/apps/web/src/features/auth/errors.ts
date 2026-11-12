/** El rol de la cuenta no puede usar este panel (los repartidores usan la app móvil). */
export const MENSAJE_ROL_NO_PERMITIDO =
  "Esta cuenta es de repartidor y no tiene acceso al panel de operadores. Ingresá desde la app de repartidores.";

export class RolNoPermitidoError extends Error {
  constructor(message: string = MENSAJE_ROL_NO_PERMITIDO) {
    super(message);
    this.name = "RolNoPermitidoError";
  }
}
