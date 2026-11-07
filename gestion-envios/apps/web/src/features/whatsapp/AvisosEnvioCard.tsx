import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { formatearFecha } from "@/utils/fechas";
import { avisosDeEnvio } from "./api";

const ESTADO: Record<string, { texto: string; clase: string }> = {
  enviado: { texto: "Enviado", clase: "bg-green-100 text-green-700" },
  pendiente: { texto: "Enviando", clase: "bg-gray-100 text-gray-700" },
  fallido: { texto: "Falló", clase: "bg-red-100 text-red-700" },
  omitido: { texto: "Sin teléfono", clase: "bg-amber-100 text-amber-700" },
};

/** HU-17: los avisos de WhatsApp que recibió el destinatario de este envío. */
export function AvisosEnvioCard({ envioId }: { envioId: string }) {
  const { data } = useQuery({ queryKey: ["envios", envioId, "avisos"], queryFn: () => avisosDeEnvio(envioId), refetchInterval: 20_000 });
  if (!data || data.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Avisos por WhatsApp</h2>
      <ul className="flex flex-col gap-3">
        {data.map((a) => {
          const e = ESTADO[a.estado] ?? ESTADO.pendiente;
          return (
            <li key={a.created_at + a.tipo} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.clase}`}>{e.texto}</span>
                <span className="text-xs text-gray-400">{formatearFecha(a.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line rounded-xl rounded-tl-none bg-[#dcf8c6] px-3 py-2 text-gray-800">{a.mensaje}</p>
              {a.error && <p className="mt-1 text-xs text-red-600">{a.error}</p>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
