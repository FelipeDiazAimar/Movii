/** Indicador de carga centrado en el espacio que ocupa. */
export function Spinner({ label = "Cargando…", pantalla = false }: { label?: string; pantalla?: boolean }) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-3 text-sm font-medium text-gray-500 ${pantalla ? "min-h-screen" : "py-12"}`}
      role="status"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-hormigon-200 border-t-movii-500" aria-hidden="true" />
      {label}
    </div>
  );
}
