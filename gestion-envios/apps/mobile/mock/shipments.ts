import type { Driver, Shipment, ShipmentStatus, TimelineEvent } from "@/types/logistics";

const timeline = (status: ShipmentStatus, eta: string): TimelineEvent[] => {
  const stages = [
    { label: "Envío registrado", detail: "Centro de distribución Movii", timestamp: "26 ago · 08:05" },
    { label: "En preparación", detail: "Clasificado para su ruta", timestamp: "26 ago · 08:38" },
    { label: "En camino", detail: "En ruta con tu repartidor", timestamp: "26 ago · 10:12" },
    { label: "Entregado", detail: "Entrega confirmada", timestamp: "26 ago · 11:20" },
  ];
  const completedCount = status === "pendiente" ? 2 : status === "en_camino" ? 3 : 4;
  return stages.map((stage, index) => ({
    ...stage,
    timestamp: index === 3 && status !== "entregado" ? eta : stage.timestamp,
    completed: index < completedCount,
  }));
};

export const drivers: Driver[] = [
  { id: "drv-1", name: "Lucas Gaitán", initials: "LG", zone: "Zona Norte", status: "en_ruta", deliveriesToday: 8, successRate: 96 },
  { id: "drv-2", name: "Martina Ríos", initials: "MR", zone: "Centro", status: "en_ruta", deliveriesToday: 11, successRate: 94 },
  { id: "drv-3", name: "Tomás Acosta", initials: "TA", zone: "Zona Sur", status: "disponible", deliveriesToday: 7, successRate: 97 },
  { id: "drv-4", name: "Valentina Sosa", initials: "VS", zone: "Oeste", status: "en_ruta", deliveriesToday: 10, successRate: 92 },
  { id: "drv-5", name: "Bruno Ferreyra", initials: "BF", zone: "Zona Norte", status: "en_ruta", deliveriesToday: 9, successRate: 95 },
  { id: "drv-6", name: "Camila Pereyra", initials: "CP", zone: "Centro", status: "disponible", deliveriesToday: 6, successRate: 96 },
  { id: "drv-7", name: "Nicolás Varela", initials: "NV", zone: "Zona Sur", status: "en_ruta", deliveriesToday: 12, successRate: 93 },
];

const northStops = [
  ["MOV-2026-000771", "Mariana Torres", "Av. del Libertador 3250", "Olivos", "1636", "09:00–10:00", "en_camino"],
  ["MOV-2026-000772", "Santiago Vidal", "Ugarte 1845", "Florida", "1602", "10:00–11:00", "pendiente"],
  ["MOV-2026-000773", "Florencia Cabrera", "Maipú 2137", "Vicente López", "1638", "11:00–12:00", "pendiente"],
  ["MOV-2026-000774", "Agustín Pérez", "Rosetti 492", "Martínez", "1640", "12:00–13:00", "pendiente"],
  ["MOV-2026-000775", "Lucía López", "Don Bosco 744", "San Isidro", "1642", "13:00–14:00", "pendiente"],
  ["MOV-2026-000776", "Diego Quiroga", "Paraná 1198", "Martínez", "1640", "14:00–15:00", "pendiente"],
  ["MOV-2026-000777", "Sofía Benítez", "Arenales 2021", "Martínez", "1640", "15:00–16:00", "en_camino"],
  ["MOV-2026-000778", "Gastón Nuñez", "Edison 95", "Boulogne", "1609", "16:00–17:00", "pendiente"],
  ["MOV-2026-000779", "Paula Molina", "Rivadavia 864", "San Fernando", "1646", "17:00–18:00", "pendiente"],
  ["MOV-2026-000780", "Iván Medina", "Alsina 410", "Tigre", "1648", "18:00–19:00", "pendiente"],
] as const;

export const seedShipments: Shipment[] = northStops.map((stop, index) => {
  const [code, name, address, locality, postalCode, timeWindow, status] = stop;
  return {
    id: `shp-${index + 1}`,
    code,
    recipient: { name, address, locality, postalCode, phone: "+54 11 5555-0182" },
    sender: index % 2 === 0 ? "Tienda Nube Market" : "Casa Nova",
    zone: "Zona Norte",
    driverId: "drv-1",
    routeName: "Ruta Norte 02",
    stopOrder: index + 1,
    timeWindow,
    estimatedDate: "Hoy, 26 de agosto",
    status: status as ShipmentStatus,
    packageDescription: index === 6 ? "Caja mediana · 30 × 22 × 16 cm" : "Paquete estándar · 25 × 18 × 12 cm",
    weight: index === 6 ? "1,8 kg" : "0,9 kg",
    fragile: index === 6,
    notes: index === 6 ? "Timbre 2B. Dejar con persona mayor de edad." : undefined,
    timeline: timeline(status as ShipmentStatus, "Hoy · 16:00"),
  };
});

const zoneAddresses = [
  ["Centro", "Av. Corrientes 1240", "CABA", "1043"],
  ["Zona Sur", "Mitre 731", "Avellaneda", "1870"],
  ["Oeste", "Rivadavia 15890", "Haedo", "1706"],
  ["Zona Norte", "Av. Santa Fe 990", "Acassuso", "1641"],
] as const;

const names = ["Ana Rossi", "Federico Paz", "Malena Díaz", "Emilio Castro", "Julia Ledesma", "Matías Rey", "Clara Bianchi", "Pedro Salas", "Victoria Ponce", "Ramiro Costa"];

export const historicalShipments: Shipment[] = drivers.flatMap((driver, driverIndex) =>
  Array.from({ length: 10 }, (_, index) => {
    const [zone, address, locality, postalCode] = zoneAddresses[driverIndex % zoneAddresses.length];
    const codeNumber = 810 + driverIndex * 10 + index;
    const status: ShipmentStatus = index === 8 ? "no_entregado" : "entregado";
    return {
      id: `hist-${driverIndex}-${index}`,
      code: `MOV-2026-${String(codeNumber).padStart(6, "0")}`,
      recipient: { name: names[index], address: `${address.split(" ")[0]} ${Number(address.split(" ").pop()) + index * 13}`, locality, postalCode, phone: "+54 11 5555-0138" },
      sender: index % 2 ? "Mercado Local" : "Origen Casa",
      zone: zone as Shipment["zone"],
      driverId: driver.id,
      routeName: `Ruta ${zone} ${String((index % 3) + 1).padStart(2, "0")}`,
      stopOrder: index + 1,
      timeWindow: `${String(9 + (index % 8)).padStart(2, "0")}:00–${String(10 + (index % 8)).padStart(2, "0")}:00`,
      estimatedDate: "25 de agosto",
      status,
      packageDescription: "Paquete estándar · 22 × 16 × 10 cm",
      weight: "1,2 kg",
      fragile: false,
      failureReason: status === "no_entregado" ? "Destinatario ausente" : undefined,
      recipientName: status === "entregado" ? names[index] : undefined,
      hasProof: status === "entregado",
      timeline: timeline(status, "25 ago · 17:10"),
    };
  }),
);

export const allSeedShipments = [...seedShipments, ...historicalShipments];

export const getDriver = (id: string) => drivers.find((driver) => driver.id === id) ?? drivers[0];
