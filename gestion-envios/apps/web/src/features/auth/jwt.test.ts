import { describe, expect, it } from "vitest";
import { decodeJwt, isTokenExpired } from "./jwt";

/** Codifica un payload como el segmento de un JWT (sin firmar; alcanza para testear el decoder). */
function fakeJwt(payload: Record<string, unknown>): string {
  const base64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}.firma-falsa`;
}

describe("decodeJwt", () => {
  it("decodifica sub, rol y exp de un token válido", () => {
    const token = fakeJwt({ sub: "user-1", rol: "supervisor", exp: 9999999999 });
    expect(decodeJwt(token)).toEqual({ sub: "user-1", rol: "supervisor", exp: 9999999999 });
  });

  it("devuelve null si el token no tiene 3 partes", () => {
    expect(decodeJwt("no-es-un-jwt")).toBeNull();
  });

  it("devuelve null si al payload le falta un claim requerido", () => {
    const token = fakeJwt({ sub: "user-1", rol: "supervisor" }); // sin exp
    expect(decodeJwt(token)).toBeNull();
  });

  it("devuelve null ante JSON inválido en el payload", () => {
    expect(decodeJwt("aGVhZGVy.eyJub3QiOiJqc29u{{{.firma")).toBeNull();
  });
});

describe("isTokenExpired", () => {
  it("es true cuando exp ya pasó", () => {
    expect(isTokenExpired({ sub: "x", rol: "operador", exp: Math.floor(Date.now() / 1000) - 10 })).toBe(true);
  });

  it("es false cuando exp está en el futuro", () => {
    expect(isTokenExpired({ sub: "x", rol: "operador", exp: Math.floor(Date.now() / 1000) + 3600 })).toBe(false);
  });
});
