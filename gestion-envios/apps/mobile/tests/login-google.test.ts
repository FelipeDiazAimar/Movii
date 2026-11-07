import { describe, expect, it } from "vitest";

import { leerVueltaGoogle } from "@/lib/api-client";

// T2: la API vuelve a la app con el token o el desafío en el fragmento y los errores en la query.
describe("leerVueltaGoogle", () => {
  it("lee el token del fragmento", () => {
    expect(leerVueltaGoogle("movii://auth#email=ana%40gmail.com&token=aaa.bbb.ccc")).toEqual({ token: "aaa.bbb.ccc", email: "ana@gmail.com" });
  });

  it("lee el desafío del primer acceso (Expo Go)", () => {
    const v = leerVueltaGoogle("exp://192.168.0.2:8081/--/auth#canal=mail&desafio_id=d1&destino=a%E2%80%A2%E2%80%A2%E2%80%A2%40gmail.com&vence_en_segundos=600");
    expect(v.desafio).toEqual({ desafio_id: "d1", canal: "mail", destino: "a•••@gmail.com", telefono: "", vence_en_segundos: 600 });
  });

  it("traduce el error (cancelado) y no inventa sesión con una URL vacía", () => {
    expect(leerVueltaGoogle("movii://auth?error=cancelado").error).toBe("Cancelaste el inicio de sesión con Google.");
    expect(leerVueltaGoogle("movii://auth").error).toBeTruthy();
  });
});
