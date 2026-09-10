import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { obtenerTracking } from "@/features/envios/api";
import { trackingCodigoSchema } from "@/features/envios/schema";
import { HistorialTimeline } from "@/features/envios/HistorialTimeline";
import { getApiErrorMessage } from "@/services/api-client";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Card, EmptyState } from "@/components/ui/Card";
import { EstadoEnvioBadge } from "@/components/ui/Badge";

export function TrackingPage() {
  const [codigo, setCodigo] = useState("");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [buscado, setBuscado] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["tracking", buscado],
    queryFn: () => obtenerTracking(buscado as string),
    enabled: buscado !== null,
    retry: false,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = trackingCodigoSchema.safeParse(codigo);
    if (!parsed.success) {
      setErrorLocal(parsed.error.issues[0]?.message ?? "Código inválido");
      return;
    }
    setErrorLocal(null);
    setBuscado(parsed.data);
  }

  function rastrearOtro() {
    setBuscado(null);
    setCodigo("");
    setErrorLocal(null);
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-movii-900 px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-movii-500 text-lg font-bold text-movii-900">
            M
          </span>
          <h1 className="text-lg font-semibold text-white">Rastreá tu envío</h1>
          <p className="text-center text-sm text-gray-300">Ingresá el código de guía para ver dónde está tu paquete</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
            <div className="flex-1">
              <InputField
                label="Código de guía"
                name="codigo"
                placeholder="MOV-20260909-0001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                error={errorLocal ?? undefined}
              />
            </div>
            <Button type="submit" loading={isLoading}>
              Rastrear
            </Button>
          </form>
        </Card>

        <div className="mt-6">
          {buscado === null && (
            <EmptyState title="Todavía no buscaste nada" description="Escribí tu código de guía arriba para ver el estado de tu envío." />
          )}

          {buscado !== null && isLoading && (
            <div className="rounded-lg bg-white p-8">
              <Spinner label="Buscando envío…" />
            </div>
          )}

          {buscado !== null && !isLoading && isError && (
            <Alert variant="error">{getApiErrorMessage(error, "No se encontró ningún envío con ese código")}</Alert>
          )}

          {buscado !== null && !isLoading && !isError && data && (
            <div className="flex flex-col gap-4">
              <Card>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-gray-900">{data.codigo_guia}</h2>
                  <EstadoEnvioBadge estado={data.estado} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Destino</dt>
                    <dd className="text-sm text-gray-900">{data.localidad}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Actualizado</dt>
                    <dd className="text-sm text-gray-900">{data.actualizado_en}</dd>
                  </div>
                </dl>
              </Card>

              <Card>
                <h2 className="mb-3 text-sm font-semibold text-gray-900">Historial</h2>
                <HistorialTimeline eventos={data.historial} />
              </Card>

              <button type="button" onClick={rastrearOtro} className="self-center text-sm text-gray-300 hover:underline">
                Rastrear otro envío
              </button>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          <Link to="/login" className="hover:underline">
            Acceso para operadores
          </Link>
        </p>
      </div>
    </div>
  );
}
