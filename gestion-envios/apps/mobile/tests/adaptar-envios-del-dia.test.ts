import { describe, expect, it } from "vitest";

import { mapEnvioDelDiaToShipment, type EnvioDelDiaAPI } from "@/lib/api-client";

const envioDeEjemplo: EnvioDelDiaAPI = {
  id: "envio-1",
  codigo_guia: "MOV-20260906-0001",
  estado: "asignado",
  peso: 4.2,
  tamano: "mediano",
  tipo_contenido: "Electrónica",
  fragil: true,
  urgente: false,
  ruta_id: "ruta-1",
  ruta_nombre: "Ruta Centro 01",
  destinatario: {
    id: "dest-1", nombre: "Juan Pérez", telefono: "3564-000000",
    calle: "San Martín", numero: "450", piso_depto: "", localidad: "San Francisco", codigo_postal: "X2400",
  },
};

describe("mapEnvioDelDiaToShipment", () => {
  it("mapea los campos del envío real a la forma Shipment del prototipo", () => {
    const shipment = mapEnvioDelDiaToShipment(envioDeEjemplo, "drv-real", 3);

    expect(shipment.id).toBe("envio-1");
    expect(shipment.code).toBe("MOV-20260906-0001");
    expect(shipment.recipient.name).toBe("Juan Pérez");
    expect(shipment.recipient.address).toBe("San Martín 450");
    expect(shipment.recipient.locality).toBe("San Francisco");
    expect(shipment.driverId).toBe("drv-real");
    expect(shipment.routeName).toBe("Ruta Centro 01");
    expect(shipment.stopOrder).toBe(3);
    expect(shipment.weight).toBe("4.2 kg");
    expect(shipment.fragile).toBe(true);
  });

  it("mapea el estado 'asignado' del backend a 'pendiente' en el prototipo (no existe un estado visual propio para 'asignado' todavía)", () => {
    const shipment = mapEnvioDelDiaToShipment(envioDeEjemplo, "drv-real", 1);
    expect(shipment.status).toBe("pendiente");
  });

  it("respeta los estados que sí coinciden 1 a 1 (en_camino, entregado, no_entregado)", () => {
    for (const estado of ["en_camino", "entregado", "no_entregado"] as const) {
      const shipment = mapEnvioDelDiaToShipment({ ...envioDeEjemplo, estado }, "drv-real", 1);
      expect(shipment.status).toBe(estado);
    }
  });
});
