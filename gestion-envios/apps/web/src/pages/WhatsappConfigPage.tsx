import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { desvincularWhatsapp, estadoWhatsapp, formatearTelefono } from "@/features/whatsapp/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader, PAGE_NARROW } from "@/components/ui/PageHeader";
import { getApiErrorMessage } from "@/services/api-client";

/** Supervisor: vincula la cuenta de WhatsApp que manda los códigos de acceso y los avisos (HU-16/HU-17). */
export function WhatsappConfigPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["whatsapp", "estado"],
    queryFn: estadoWhatsapp,
    // Mientras se espera el escaneo el QR rota cada ~20 s.
    refetchInterval: (q) => (q.state.data?.vinculado ? 15_000 : 4_000),
  });
  const desvincular = useMutation({
    mutationFn: desvincularWhatsapp,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "estado"] }),
  });

  return (
    <div className={PAGE_NARROW}>
      <PageHeader title="WhatsApp" description="Cuenta que envía los códigos de acceso y los avisos a clientes y repartidores." />
      {isLoading && <Spinner label="Consultando la conexión…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudo consultar WhatsApp")}</Alert>}
      {data && !data.habilitado && (
        <Alert variant="info">
          WhatsApp está deshabilitado en este servidor (WHATSAPP_HABILITADO=false): los códigos y avisos se escriben en el log de la API en lugar de enviarse.
        </Alert>
      )}
      {data?.habilitado && data.vinculado && (
        <Card>
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25d366] text-2xl text-white" aria-hidden>
              ✓
            </span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Cuenta vinculada</p>
              <p className="text-sm text-gray-600">
                {data.numero ? formatearTelefono(data.numero) : "—"} · {data.conectado ? "conectada" : "reconectando…"}
              </p>
            </div>
            <Button variant="danger" loading={desvincular.isPending} onClick={() => desvincular.mutate()}>
              Desvincular
            </Button>
          </div>
          {desvincular.isError && <Alert variant="error">{getApiErrorMessage(desvincular.error, "No se pudo desvincular")}</Alert>}
        </Card>
      )}
      {data?.habilitado && !data.vinculado && (
        <Card>
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            {data.qr_imagen ? (
              <img src={data.qr_imagen} alt="Código QR para vincular WhatsApp" className="h-56 w-56 rounded-xl border border-gray-200" />
            ) : (
              <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-dashed border-gray-300">
                <Spinner label="Generando QR…" />
              </div>
            )}
            <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>Abrí WhatsApp en el celular de la empresa.</li>
              <li>
                Tocá <strong>Configuración → Dispositivos vinculados → Vincular un dispositivo</strong>.
              </li>
              <li>Escaneá este código. Se renueva solo cada 20 segundos.</li>
            </ol>
          </div>
        </Card>
      )}
    </div>
  );
}
