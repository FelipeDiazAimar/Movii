/**
 * Máscaras y validadores puros para los campos de la web.
 *
 * Convención: `limpiar*AlEscribir` filtra lo que se tipea (para el `onChange`);
 * el autoformato con guiones/espacios se aplica al salir del campo (`onBlur`).
 * Los `validar*` devuelven el mensaje en español o `null` si el valor sirve
 * (vacío = válido: la obligatoriedad la decide cada formulario).
 */

/** Deja solo los dígitos, recortado a `max` caracteres. */
export function soloDigitos(s: string, max: number): string {
  return s.replace(/\D/g, "").slice(0, max);
}

// ---------------------------------------------------------------------------
// Teléfono argentino
// ---------------------------------------------------------------------------

export const TELEFONO_MAX = 20;
export const TELEFONO_EJEMPLO = "3564 41-2345";
export const TELEFONO_ERROR = `El teléfono no es válido. Ejemplo: ${TELEFONO_EJEMPLO}`;

/** Al escribir: deja dígitos, espacios, `+`, `-`, `(`, `)`; máx. 20. */
export function limpiarTelefonoAlEscribir(s: string): string {
  return s.replace(/[^0-9+()\- ]/g, "").slice(0, TELEFONO_MAX);
}

/**
 * Lleva un número argentino a sus 10 dígitos nacionales (código de área +
 * número), o `null` si no se puede. Porta el algoritmo de Go
 * `NormalizarTelefonoAR` (services/api/internal/services/telefono.go):
 * quita 549/54, el 0 inicial, el 15 después de la característica y asume
 * 3564 cuando viene sin característica. Devuelve los 10 dígitos (sin el 549
 * que Go antepone para WhatsApp).
 */
export function normalizarTelefonoAR(entrada: string): string | null {
  let d = entrada.replace(/\D/g, "");

  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54") && d.length >= 12) d = d.slice(2);

  if (d.startsWith("0")) d = d.slice(1);

  // Sin código de área: número local de San Francisco, con o sin 15.
  if (d.length <= 8) {
    if (d.startsWith("15")) d = d.slice(2);
    d = "3564" + d;
  }

  // Quitar el "15" que va después del código de área (de 2, 3 o 4 dígitos).
  if (d.length === 12) {
    for (const largoArea of [2, 3, 4]) {
      if (d.slice(largoArea, largoArea + 2) === "15") {
        d = d.slice(0, largoArea) + d.slice(largoArea + 2);
        break;
      }
    }
  }

  if (d.length !== 10 || d.startsWith("0")) return null;
  return d;
}

/** Características de 3 dígitos (la "11" es de 2; el resto, de 4). */
const AREAS_3 = new Set(
  "220 221 223 230 236 237 249 260 261 263 264 266 280 291 294 297 298 299 336 341 342 343 345 348 351 353 358 362 364 370 376 379 380 381 383 385 387 388".split(" "),
);

/**
 * Muestra los 10 dígitos nacionales con el formato usual: característica +
 * espacio + número con guion antes de los últimos 4 (`3564 41-2345`,
 * `351 456-7890`, `11 4567-8901`). Si no normaliza, devuelve la entrada
 * sin cambios.
 */
export function formatearTelefonoAR(s: string): string {
  const n = normalizarTelefonoAR(s);
  if (n === null) return s;
  let largoArea = 4;
  if (n.startsWith("11")) largoArea = 2;
  else if (AREAS_3.has(n.slice(0, 3))) largoArea = 3;
  const area = n.slice(0, largoArea);
  const numero = n.slice(largoArea);
  return `${area} ${numero.slice(0, -4)}-${numero.slice(-4)}`;
}

/** Error en español si no está vacío y no normaliza; `null` si sirve. */
export function validarTelefonoOpcional(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  return normalizarTelefonoAR(v) === null ? TELEFONO_ERROR : null;
}

// ---------------------------------------------------------------------------
// Código postal: viejo (`2400`) o CPA (`X2400ABC`)
// ---------------------------------------------------------------------------

export const CODIGO_POSTAL_ERROR = "El código postal no es válido. Ejemplos: 2400, X2400ABC";

/** Al escribir: mayúsculas, sin espacios, máx. 8. */
export function limpiarCodigoPostalAlEscribir(s: string): string {
  return s.toUpperCase().replace(/\s/g, "").slice(0, 8);
}

/** Error en español si no está vacío y no es viejo ni CPA; `null` si sirve. */
export function validarCodigoPostal(s: string): string | null {
  const v = s.trim().toUpperCase();
  if (!v) return null;
  return /^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/.test(v) ? null : CODIGO_POSTAL_ERROR;
}

// ---------------------------------------------------------------------------
// Nombres
// ---------------------------------------------------------------------------

const LETRAS_PERSONA = "A-Za-zÁÉÍÓÚáéíóúÜüÑñ";
const NOMBRE_PERSONA_INVALIDO = new RegExp(`[^${LETRAS_PERSONA}'’.\\- ]`, "g");

/**
 * Nombre de persona al escribir: letras (con tildes y ñ), espacios,
 * apóstrofo, punto y guion; máx. 100.
 */
export function limpiarNombrePersonaAlEscribir(s: string, max = 100): string {
  return s.replace(NOMBRE_PERSONA_INVALIDO, "").slice(0, max);
}

/**
 * Nombre de comercio o persona (remitente): letras, números, espacios y
 * `.,&'-`; máx. 100.
 */
export function limpiarNombreComercioAlEscribir(s: string, max = 100): string {
  return s.replace(new RegExp(`[^${LETRAS_PERSONA}0-9 .,&'\\-]`, "g"), "").slice(0, max);
}

/** Colapsa los espacios repetidos y recorta (para el `onBlur`). */
export function colapsarEspacios(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Decimal (peso): coma o punto, máx. 2 decimales, sin signo
// ---------------------------------------------------------------------------

export const PESO_ERROR = "El peso tiene que estar entre 0,01 y 1000 kg";
export const PESO_DECIMALES_ERROR = "El peso admite como máximo 2 decimales";

/**
 * Al escribir: solo dígitos y un separador (coma o punto), con hasta 2
 * decimales.
 */
export function limpiarDecimalAlEscribir(s: string): string {
  const solo = s.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
  const [entero = "", ...resto] = solo.split(".");
  if (resto.length === 0) return entero;
  return `${entero}.${resto.join("").slice(0, 2)}`;
}

/** `"2,5"` → `2.5`; lo que no es número → `null`. */
export function parsearDecimal(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Patente: mayúsculas, solo A-Z, 0-9 y `-`, máx. 9
// ---------------------------------------------------------------------------

/** Al escribir: mayúsculas, solo `A-Z`, `0-9` y `-`, máx. 9. */
export function limpiarPatenteAlEscribir(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 9);
}

// ---------------------------------------------------------------------------
// Código de guía: MOV-AAAAMMDD-XXXX, con guiones automáticos
// ---------------------------------------------------------------------------

/** Al escribir: mayúsculas y guiones automáticos (`mov202611110001` → `MOV-20261111-0001`). */
export function formatearCodigoGuiaAlEscribir(s: string): string {
  const limpio = s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
  const partes = [limpio.slice(0, 3), limpio.slice(3, 11), limpio.slice(11, 15)].filter((p) => p.length > 0);
  return partes.join("-");
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export const EMAIL_MAX = 150;
export const EMAIL_ERROR = "El email no es válido. Ejemplo: nombre@empresa.com";

/** Al escribir: minúsculas, sin espacios, máx. 150. */
export function limpiarEmailAlEscribir(s: string): string {
  return s.toLowerCase().replace(/\s/g, "").slice(0, EMAIL_MAX);
}

/** Error en español si no tiene formato de email; `null` si sirve. */
export function validarEmail(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : EMAIL_ERROR;
}

// ---------------------------------------------------------------------------
// Piso / Depto: letras y números, en mayúsculas, máx. 10
// ---------------------------------------------------------------------------

/** Al escribir: mayúsculas, solo letras y números, máx. 10. */
export function limpiarPisoDeptoAlEscribir(s: string, max = 10): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);
}

// ---------------------------------------------------------------------------
// Contraseña: mismas reglas que el backend (ValidarPassword en
// services/api/internal/services/primer_acceso.go): 8+ caracteres, 72 bytes
// como máximo, al menos una mayúscula y un número.
// ---------------------------------------------------------------------------

export const PASSWORD_MAX = 72;

export interface RequisitosPassword {
  ochoOMas: boolean;
  mayuscula: boolean;
  numero: boolean;
}

/** Estado de cada requisito, para el checklist en vivo. */
export function requisitosPassword(s: string): RequisitosPassword {
  return {
    ochoOMas: [...s].length >= 8,
    mayuscula: /[A-ZÁÉÍÓÚÜÑ]/.test(s),
    numero: /\d/.test(s),
  };
}

/**
 * Error en español si no cumple las reglas del backend; `null` si sirve.
 * (La mayúscula exigida cubre el "al menos una letra": es más estricta que
 * pedir cualquier letra, como pide no permitir menos que la API.)
 */
export function validarPassword(s: string): string | null {
  if (!s) return "Ingresá una contraseña.";
  if ([...s].length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (new TextEncoder().encode(s).length > PASSWORD_MAX) return "La contraseña no puede superar los 72 caracteres.";
  if (!/[A-ZÁÉÍÓÚÜÑ]/.test(s)) return "Incluí al menos una mayúscula.";
  if (!/\d/.test(s)) return "Incluí al menos un número.";
  return null;
}
