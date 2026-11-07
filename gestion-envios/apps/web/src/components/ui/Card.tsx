import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-panel border border-hormigon-200 bg-white p-5 shadow-panel ${className}`}>{children}</div>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-panel border border-dashed border-hormigon-300 bg-hormigon-50 py-10 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="text-xs text-gray-500">{description}</p>}
    </div>
  );
}
