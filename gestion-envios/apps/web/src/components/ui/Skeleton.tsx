import { Card } from "@/components/ui/Card";

/** Bloque animado con el tono amarillo de Movii. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-movii-100 ${className}`} aria-hidden="true" />;
}

function TablaBase({ filas }: { filas: number }) {
  return (
    <Card className="p-0">
      <div className="border-b border-hormigon-200 bg-hormigon-50 px-4 py-3">
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="divide-y divide-hormigon-100">
        {Array.from({ length: filas }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full bg-movii-400/40" />
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Esqueleto de listado en tabla. */
export function SkeletonTabla({ filas = 6, label = "Cargando…" }: { filas?: number; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <TablaBase filas={filas} />
    </div>
  );
}

/** Esqueleto de grilla de tarjetas. */
export function SkeletonTarjetas({ cantidad = 6, label = "Cargando…" }: { cantidad?: number; label?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label={label}>
      {Array.from({ length: cantidad }, (_, i) => (
        <Card key={i} className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl bg-movii-400/40" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-9 w-full" />
        </Card>
      ))}
    </div>
  );
}

/** Fallback de página completa (Suspense, detalles, dashboards). */
export function SkeletonPagina({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label={label}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-2xl bg-movii-500/60" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>
      <TablaBase filas={5} />
    </div>
  );
}
