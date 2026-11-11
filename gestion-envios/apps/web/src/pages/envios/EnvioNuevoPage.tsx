import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { EnvioForm } from "@/features/envios/EnvioForm";
import { crearEnvio } from "@/features/envios/api";
import { asignarEnvios } from "@/features/rutas/api";
import type { RutaListItem } from "@/features/rutas/types";
import type { CrearEnvioInput, CrearEnvioResponse } from "@/features/envios/types";
import { getApiErrorMessage } from "@/services/api-client";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, PAGE_NARROW } from "@/components/ui/PageHeader";

import { PackagePlus } from "lucide-react";
export function EnvioNuevoPage() {
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [creado, setCreado] = useState<CrearEnvioResponse | null>(null);
  const [rutaAsignada, setRutaAsignada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const cartelExito = useRef<HTMLDivElement>(null);

  // Tras registrar, el form se vacía y queda abajo: llevar la vista al cartel
  // de éxito (scroll + foco, así también lo anuncia el lector de pantalla).
  useEffect(() => {
    const cartel = cartelExito.current;
    if (!creado || !cartel) return;
    cartel.scrollIntoView?.({ behavior: "smooth", block: "start" });
    cartel.focus({ preventScroll: true });
  }, [creado]);

  async function copiar(texto: string, clave: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setCopiado(null);
    }
  }

  async function handleSubmit(input: CrearEnvioInput, rutaId: string) {
    setEnviando(true);
    setErrorServidor(null);
    try {
      const envio = await crearEnvio(input);
      let asignada: string | null = null;
      if (rutaId) {
        try {
          await asignarEnvios(rutaId, [envio.id]);
          const ruta = queryClient.getQueryData<RutaListItem[]>(["rutas", { fecha: undefined }])?.find((r) => r.id === rutaId);
          asignada = ruta ? `${ruta.nombre} (${ruta.repartidor_nombre ?? "sin repartidor"})` : "la ruta elegida";
        } catch (err) {
          setErrorServidor(`El envío se registró, pero no se pudo asignar a la ruta: ${getApiErrorMessage(err, "error desconocido")}. Asignalo desde su detalle.`);
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["envios"] }),
        queryClient.invalidateQueries({ queryKey: ["rutas"] }),
      ]);
      setCreado(envio);
      setRutaAsignada(asignada);
    } catch (err) {
      setErrorServidor(getApiErrorMessage(err, "No se pudo registrar el envío"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={PAGE_NARROW}>
      <PageHeader title="Nuevo envío" icon={PackagePlus} description="Se genera automáticamente un código de guía único (MOV-AAAAMMDD-NNNN) y el envío queda en estado pendiente." />

      {creado && (
        <div ref={cartelExito} tabIndex={-1} className="scroll-mt-4 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-green-400" data-testid="cartel-exito">
        <Alert variant="success">
          <div className="flex flex-col gap-2">
            <span>
              Envío registrado. Código de guía para el cliente: <strong data-testid="codigo-creado">{creado.codigo_guia}</strong>
            </span>
            {rutaAsignada && <span className="text-xs">Asignado a la ruta: {rutaAsignada}</span>}
            <span className="break-all text-xs">
              Seguimiento: {`${window.location.origin}/tracking/${creado.codigo_guia}`}
            </span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded border border-current px-3 py-1 text-sm" onClick={() => copiar(creado.codigo_guia, "codigo")}>
                {copiado === "codigo" ? "¡Copiado!" : "Copiar código"}
              </button>
              <button
                type="button"
                className="rounded border border-current px-3 py-1 text-sm"
                onClick={() => copiar(`${window.location.origin}/tracking/${creado.codigo_guia}`, "enlace")}
              >
                {copiado === "enlace" ? "¡Copiado!" : "Copiar enlace de seguimiento"}
              </button>
              <Link className="rounded border border-current px-3 py-1 text-sm" to={`/envios/${creado.id}`}>
                Ver detalle
              </Link>
            </div>
          </div>
        </Alert>
        </div>
      )}

      <Card>
        <EnvioForm key={creado?.id ?? "nuevo"} onSubmit={handleSubmit} enviando={enviando} errorServidor={errorServidor} />
      </Card>
    </div>
  );
}
