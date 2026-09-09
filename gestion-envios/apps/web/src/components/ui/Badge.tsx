const ESTADO_ENVIO_CLASSES: Record<string, string> = {
  pendiente: "bg-gray-100 text-gray-700",
  asignado: "bg-blue-100 text-blue-700",
  en_camino: "bg-amber-100 text-amber-700",
  entregado: "bg-green-100 text-green-700",
  no_entregado: "bg-red-100 text-red-700",
};

const ESTADO_RUTA_CLASSES: Record<string, string> = {
  planificada: "bg-gray-100 text-gray-700",
  en_curso: "bg-amber-100 text-amber-700",
  completada: "bg-green-100 text-green-700",
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  asignado: "Asignado",
  en_camino: "En camino",
  entregado: "Entregado",
  no_entregado: "No entregado",
  planificada: "Planificada",
  en_curso: "En curso",
  completada: "Completada",
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function EstadoEnvioBadge({ estado }: { estado: string }) {
  return <Badge className={ESTADO_ENVIO_CLASSES[estado] ?? "bg-gray-100 text-gray-700"}>{ESTADO_LABELS[estado] ?? estado}</Badge>;
}

export function EstadoRutaBadge({ estado }: { estado: string }) {
  return <Badge className={ESTADO_RUTA_CLASSES[estado] ?? "bg-gray-100 text-gray-700"}>{ESTADO_LABELS[estado] ?? estado}</Badge>;
}

export function RolBadge({ rol }: { rol: string }) {
  return <Badge className="bg-movii-100 text-movii-900">{rol}</Badge>;
}
