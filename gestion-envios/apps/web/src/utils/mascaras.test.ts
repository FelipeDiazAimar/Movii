import { describe, expect, it } from "vitest";
import {
  CODIGO_POSTAL_ERROR,
  EMAIL_ERROR,
  PESO_ERROR,
  TELEFONO_ERROR,
  colapsarEspacios,
  formatearCodigoGuiaAlEscribir,
  formatearTelefonoAR,
  limpiarCodigoPostalAlEscribir,
  limpiarDecimalAlEscribir,
  limpiarEmailAlEscribir,
  limpiarNombreComercioAlEscribir,
  limpiarNombrePersonaAlEscribir,
  limpiarPatenteAlEscribir,
  limpiarPisoDeptoAlEscribir,
  limpiarTelefonoAlEscribir,
  normalizarTelefonoAR,
  parsearDecimal,
  requisitosPassword,
  soloDigitos,
  validarCodigoPostal,
  validarEmail,
  validarPassword,
  validarTelefonoOpcional,
} from "./mascaras";

describe("soloDigitos", () => {
  it("deja solo dígitos y recorta al máximo", () => {
    expect(soloDigitos("12a34", 5)).toBe("1234");
    expect(soloDigitos("123456", 5)).toBe("12345");
    expect(soloDigitos("250", 5)).toBe("250");
  });
});

describe("teléfono argentino", () => {
  it("al escribir filtra y recorta a 20", () => {
    expect(limpiarTelefonoAlEscribir("03564 15-412345abc")).toBe("03564 15-412345");
    expect(limpiarTelefonoAlEscribir("+54 9 (3564) 41-2345")).toBe("+54 9 (3564) 41-2345");
    expect(limpiarTelefonoAlEscribir("1".repeat(25))).toBe("1".repeat(20));
  });

  it.each([
    ["03564 15 412345", "3564412345"],
    ["+54 9 351 456 7890", "3514567890"],
    ["1145678901", "1145678901"],
    ["412345", "3564412345"],
    ["15412345", "3564412345"],
    ["5493564412345", "3564412345"],
  ])("normaliza %s → %s", (entrada, esperado) => {
    expect(normalizarTelefonoAR(entrada)).toBe(esperado);
  });

  it.each([["123"], ["abc"], [""], ["03564"]])("rechaza %s", (entrada) => {
    expect(normalizarTelefonoAR(entrada)).toBeNull();
  });

  it.each([
    ["03564 15 412345", "3564 41-2345"],
    ["+54 9 351 456 7890", "351 456-7890"],
    ["1145678901", "11 4567-8901"],
    ["412345", "3564 41-2345"],
  ])("formatea %s → %s", (entrada, esperado) => {
    expect(formatearTelefonoAR(entrada)).toBe(esperado);
  });

  it("si no normaliza devuelve la entrada sin cambios", () => {
    expect(formatearTelefonoAR("123")).toBe("123");
  });

  it("validación opcional: vacío pasa, inválido da error propio", () => {
    expect(validarTelefonoOpcional("")).toBeNull();
    expect(validarTelefonoOpcional("   ")).toBeNull();
    expect(validarTelefonoOpcional("03564 15 412345")).toBeNull();
    expect(validarTelefonoOpcional("123")).toBe(TELEFONO_ERROR);
  });
});

describe("código postal", () => {
  it("al escribir pasa a mayúsculas, saca espacios y recorta a 8", () => {
    expect(limpiarCodigoPostalAlEscribir("x2400abc")).toBe("X2400ABC");
    expect(limpiarCodigoPostalAlEscribir("X 2400 ABC ")).toBe("X2400ABC");
    expect(limpiarCodigoPostalAlEscribir("123456789")).toBe("12345678");
  });

  it("acepta el viejo y el CPA", () => {
    expect(validarCodigoPostal("")).toBeNull();
    expect(validarCodigoPostal("2400")).toBeNull();
    expect(validarCodigoPostal("X2400ABC")).toBeNull();
    expect(validarCodigoPostal("x2400abc")).toBeNull();
  });

  it("rechaza lo demás con error propio", () => {
    expect(validarCodigoPostal("24")).toBe(CODIGO_POSTAL_ERROR);
    expect(validarCodigoPostal("24000")).toBe(CODIGO_POSTAL_ERROR);
    expect(validarCodigoPostal("ABC")).toBe(CODIGO_POSTAL_ERROR);
  });
});

describe("nombres", () => {
  it("persona: filtra números y símbolos pero deja tildes, ñ, apóstrofo, punto y guion", () => {
    expect(limpiarNombrePersonaAlEscribir("María José O'Connor-García.")).toBe("María José O'Connor-García.");
    expect(limpiarNombrePersonaAlEscribir("Peña123!@#")).toBe("Peña");
    expect(limpiarNombrePersonaAlEscribir("a".repeat(120))).toHaveLength(100);
  });

  it("comercio: admite números y ., & ' -", () => {
    expect(limpiarNombreComercioAlEscribir("Depósito San Martín & Cía., N° 3")).toBe("Depósito San Martín & Cía., N 3");
    expect(limpiarNombreComercioAlEscribir("a".repeat(120))).toHaveLength(100);
  });

  it("colapsa espacios dobles y recorta", () => {
    expect(colapsarEspacios("  María   José  ")).toBe("María José");
  });
});

describe("decimal y peso", () => {
  it("al escribir acepta coma o punto con hasta 2 decimales", () => {
    expect(limpiarDecimalAlEscribir("2,5")).toBe("2.5");
    expect(limpiarDecimalAlEscribir("12.345")).toBe("12.34");
    expect(limpiarDecimalAlEscribir("ab3.,5x")).toBe("3.5");
    expect(limpiarDecimalAlEscribir("-4")).toBe("4");
  });

  it("parsea coma decimal", () => {
    expect(parsearDecimal("2,5")).toBe(2.5);
    expect(parsearDecimal(" 3.5 ")).toBe(3.5);
    expect(parsearDecimal("")).toBeNull();
    expect(parsearDecimal("abc")).toBeNull();
  });

  it("constante de error del peso", () => {
    expect(PESO_ERROR).toBe("El peso tiene que estar entre 0,01 y 1000 kg");
  });
});

describe("patente", () => {
  it("pasa a mayúsculas, filtra y recorta a 9", () => {
    expect(limpiarPatenteAlEscribir("ab123cd")).toBe("AB123CD");
    expect(limpiarPatenteAlEscribir("trk-318!")).toBe("TRK-318");
    expect(limpiarPatenteAlEscribir("abcdefghi12")).toBe("ABCDEFGHI");
  });
});

describe("código de guía", () => {
  it("autoinserta guiones a medida que se escribe", () => {
    expect(formatearCodigoGuiaAlEscribir("mov202611110001")).toBe("MOV-20261111-0001");
    expect(formatearCodigoGuiaAlEscribir("MOV")).toBe("MOV");
    expect(formatearCodigoGuiaAlEscribir("mov-2026")).toBe("MOV-2026");
    expect(formatearCodigoGuiaAlEscribir("mov 2026 1111 0001 extra")).toBe("MOV-20261111-0001");
  });
});

describe("email", () => {
  it("al escribir pasa a minúsculas, saca espacios y recorta a 150", () => {
    expect(limpiarEmailAlEscribir("  Ana@Empresa.COM ")).toBe("ana@empresa.com");
    expect(limpiarEmailAlEscribir("a".repeat(160))).toHaveLength(150);
  });

  it("valida formato", () => {
    expect(validarEmail("ana@empresa.com")).toBeNull();
    expect(validarEmail("no-es-mail")).toBe(EMAIL_ERROR);
    expect(validarEmail("ana@empresa")).toBe(EMAIL_ERROR);
  });
});

describe("piso / depto", () => {
  it("pasa a mayúsculas, solo letras y números, máx. 10", () => {
    expect(limpiarPisoDeptoAlEscribir("pb a-3")).toBe("PBA3");
    expect(limpiarPisoDeptoAlEscribir("12345678901")).toBe("1234567890");
  });
});

describe("contraseña", () => {
  it("requisitos en vivo", () => {
    expect(requisitosPassword("NuevaClave1")).toEqual({ ochoOMas: true, mayuscula: true, numero: true });
    expect(requisitosPassword("corta1A")).toEqual({ ochoOMas: false, mayuscula: true, numero: true });
    expect(requisitosPassword("sinmayuscula1")).toEqual({ ochoOMas: true, mayuscula: false, numero: true });
    expect(requisitosPassword("SinNumero")).toEqual({ ochoOMas: true, mayuscula: true, numero: false });
  });

  it("valida las mismas reglas que el backend", () => {
    expect(validarPassword("NuevaClave1")).toBeNull();
    expect(validarPassword("")).toBe("Ingresá una contraseña.");
    expect(validarPassword("corta1A")).toBe("La contraseña debe tener al menos 8 caracteres.");
    expect(validarPassword("sinmayuscula1")).toBe("Incluí al menos una mayúscula.");
    expect(validarPassword("SinNumero")).toBe("Incluí al menos un número.");
    expect(validarPassword("a".repeat(73))).toBe("La contraseña no puede superar los 72 caracteres.");
  });
});
