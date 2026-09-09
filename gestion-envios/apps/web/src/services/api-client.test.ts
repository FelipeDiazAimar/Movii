import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { getApiErrorMessage } from "./api-client";

function axiosErrorConRespuesta(status: number, body: unknown, code?: string) {
  return new AxiosError("Request failed", code, undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: body,
  });
}

describe("getApiErrorMessage", () => {
  it("usa error.message del body { error: { code, message } } de la API", () => {
    const err = axiosErrorConRespuesta(401, { error: { code: "credenciales_invalidas", message: "email o contraseña incorrectos" } });
    expect(getApiErrorMessage(err)).toBe("email o contraseña incorrectos");
  });

  it("da un mensaje específico ante un error de red (API caída)", () => {
    const err = axiosErrorConRespuesta(0, undefined, "ERR_NETWORK");
    expect(getApiErrorMessage(err)).toMatch(/no se pudo conectar/i);
  });

  it("cae al mensaje por defecto si el error no es de axios", () => {
    expect(getApiErrorMessage(new Error("boom"), "mensaje por defecto")).toBe("mensaje por defecto");
  });
});
