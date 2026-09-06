import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { allSeedShipments, drivers } from "@/mock/shipments";
import type { Shipment, ShipmentStatus } from "@/types/logistics";

type PrototypeRole = "repartidor" | "operador" | null;

type MoviiContextValue = {
  role: PrototypeRole;
  shipments: Shipment[];
  activeDriverId: string;
  login: (role: Exclude<PrototypeRole, null>) => void;
  logout: () => void;
  findShipment: (idOrCode: string) => Shipment | undefined;
  updateShipment: (id: string, patch: Partial<Shipment>) => void;
  setShipmentStatus: (id: string, status: ShipmentStatus, extra?: Partial<Shipment>) => void;
};

const MoviiContext = createContext<MoviiContextValue | undefined>(undefined);

export function MoviiProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<PrototypeRole>(null);
  const [shipments, setShipments] = useState<Shipment[]>(allSeedShipments);
  const activeDriverId = drivers[0].id;

  const updateShipment = (id: string, patch: Partial<Shipment>) => {
    setShipments((current) => current.map((shipment) => (shipment.id === id ? { ...shipment, ...patch } : shipment)));
  };

  const setShipmentStatus = (id: string, status: ShipmentStatus, extra: Partial<Shipment> = {}) => {
    setShipments((current) =>
      current.map((shipment) => {
        if (shipment.id !== id) return shipment;
        const completedStages = status === "pendiente" ? 2 : status === "en_camino" ? 3 : 4;
        const nextTimeline = shipment.timeline.map((entry, index) => ({
          ...entry,
          completed: index < completedStages,
          timestamp: index === completedStages - 1 ? "Hoy · ahora" : entry.timestamp,
        }));
        return { ...shipment, ...extra, status, timeline: nextTimeline };
      }),
    );
  };

  const value = useMemo<MoviiContextValue>(
    () => ({
      role,
      shipments,
      activeDriverId,
      login: setRole,
      logout: () => setRole(null),
      findShipment: (idOrCode) => shipments.find((shipment) => shipment.id === idOrCode || shipment.code.toLowerCase() === idOrCode.toLowerCase()),
      updateShipment,
      setShipmentStatus,
    }),
    [role, shipments],
  );

  return <MoviiContext.Provider value={value}>{children}</MoviiContext.Provider>;
}

export function useMovii() {
  const context = useContext(MoviiContext);
  if (!context) throw new Error("useMovii debe utilizarse dentro de MoviiProvider");
  return context;
}
