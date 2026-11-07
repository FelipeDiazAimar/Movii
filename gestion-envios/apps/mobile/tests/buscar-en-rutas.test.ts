import { describe, expect, it } from "vitest";

import { buscarEnRutas, type RutaDelDia } from "@/lib/envios-del-dia";
import type { Shipment } from "@/types/logistics";

const envio = (id: string, nombre: string, direccion: string, code: string): Shipment =>
  ({ id, code, sender: "Movii", recipient: { name: nombre, address: direccion, locality: "Rafaela" } }) as unknown as Shipment;

const rutas: RutaDelDia[] = [
  { rutaId: "r1", rutaNombre: "Demo Centro", envios: [envio("1", "María Pérez", "San Martín 120", "MOV-001"), envio("2", "Juan Gómez", "Belgrano 45", "MOV-002")] },
  { rutaId: "r2", rutaNombre: "Zona Norte", envios: [envio("3", "Ana López", "Mitre 900", "MOV-003")] },
];

describe("buscarEnRutas", () => {
  it("texto vacío devuelve todo", () => {
    expect(buscarEnRutas(rutas, "  ")).toBe(rutas);
  });

  it("busca por destinatario sin distinguir tildes ni mayúsculas", () => {
    const r = buscarEnRutas(rutas, "maria perez");
    expect(r).toHaveLength(1);
    expect(r[0].envios.map((e) => e.id)).toEqual(["1"]);
  });

  it("busca por dirección o por código y descarta rutas sin resultados", () => {
    expect(buscarEnRutas(rutas, "mitre").map((r) => r.rutaId)).toEqual(["r2"]);
    expect(buscarEnRutas(rutas, "mov-002")[0].envios[0].id).toBe("2");
    expect(buscarEnRutas(rutas, "zzz")).toEqual([]);
  });
});
