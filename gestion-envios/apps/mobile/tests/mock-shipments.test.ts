import { describe, expect, it } from "vitest";

import { allSeedShipments, drivers, seedShipments } from "@/mock/shipments";

describe("Movii mock logistics data", () => {
  it("includes the documented public tracking shipment", () => {
    const shipment = allSeedShipments.find((item) => item.code === "MOV-2026-000777");
    expect(shipment).toBeDefined();
    expect(shipment?.status).toBe("en_camino");
    expect(shipment?.recipient.locality).toBe("Martínez");
    expect(shipment?.timeline).toHaveLength(4);
  });

  it("keeps the active courier route ordered and coherent", () => {
    const northRoute = seedShipments.filter((item) => item.driverId === "drv-1");
    expect(northRoute).toHaveLength(10);
    expect(northRoute.map((item) => item.stopOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(northRoute.every((item) => item.zone === "Zona Norte")).toBe(true);
  });

  it("provides a realistic mock team and enough delivery records", () => {
    expect(drivers).toHaveLength(7);
    expect(allSeedShipments.length).toBeGreaterThanOrEqual(70);
    expect(new Set(allSeedShipments.map((item) => item.code)).size).toBe(allSeedShipments.length);
  });
});
