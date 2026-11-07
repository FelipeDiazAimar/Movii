import { describe, expect, it } from "vitest";
import { filtrarVehiculos } from "./filtros";
import type { Vehiculo } from "./types";

const mk = (o: Partial<Vehiculo>) => ({ patente: "", modelo: "", tipo: "camion", estado: "activo", repartidor_nombre: "", ruta_nombre: "", ...o }) as Vehiculo;
const vs = [
  mk({ patente: "TRK-318", modelo: "Accelo", repartidor_nombre: "José Pérez", ruta_nombre: "Zona Norte" }),
  mk({ patente: "FUR-102", modelo: "Master", tipo: "furgon", estado: "en_base" }),
];
const base = { busqueda: "", estado: "", tipo: "" };

describe("filtrarVehiculos", () => {
  it("sin filtros devuelve todo", () => expect(filtrarVehiculos(vs, base)).toHaveLength(2));
  it("busca por patente, modelo, chofer (sin tildes) y ruta", () => {
    expect(filtrarVehiculos(vs, { ...base, busqueda: "trk" })).toHaveLength(1);
    expect(filtrarVehiculos(vs, { ...base, busqueda: "master" })[0].patente).toBe("FUR-102");
    expect(filtrarVehiculos(vs, { ...base, busqueda: "jose perez" })).toHaveLength(1);
    expect(filtrarVehiculos(vs, { ...base, busqueda: "norte" })).toHaveLength(1);
  });
  it("filtra por estado y tipo combinados", () => {
    expect(filtrarVehiculos(vs, { ...base, estado: "en_base" })).toHaveLength(1);
    expect(filtrarVehiculos(vs, { ...base, tipo: "furgon", estado: "activo" })).toHaveLength(0);
  });
});
