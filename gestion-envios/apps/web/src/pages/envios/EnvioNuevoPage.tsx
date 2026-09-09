import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { EnvioForm } from "@/features/envios/EnvioForm";
import { crearEnvio } from "@/features/envios/api";
import type { CrearEnvioInput, CrearEnvioResponse } from "@/features/envios/types";
import { getApiErrorMessage } from "@/services/api-client";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

export function EnvioNuevoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [creado, setCreado] = useState<CrearEnvioResponse | null>(null);

  async function handleSubmit(input: CrearEnvioInput) {
    setEnviando(true);
    setErrorServidor(null);
    try {
      const envio = await crearEnvio(input);
      await queryClient.invalidateQueries({ queryKey: ["envios"] });
      setCreado(envio);
      setTimeout(() => navigate(`/envios/${envio.id}`), 900);
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
          Envío {creado.codigo_guia} registrado correctamente. Redirigiendo al detalle…
        </Alert>
      )}

      <Card>
        <EnvioForm onSubmit={handleSubmit} enviando={enviando} errorServidor={errorServidor} />
      </Card>
    </div>
  );
}
