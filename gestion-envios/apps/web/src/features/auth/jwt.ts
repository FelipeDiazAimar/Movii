import type { JwtClaims } from "./types";

/**
 * Decodifica el payload de un JWT sin validar la firma: el token siempre se
 * valida en el servidor en cada request, esto solo lee `rol`/`exp` para la UI.
 */
export function decodeJwt(token: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    const payload = JSON.parse(json);
    if (typeof payload.sub !== "string" || typeof payload.rol !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    return payload as JwtClaims;
  } catch {
    return null;
  }
}

export function isTokenExpired(claims: JwtClaims): boolean {
  return claims.exp * 1000 <= Date.now();
}
