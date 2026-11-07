import { describe, expect, it } from "vitest";
import { filtrarEnvios, filtrarRepartidores, filtrarRutas, filtrarUsuarios } from "./filtros";
import type { Usuario } from "@/features/usuarios/api";
import type { RutaListItem } from "@/features/rutas/types";
import type { EnvioListItem } from "@/features/envios/types";

const usuarios = [
  { id: "1", nombre: "Ángela Pérez", email: "angela@movii.com", rol: "admin", activo: true, telefono: "549351" },
  { id: "2", nombre: "Beto", email: "beto@movii.com", rol: "repartidor", activo: false, telefono: "" },
] as Usuario[];

const rutas = [
  { id: "r1", nombre: "Centro", zona: "Norte", fecha: "2026-10-01", estado: "planificada", repartidor_id: "2", repartidor_nombre: "Beto", cantidad_envios: 1 },
  { id: "r2", nombre: "Sur", zona: "Costa", fecha: "2026-10-01", estado: "en_curso", repartidor_id: "9", repartidor_nombre: "Zoe", cantidad_envios: 2 },
] as RutaListItem[];

describe("filtrarUsuarios", () => {
  it("busca sin tildes ni mayúsculas y combina rol y estado", () => {
    expect(filtrarUsuarios(usuarios, { busqueda: "angela", rol: "", estado: "" })).toHaveLength(1);
    expect(filtrarUsuarios(usuarios, { busqueda: "", rol: "repartidor", estado: "inactivo" }).map((u) => u.id)).toEqual(["2"]);
    expect(filtrarUsuarios(usuarios, { busqueda: "", rol: "admin", estado: "inactivo" })).toHaveLength(0);
  });
});

describe("filtrarRepartidores", () => {
  const reps = [{ id: "2", nombre: "Beto" }, { id: "3", nombre: "Carla" }];
  it("filtra por nombre, ruta y con/sin rutas", () => {
    expect(filtrarRepartidores(reps, rutas, { busqueda: "centro", conRuta: "" }).map((r) => r.id)).toEqual(["2"]);
    expect(filtrarRepartidores(reps, rutas, { busqueda: "", conRuta: "sin" }).map((r) => r.id)).toEqual(["3"]);
    expect(filtrarRepartidores(reps, rutas, { busqueda: "", conRuta: "con" }).map((r) => r.id)).toEqual(["2"]);
  });
});

describe("filtrarRutas", () => {
  it("filtra por texto, estado y repartidor", () => {
    expect(filtrarRutas(rutas, { busqueda: "costa", estado: "", repartidor: "" }).map((r) => r.id)).toEqual(["r2"]);
    expect(filtrarRutas(rutas, { busqueda: "zoe", estado: "en_curso", repartidor: "9" })).toHaveLength(1);
    expect(filtrarRutas(rutas, { busqueda: "", estado: "completada", repartidor: "" })).toHaveLength(0);
  });
});

describe("filtrarEnvios", () => {
  const envios = [
    { id: "e1", codigo_guia: "MOV-001", destinatario: "Juan", direccion: "Mitre 10", ruta_nombre: "Centro", repartidor_nombre: "Beto" },
    { id: "e2", codigo_guia: "MOV-002", destinatario: "Ana", direccion: "Sarmiento 5", ruta_nombre: null, repartidor_nombre: null },
  ] as unknown as EnvioListItem[];
  it("busca en guía, destinatario, dirección, ruta y repartidor", () => {
    expect(filtrarEnvios(envios, "mov-002").map((e) => e.id)).toEqual(["e2"]);
    expect(filtrarEnvios(envios, "mitre")).toHaveLength(1);
    expect(filtrarEnvios(envios, "beto")).toHaveLength(1);
    expect(filtrarEnvios(envios, "")).toHaveLength(2);
  });
});
