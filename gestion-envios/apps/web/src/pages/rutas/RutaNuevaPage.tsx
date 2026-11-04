import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { RutaForm } from "@/features/rutas/RutaForm";
import { crearRuta } from "@/features/rutas/api";
import type { RutaInput } from "@/features/rutas/types";
import { getApiErrorMessage } from "@/services/api-client";
import { Card } from "@/components/ui/Card";
import { PageHeader, PAGE_NARROW } from "@/components/ui/PageHeader";

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
    <div className={PAGE_NARROW}>
      <PageHeader title="Nueva ruta" description="La ruta se crea en estado planificada." />
      <Card>
        <RutaForm onSubmit={handleSubmit} enviando={enviando} errorServidor={errorServidor} textoBoton="Crear ruta" />
      </Card>
    </div>
  );
}
