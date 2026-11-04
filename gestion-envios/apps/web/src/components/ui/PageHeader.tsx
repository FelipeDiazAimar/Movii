import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Enlace "← Volver" (pantallas de detalle). */
  back?: { to: string; label: string };
  /** Badge de estado al lado del título. */
  badge?: ReactNode;
  /** Acción principal a la derecha (listados). */
  action?: ReactNode;
}

/** Encabezado único de página: mismo título, subtítulo, volver y acción en todo el panel. */
export function PageHeader({ title, description, back, badge, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {back && (
          <Link to={back.to} className="text-sm text-movii-600 hover:underline">
            ← {back.label}
          </Link>
        )}
        <div className={`flex items-center gap-3 ${back ? "mt-1" : ""}`}>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {badge}
        </div>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Anchos de contenido: listados a todo el ancho, formularios y detalles en una columna acotada. */
export const PAGE_NARROW = "flex max-w-3xl flex-col gap-6";
export const PAGE_WIDE = "flex flex-col gap-6";
