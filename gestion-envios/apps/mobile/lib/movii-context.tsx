import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { allSeedShipments, drivers } from "@/mock/shipments";
import type { Shipment, ShipmentStatus } from "@/types/logistics";
import {
  login as apiLogin,
  logout as apiLogout,
  getEnviosDelDia,
  mapEnvioDelDiaToShipment,
  type ResumenDelDiaAPI,
} from "@/lib/api-client";

type PrototypeRole = "repartidor" | "operador" | null;

type MoviiContextValue = {
  role: PrototypeRole;
  driverName: string;
  shipments: Shipment[];
  enviosDelDia: Shipment[];
  resumenDelDia: ResumenDelDiaAPI | null;
  cargandoEnviosDelDia: boolean;
  errorEnviosDelDia: string | null;
  activeDriverId: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  recargarEnviosDelDia: () => Promise<void>;
  findShipment: (idOrCode: string) => Shipment | undefined;
  updateShipment: (id: string, patch: Partial<Shipment>) => void;
  setShipmentStatus: (id: string, status: ShipmentStatus, extra?: Partial<Shipment>) => void;
};

const MoviiContext = createContext<MoviiContextValue | undefined>(undefined);

const DRIVER_ID_REAL = "drv-real";

export function MoviiProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<PrototypeRole>(null);
  const [driverName, setDriverName] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>(allSeedShipments);
  const [enviosDelDia, setEnviosDelDia] = useState<Shipment[]>([]);
  const [resumenDelDia, setResumenDelDia] = useState<ResumenDelDiaAPI | null>(null);
  const [cargandoEnviosDelDia, setCargandoEnviosDelDia] = useState(false);
  const [errorEnviosDelDia, setErrorEnviosDelDia] = useState<string | null>(null);
  const activeDriverId = drivers[0].id;

  const recargarEnviosDelDia = async () => {
    setCargandoEnviosDelDia(true);
    setErrorEnviosDelDia(null);
    try {
      const resumen = await getEnviosDelDia();
      setResumenDelDia(resumen);
      const mapeados = resumen.rutas.flatMap((ruta) =>
        ruta.envios.map((envio, indice) => mapEnvioDelDiaToShipment(envio, DRIVER_ID_REAL, indice + 1)),
      );
      setEnviosDelDia(mapeados);
    } catch (err) {
      setErrorEnviosDelDia("No se pudo cargar la ruta del día. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setCargandoEnviosDelDia(false);
    }
  };

  const login = async (email: string, password: string) => {
    const claims = await apiLogin(email, password);
    const rolValido: PrototypeRole = claims.rol === "repartidor" || claims.rol === "operador" ? claims.rol : null;
    setRole(rolValido);
    setDriverName(email.split("@")[0]);

    if (rolValido === "repartidor") {
      await recargarEnviosDelDia();
    }
  };

  const logout = async () => {
    await apiLogout();
    setRole(null);
    setDriverName("");
    setEnviosDelDia([]);
    setResumenDelDia(null);
  };

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
      driverName,
      shipments,
      enviosDelDia,
      resumenDelDia,
      cargandoEnviosDelDia,
      errorEnviosDelDia,
      activeDriverId,
      login,
      logout,
      recargarEnviosDelDia,
      findShipment: (idOrCode) =>
        shipments.find((shipment) => shipment.id === idOrCode || shipment.code.toLowerCase() === idOrCode.toLowerCase()) ??
        enviosDelDia.find((shipment) => shipment.id === idOrCode || shipment.code.toLowerCase() === idOrCode.toLowerCase()),
      updateShipment,
      setShipmentStatus,
    }),
    [role, driverName, shipments, enviosDelDia, resumenDelDia, cargandoEnviosDelDia, errorEnviosDelDia],
  );

  return <MoviiContext.Provider value={value}>{children}</MoviiContext.Provider>;
}

export function useMovii() {
  const context = useContext(MoviiContext);
  if (!context) throw new Error("useMovii debe utilizarse dentro de MoviiProvider");
  return context;
}
