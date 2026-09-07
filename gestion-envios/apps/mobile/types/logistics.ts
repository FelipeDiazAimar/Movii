export type ShipmentStatus = "pendiente" | "en_camino" | "entregado" | "no_entregado";

export type TimelineEvent = {
  label: string;
  detail: string;
  timestamp: string;
  completed: boolean;
};

export type Recipient = {
  name: string;
  address: string;
  locality: string;
  postalCode: string;
  phone: string;
};

export type Shipment = {
  id: string;
  code: string;
  recipient: Recipient;
  sender: string;
  zone: "Zona Norte" | "Centro" | "Zona Sur" | "Oeste";
  driverId: string;
  routeName: string;
  stopOrder: number;
  timeWindow: string;
  estimatedDate: string;
  status: ShipmentStatus;
  packageDescription: string;
  weight: string;
  fragile: boolean;
  notes?: string;
  timeline: TimelineEvent[];
  failureReason?: string;
  rescheduledFor?: string;
  recipientName?: string;
  hasProof?: boolean;
};

export type Driver = {
  id: string;
  name: string;
  initials: string;
  zone: string;
  status: "en_ruta" | "disponible";
  deliveriesToday: number;
  successRate: number;
};

export const statusCopy: Record<ShipmentStatus, string> = {
  pendiente: "Pendiente",
  en_camino: "En camino",
  entregado: "Entregado",
  no_entregado: "No entregado",
};
