import { useQuery } from "@tanstack/react-query";
import { Mail, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatearFecha } from "@/utils/fechas";
import { avisosDeEnvio, type AvisoEnvio } from "./api";

const ESTADO: Record<AvisoEnvio["estado"], { texto: string; clase: string; titulo?: string }> = {
  enviado: { texto: "Enviado", clase: "bg-green-100 text-green-700" },
  pendiente: { texto: "Enviando", clase: "bg-gray-100 text-gray-700" },
  fallido: { texto: "Falló", clase: "bg-red-100 text-red-700" },
  omitido: { texto: "Sin contacto", clase: "bg-amber-100 text-amber-700", titulo: "El destinatario no tiene celular ni mail válidos" },
  simulado: { texto: "Simulado", clase: "bg-sky-100 text-sky-700", titulo: "Envío de demostración: el mensaje se registró pero no se mandó" },
};

const TIPO: Record<string, string> = {
  envio_en_camino: "En camino",
  envio_entregado: "Entregado",
  envio_no_entregado: "No entregado",
  envio_reprogramado: "Reprogramado",
};

/** HU-17: los avisos que recibió el destinatario de este envío, por WhatsApp o, de respaldo, por mail. */
export function AvisosEnvioCard({ envioId }: { envioId: string }) {
  const { data } = useQuery({ queryKey: ["envios", envioId, "avisos"], queryFn: () => avisosDeEnvio(envioId), refetchInterval: 20_000 });
  if (!data || data.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Avisos al destinatario</h2>
      <ul className="flex flex-col gap-4">
        {data.map((a) => {
          const e = ESTADO[a.estado] ?? ESTADO.pendiente;
          const porMail = a.canal === "mail";
          const Icono = porMail ? Mail : MessageCircle;
          return (
            <li key={a.created_at + a.tipo} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700">
                  <Icono className={`h-3.5 w-3.5 ${porMail ? "text-sky-600" : "text-[#1fa855]"}`} aria-hidden />
                  {porMail ? "Mail" : "WhatsApp"}
                  {TIPO[a.tipo] && <span className="font-normal text-gray-500">· {TIPO[a.tipo]}</span>}
                </span>
                <span title={e.titulo} className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.clase}`}>
                  {e.texto}
                </span>
                <span className="ml-auto text-xs text-gray-400">{formatearFecha(a.created_at)}</span>
              </div>
              <p
                className={`mt-1.5 whitespace-pre-line break-words px-3 py-2 text-gray-800 ${
                  porMail ? "rounded-xl border border-hormigon-200 bg-white font-[450]" : "rounded-xl rounded-tl-none bg-[#dcf8c6]"
                }`}
              >
                {a.mensaje}
              </p>
              {a.error && <p className="mt-1 text-xs text-red-600">{a.error}</p>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
