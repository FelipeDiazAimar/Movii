import { describe, expect, it } from "vitest";

import { decodeJwt } from "@/lib/api-client";

// Token de ejemplo con claims {"sub":"user-1","rol":"repartidor","exp":9999999999}
// (firma inventada, decodeJwt no valida la firma — solo lee el payload,
// igual que hace cualquier cliente que confía en HTTPS/el servidor emisor).
const TOKEN_DE_PRUEBA =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2wiOiJyZXBhcnRpZG9yIiwiZXhwIjo5OTk5OTk5OTk5fQ.firma-invalida-no-verificada";

describe("decodeJwt", () => {
  it("lee sub, rol y exp del payload sin validar la firma", () => {
    const claims = decodeJwt(TOKEN_DE_PRUEBA);
    expect(claims.sub).toBe("user-1");
    expect(claims.rol).toBe("repartidor");
    expect(claims.exp).toBe(9999999999);
  });

  it("lanza un error con un token mal formado", () => {
    expect(() => decodeJwt("no-es-un-jwt")).toThrow();
  });
});
