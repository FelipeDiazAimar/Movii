import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { EnvioForm } from "@/features/envios/EnvioForm";
import { crearEnvio } from "@/features/envios/api";
import type { CrearEnvioInput, CrearEnvioResponse } from "@/features/envios/types";
import { getApiErrorMessage } from "@/services/api-client";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

export function EnvioNuevoPage() {
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [creado, setCreado] = useState<CrearEnvioResponse | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(texto: string, clave: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setCopiado(null);
    }
  }

  async function handleSubmit(input: CrearEnvioInput) {
    setEnviando(true);
    setErrorServidor(null);
    try {
      const envio = await crearEnvio(input);
      await queryClient.invalidateQueries({ queryKey: ["envios"] });
      setCreado(envio);
    } catch (err) {
      setErrorServidor(getApiErrorMessage(err, "No se pudo registrar el envío"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Nuevo envío</h1>
        <p className="text-sm text-gray-500">
          Se genera automáticamente un código de guía único (MOV-AAAAMMDD-NNNN) y el envío queda en estado pendiente.
        </p>
      </div>

      {creado && (
        <Alert variant="success">
          <div className="flex flex-col gap-2">
            <span>
              Envío registrado. Código de guía para el cliente: <strong data-testid="codigo-creado">{creado.codigo_guia}</strong>
            </span>
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
      )}

      <Card>
        <EnvioForm onSubmit={handleSubmit} enviando={enviando} errorServidor={errorServidor} />
      </Card>
    </div>
  );
}
