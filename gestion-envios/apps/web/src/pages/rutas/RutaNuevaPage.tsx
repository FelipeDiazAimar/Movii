import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { RutaForm } from "@/features/rutas/RutaForm";
import { crearRuta } from "@/features/rutas/api";
import type { RutaInput } from "@/features/rutas/types";
import { getApiErrorMessage } from "@/services/api-client";
import { Card } from "@/components/ui/Card";

export function RutaNuevaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  async function handleSubmit(input: RutaInput) {
    setEnviando(true);
    setErrorServidor(null);
    try {
      const ruta = await crearRuta(input);
      await queryClient.invalidateQueries({ queryKey: ["rutas"] });
      navigate(`/rutas/${ruta.id}`, { replace: true });
    } catch (err) {
      setErrorServidor(getApiErrorMessage(err, "No se pudo crear la ruta"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Nueva ruta</h1>
        <p className="text-sm text-gray-500">La ruta se crea en estado planificada.</p>
      </div>
      <Card>
        <RutaForm onSubmit={handleSubmit} enviando={enviando} errorServidor={errorServidor} textoBoton="Crear ruta" />
      </Card>
    </div>
  );
}
