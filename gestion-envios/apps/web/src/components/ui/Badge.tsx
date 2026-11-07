const ESTADO_ENVIO_CLASSES: Record<string, string> = {
  pendiente: "bg-gray-100 text-gray-700 [--punto:#9ca3af]",
  asignado: "bg-blue-50 text-blue-700 [--punto:#2563eb]",
  en_camino: "bg-amber-50 text-amber-800 [--punto:#d97706]",
  entregado: "bg-emerald-50 text-emerald-700 [--punto:#16a34a]",
  no_entregado: "bg-red-50 text-red-700 [--punto:#dc2626]",
};

const ESTADO_RUTA_CLASSES: Record<string, string> = {
  planificada: "bg-gray-100 text-gray-700 [--punto:#9ca3af]",
  en_curso: "bg-amber-50 text-amber-800 [--punto:#d97706]",
  completada: "bg-emerald-50 text-emerald-700 [--punto:#16a34a]",
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
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--punto,#9ca3af)]" />
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
