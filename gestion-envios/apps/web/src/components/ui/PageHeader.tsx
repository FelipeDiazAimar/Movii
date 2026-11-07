import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Enlace "Volver" (pantallas de detalle). */
  back?: { to: string; label: string };
  /** Badge de estado al lado del título. */
  badge?: ReactNode;
  /** Acción principal a la derecha (listados). */
  action?: ReactNode;
  /** Ícono de la sección (el mismo que en el sidebar). */
  icon?: LucideIcon;
}

/** Encabezado único de página: mismo título, subtítulo, volver y acción en todo el panel. */
export function PageHeader({ title, description, back, badge, action, icon: Icono }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {back.label}
          </Link>
        )}
        <div className="flex items-center gap-3">
          {Icono && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-asfalto-900 text-movii-500 shadow-panel">
              <Icono className="h-5 w-5" strokeWidth={2.2} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-expandida truncate text-2xl font-extrabold text-gray-900">{title}</h1>
              {badge}
            </div>
            {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
          </div>
        </div>
      </div>
      {action}
    </div>
  );
}

/** Anchos de contenido: listados a todo el ancho, formularios y detalles en una columna acotada. */
export const PAGE_NARROW = "flex max-w-3xl flex-col gap-6";
export const PAGE_WIDE = "flex flex-col gap-6";
