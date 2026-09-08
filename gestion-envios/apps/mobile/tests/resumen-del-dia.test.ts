import { describe, expect, it } from "vitest";

import {
  agruparEnviosPorRuta,
  contadoresDelDia,
  filtrarPorEstado,
  type ResumenDelDiaAPI,
} from "@/lib/envios-del-dia";

function envio(id: string, estado: ResumenDelDiaAPI["rutas"][number]["envios"][number]["estado"]) {
  return {
    id,
    codigo_guia: `MOV-20260908-${id}`,
    estado,
    peso: 1,
    tamano: "chico",
    tipo_contenido: "Ropa",
    fragil: false,
    urgente: false,
    ruta_id: "ruta-1",
    ruta_nombre: "Ruta Centro 01",
    destinatario: {
      id: `dest-${id}`,
      nombre: "Dest",
      telefono: "",
      calle: "Calle",
      numero: "1",
      piso_depto: "",
      localidad: "San Francisco",
      codigo_postal: "X2400",
    },
  };
}

const resumenDeEjemplo: ResumenDelDiaAPI = {
  fecha: "2026-09-08",
  rutas: [
    { ruta_id: "ruta-1", ruta_nombre: "Ruta Centro 01", envios: [envio("0001", "asignado"), envio("0002", "entregado")] },
    { ruta_id: "ruta-2", ruta_nombre: "Ruta Sur 02", envios: [envio("0003", "no_entregado")] },
  ],
  total: 3,
  pendientes: 0,
  asignados: 1,
  en_camino: 0,
  entregados: 1,
  no_entregados: 1,
};

describe("agruparEnviosPorRuta (CA-03)", () => {
  it("arma una sección por cada ruta del día, conservando el nombre de la ruta", () => {
    const rutas = agruparEnviosPorRuta(resumenDeEjemplo);

    expect(rutas).toHaveLength(2);
    expect(rutas[0].rutaNombre).toBe("Ruta Centro 01");
    expect(rutas[0].envios).toHaveLength(2);
    expect(rutas[1].rutaNombre).toBe("Ruta Sur 02");
    expect(rutas[1].envios).toHaveLength(1);
  });

  it("numera las paradas desde 1 dentro de cada ruta", () => {
    const rutas = agruparEnviosPorRuta(resumenDeEjemplo);

    expect(rutas[0].envios.map((e) => e.stopOrder)).toEqual([1, 2]);
    expect(rutas[1].envios.map((e) => e.stopOrder)).toEqual([1]);
  });

  it("devuelve una lista vacía cuando el repartidor no tiene envíos hoy", () => {
    expect(agruparEnviosPorRuta({ ...resumenDeEjemplo, rutas: [] })).toEqual([]);
  });

  // Regresión del bug de "rutas": null. Un repartidor sin envíos asignados
  // hacía que la pantalla mostrara "no se pudo cargar la ruta del día" en vez
  // del estado vacío, porque el código recorría null directamente.
  it("no rompe si rutas viene nulo (respuesta de una API vieja)", () => {
    const resumenSinRutas = { ...resumenDeEjemplo, rutas: null } as unknown as ResumenDelDiaAPI;
    expect(() => agruparEnviosPorRuta(resumenSinRutas)).not.toThrow();
    expect(agruparEnviosPorRuta(resumenSinRutas)).toEqual([]);
  });
});

describe("filtrarPorEstado (CA-04)", () => {
  const rutas = agruparEnviosPorRuta(resumenDeEjemplo);

  it("sin filtro devuelve todas las rutas con todos sus envíos", () => {
    expect(filtrarPorEstado(rutas, null)).toHaveLength(2);
  });

  it("filtra por el estado real de la API, no por el estado visual del badge", () => {
    // El envío "asignado" se muestra con el badge "pendiente", pero el filtro
    // de "Asignados" tiene que encontrarlo igual.
    const soloAsignados = filtrarPorEstado(rutas, "asignado");

    expect(soloAsignados).toHaveLength(1);
    expect(soloAsignados[0].envios).toHaveLength(1);
    expect(soloAsignados[0].envios[0].code).toBe("MOV-20260908-0001");
  });

  it("descarta las rutas que quedan sin envíos tras aplicar el filtro", () => {
    const soloEntregados = filtrarPorEstado(rutas, "entregado");

    expect(soloEntregados).toHaveLength(1);
    expect(soloEntregados[0].rutaNombre).toBe("Ruta Centro 01");
  });

  it("devuelve vacío cuando ningún envío coincide", () => {
    expect(filtrarPorEstado(rutas, "en_camino")).toEqual([]);
  });
});

describe("contadoresDelDia (CA-05)", () => {
  it("cuenta el día completo: total, entregados, pendientes y no entregados", () => {
    const contadores = contadoresDelDia(resumenDeEjemplo);

    expect(contadores.total).toBe(3);
    expect(contadores.entregados).toBe(1);
    expect(contadores.noEntregados).toBe(1);
    // Pendiente = todo lo que todavía no se cerró (pendiente + asignado + en camino).
    expect(contadores.pendientes).toBe(1);
    expect(contadores.progreso).toBe(33);
  });

  it("no divide por cero cuando no hay envíos", () => {
    const contadores = contadoresDelDia({ ...resumenDeEjemplo, total: 0, entregados: 0, no_entregados: 0, rutas: [] });

    expect(contadores.total).toBe(0);
    expect(contadores.progreso).toBe(0);
  });

  it("devuelve todo en cero si todavía no se cargó el resumen", () => {
    const contadores = contadoresDelDia(null);

    expect(contadores).toEqual({ total: 0, entregados: 0, pendientes: 0, noEntregados: 0, progreso: 0 });
  });
});
