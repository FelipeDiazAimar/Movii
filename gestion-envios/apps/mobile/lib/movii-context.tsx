import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Shipment, ShipmentStatus } from "@/types/logistics";
import { loginConGoogle as apiLoginConGoogle } from "@/lib/login-google";
import { login as apiLogin, verificarCodigoLogin as apiVerificarCodigo, verificarPrimerAcceso as apiVerificarPrimerAcceso, type DesafioLogin, type PrimerAccesoPendiente, logout as apiLogout, getEnviosDelDia, getToken, decodeJwt, type EstadoEnvioAPI, type ResumenDelDiaAPI } from "@/lib/api-client";
import { agruparEnviosPorRuta, type RutaDelDia } from "@/lib/envios-del-dia";

type PrototypeRole = "repartidor" | "operador" | null;

export type { RutaDelDia };

type MoviiContextValue = {
  /** false mientras se intenta restaurar la sesión guardada (token) al abrir la app. */
  sesionLista: boolean;
  role: PrototypeRole;
  driverName: string;
  shipments: Shipment[];
  enviosDelDia: Shipment[];
  rutasDelDia: RutaDelDia[];
  resumenDelDia: ResumenDelDiaAPI | null;
  filtroEstado: EstadoEnvioAPI | null;
  setFiltroEstado: (estado: EstadoEnvioAPI | null) => void;
  cargandoEnviosDelDia: boolean;
  errorEnviosDelDia: string | null;
  /** Devuelve el desafío si hace falta el código de WhatsApp (HU-16); si no, abre la sesión. */
  /** Devuelve el desafío del código, el primer acceso pendiente (428: hay que elegir contraseña) o null si ya entró. */
  login: (email: string, password: string) => Promise<DesafioLogin | PrimerAccesoPendiente | null>;
  /** Último paso del primer acceso: valida el código y abre la sesión. */
  verificarPrimerAcceso: (desafioId: string, codigo: string, email: string) => Promise<void>;
  /** Segundo paso del login: código de 6 dígitos recibido por WhatsApp. */
  verificarCodigo: (desafioId: string, codigo: string, email: string) => Promise<void>;
  /** Login con Google (T2): true si entró, el desafío si falta el código (primer acceso), null si se canceló. */
  loginConGoogle: () => Promise<DesafioLogin | boolean | null>;
  logout: () => Promise<void>;
  recargarEnviosDelDia: () => Promise<void>;
  findShipment: (idOrCode: string) => Shipment | undefined;
  updateShipment: (id: string, patch: Partial<Shipment>) => void;
  setShipmentStatus: (id: string, status: ShipmentStatus, extra?: Partial<Shipment>) => void;
};

const MoviiContext = createContext<MoviiContextValue | undefined>(undefined);

export function MoviiProvider({ children }: { children: ReactNode }) {
  const [sesionLista, setSesionLista] = useState(false);
  const [role, setRole] = useState<PrototypeRole>(null);
  const [driverName, setDriverName] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [rutasDelDia, setRutasDelDia] = useState<RutaDelDia[]>([]);
  const [resumenDelDia, setResumenDelDia] = useState<ResumenDelDiaAPI | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoEnvioAPI | null>(null);
  const [cargandoEnviosDelDia, setCargandoEnviosDelDia] = useState(false);
  const [errorEnviosDelDia, setErrorEnviosDelDia] = useState<string | null>(null);

  /**
   * Trae el día completo, sin filtrar por estado en el servidor. El filtro de
   * CA-04 se aplica acá abajo sobre lo ya descargado porque el resumen del día
   * de CA-05 (total / entregados / pendientes / no entregados) tiene que seguir
   * contando TODOS los envíos: si filtráramos en la API, los contadores se
   * moverían junto con el filtro y dejarían de ser el resumen del día.
   */
  const recargarEnviosDelDia = async () => {
    setCargandoEnviosDelDia(true);
    setErrorEnviosDelDia(null);
    try {
      const resumen = await getEnviosDelDia();
      setResumenDelDia(resumen);
      setRutasDelDia(agruparEnviosPorRuta(resumen));
    } catch {
      setErrorEnviosDelDia("No se pudo cargar la ruta del día. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setCargandoEnviosDelDia(false);
    }
  };

  // Restaura la sesión si hay un token vigente guardado (al recargar la página o reabrir la app).
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const claims = decodeJwt(token);
          if (claims.exp * 1000 > Date.now() && claims.rol === "repartidor") {
            setRole("repartidor");
            setDriverName(claims.nombre ?? "");
            await recargarEnviosDelDia();
          }
        }
      } catch {
        // token ilegible: se pide login de nuevo
      } finally {
        setSesionLista(true);
      }
    })();
  }, []);

  const abrirSesion = async (claims: { rol: string; nombre?: string }, nombrePorDefecto: string) => {
    const rolValido: PrototypeRole = claims.rol === "repartidor" || claims.rol === "operador" ? claims.rol : null;
    setRole(rolValido);
    setDriverName(claims.nombre ?? nombrePorDefecto);

    if (rolValido === "repartidor") {
      await recargarEnviosDelDia();
    }
  };

  const login = async (email: string, password: string): Promise<DesafioLogin | PrimerAccesoPendiente | null> => {
    const r = await apiLogin(email, password);
    if ("desafio_id" in r || "user_id" in r) return r;
    await abrirSesion(r, email.split("@")[0]);
    return null;
  };

  const verificarCodigo = async (desafioId: string, codigo: string, email: string) => {
    await abrirSesion(await apiVerificarCodigo(desafioId, codigo), email.split("@")[0]);
  };

  const verificarPrimerAcceso = async (desafioId: string, codigo: string, email: string) => {
    await abrirSesion(await apiVerificarPrimerAcceso(desafioId, codigo), email.split("@")[0]);
  };

  const loginConGoogle = async (): Promise<DesafioLogin | boolean | null> => {
    const r = await apiLoginConGoogle();
    if (!r) return null;
    if ("desafio_id" in r) return r;
    await abrirSesion(r, "");
    return true;
  };

  const logout = async () => {
    await apiLogout();
    setRole(null);
    setDriverName("");
    setRutasDelDia([]);
    setResumenDelDia(null);
    setFiltroEstado(null);
  };

  const updateShipment = (id: string, patch: Partial<Shipment>) => {
    setShipments((current) => current.map((shipment) => (shipment.id === id ? { ...shipment, ...patch } : shipment)));
  };

  const setShipmentStatus = (id: string, status: ShipmentStatus, extra: Partial<Shipment> = {}) => {
    const aplicar = (shipment: Shipment): Shipment => {
      if (shipment.id !== id) return shipment;
      const completedStages = status === "pendiente" ? 2 : status === "en_camino" ? 3 : 4;
      const nextTimeline = shipment.timeline.map((entry, index) => ({
        ...entry,
        completed: index < completedStages,
        timestamp: index === completedStages - 1 ? "Hoy · ahora" : entry.timestamp,
      }));
      // En modo demo (sin API) los envíos de la lista del día también son
      // locales: se actualizan acá para que el cambio se vea al instante. Los
      // envíos reales se recargan igual desde el servidor después de la acción.
      const estadoApi = shipment.estadoApi === undefined ? undefined : status === "pendiente" ? "asignado" : status;
      return { ...shipment, ...extra, status, ...(estadoApi === undefined ? null : { estadoApi }), timeline: nextTimeline };
    };
    setShipments((current) => current.map(aplicar));
    setRutasDelDia((current) => current.map((ruta) => ({ ...ruta, envios: ruta.envios.map(aplicar) })));
  };

  // Lista plana de todos los envíos del día, sin filtrar. La usan las pantallas
  // que necesitan buscar un envío por id (detalle de parada).
  const enviosDelDia = useMemo(() => rutasDelDia.flatMap((ruta) => ruta.envios), [rutasDelDia]);

  const value: MoviiContextValue = {
      sesionLista,
      role,
      driverName,
      shipments,
      enviosDelDia,
      rutasDelDia,
      resumenDelDia,
      filtroEstado,
      setFiltroEstado,
      cargandoEnviosDelDia,
      errorEnviosDelDia,
      login,
      verificarPrimerAcceso,
      verificarCodigo,
      loginConGoogle,
      logout,
      recargarEnviosDelDia,
      findShipment: (idOrCode) =>
        shipments.find((shipment) => shipment.id === idOrCode || shipment.code.toLowerCase() === idOrCode.toLowerCase()) ??
        enviosDelDia.find((shipment) => shipment.id === idOrCode || shipment.code.toLowerCase() === idOrCode.toLowerCase()),
      updateShipment,
      setShipmentStatus,
  };

  return <MoviiContext.Provider value={value}>{children}</MoviiContext.Provider>;
}

export function useMovii() {
  const context = useContext(MoviiContext);
  if (!context) throw new Error("useMovii debe utilizarse dentro de MoviiProvider");
  return context;
}
