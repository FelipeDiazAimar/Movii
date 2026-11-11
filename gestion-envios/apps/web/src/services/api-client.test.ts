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
  it("usa error.message del body { error: { code, message } } de la API, con mayúscula inicial", () => {
    const err = axiosErrorConRespuesta(401, { error: { code: "credenciales_invalidas", message: "email o contraseña incorrectos" } });
    expect(getApiErrorMessage(err)).toBe("Email o contraseña incorrectos");
  });

  it("respeta los mensajes que ya vienen con mayúscula o empiezan con tilde", () => {
    expect(getApiErrorMessage(axiosErrorConRespuesta(400, { error: { code: "x", message: "La fecha debe tener formato AAAA-MM-DD" } }))).toBe(
      "La fecha debe tener formato AAAA-MM-DD",
    );
    expect(getApiErrorMessage(axiosErrorConRespuesta(409, { error: { code: "x", message: "ícono duplicado" } }))).toBe("Ícono duplicado");
  });

  it("un mensaje vacío de la API cae al mensaje por defecto", () => {
    const err = axiosErrorConRespuesta(500, { error: { code: "x", message: "  " } });
    expect(getApiErrorMessage(err, "mensaje por defecto")).toBe("mensaje por defecto");
  });

  it("da un mensaje específico ante un error de red (API caída)", () => {
    const err = axiosErrorConRespuesta(0, undefined, "ERR_NETWORK");
    expect(getApiErrorMessage(err)).toMatch(/no se pudo conectar/i);
  });

  it("cae al mensaje por defecto si el error no es de axios", () => {
    expect(getApiErrorMessage(new Error("boom"), "mensaje por defecto")).toBe("mensaje por defecto");
  });
});
