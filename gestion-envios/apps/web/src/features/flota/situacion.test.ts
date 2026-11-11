import { describe, expect, it } from "vitest";
import { contarSituaciones, situacionVehiculo } from "./situacion";

const base = { estado: "activo" as const, ruta_id: "r1" as string | null, total_paquetes: 4, paquetes_entregados: 0, paquetes_fallidos: 0, paquetes_en_camino: 0 };

describe("situacionVehiculo", () => {
  it("en camino si al menos un envío ya salió", () => {
    expect(situacionVehiculo({ ...base, paquetes_en_camino: 2 })).toMatchObject({ codigo: "en_camino", detalle: "2 de 4 en la calle" });
  });

  it("con ruta pero nada en la calle: sin salir", () => {
    expect(situacionVehiculo(base)).toMatchObject({ codigo: "esperando", detalle: "4 paq. esperando salida" });
  });

  it("ruta con todo resuelto: terminada", () => {
    expect(situacionVehiculo({ ...base, paquetes_entregados: 3, paquetes_fallidos: 1 })).toMatchObject({ codigo: "terminada", detalle: "3 entregados, 1 fallidos" });
  });

  it("sin ruta, en mantenimiento y ruta vacía", () => {
    expect(situacionVehiculo({ ...base, ruta_id: null }).codigo).toBe("sin_ruta");
    expect(situacionVehiculo({ ...base, estado: "mantenimiento", paquetes_en_camino: 3 }).codigo).toBe("mantenimiento");
    expect(situacionVehiculo({ ...base, total_paquetes: 0 }).codigo).toBe("sin_paquetes");
  });

  it("cuenta los vehículos por situación", () => {
    const c = contarSituaciones([{ ...base, paquetes_en_camino: 1 }, base, { ...base, ruta_id: null }, { ...base, ruta_id: null }]);
    expect(c).toMatchObject({ en_camino: 1, esperando: 1, sin_ruta: 2 });
  });
});
