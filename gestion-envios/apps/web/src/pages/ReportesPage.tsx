import { Ban, BarChart3, CalendarRange, ChevronDown, CircleHelp, Download, Hash, MapPin, MapPinOff, Medal, Package, ShieldAlert, TriangleAlert, Trophy, UserRound, UserX, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  descargarReporteEnviosCSV,
  rankingRepartidores,
  reporteEnvios,
  reporteIncidencias,
} from "@/features/analitica/api";
import { hoyISO, primerDiaMesISO } from "@/features/analitica/fechas";
import { EstadoEnvioBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { DateField, SelectField } from "@/components/ui/Field";
import { SkeletonTabla } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { getApiErrorMessage } from "@/services/api-client";
import { formatearFecha } from "@/utils/fechas";
import type { DistribucionMotivo } from "@/features/analitica/types";

type Pestana = "envios" | "repartidores" | "incidencias";

const PESTANAS: Array<{ id: Pestana; label: string; icono: LucideIcon }> = [
  { id: "envios", label: "Envíos", icono: Package },
  { id: "repartidores", label: "Repartidores", icono: Trophy },
  { id: "incidencias", label: "Incidencias", icono: TriangleAlert },
];

const ESTADOS = ["pendiente", "asignado", "en_camino", "entregado", "no_entregado"];

function Estado({ cargando, error, fallback }: { cargando: boolean; error: unknown; fallback: string }) {
  if (cargando) return <SkeletonTabla filas={4} label="Cargando reporte…" />;
  if (error) return <Alert variant="error">{getApiErrorMessage(error, fallback)}</Alert>;
  return null;
}

function TabEnvios({ desde, hasta }: { desde: string; hasta: string }) {
  const [estado, setEstado] = useState("");
  const filtro = { desde, hasta, estado };
  const q = useQuery({ queryKey: ["reportes", "envios", desde, hasta, estado], queryFn: () => reporteEnvios(filtro), placeholderData: keepPreviousData });
  const csv = useMutation({ mutationFn: () => descargarReporteEnviosCSV(filtro) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <SelectField label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </SelectField>
        <Button variant="secondary" loading={csv.isPending} onClick={() => csv.mutate()}>
          <Download className="h-4 w-4" aria-hidden />
          Descargar CSV
        </Button>
      </div>
      {csv.isError && <Alert variant="error">{getApiErrorMessage(csv.error, "No se pudo descargar el CSV")}</Alert>}
      <Estado cargando={q.isLoading} error={q.error} fallback="No se pudo cargar el reporte" />
      {q.data &&
        (q.data.envios.length === 0 ? (
          <EmptyState title="Sin envíos en el período" />
        ) : (
          <>
            <p className="text-xs text-gray-500">Total: {q.data.total}</p>
            <table className="min-w-full divide-y divide-hormigon-200 text-sm">
              <thead className="bg-hormigon-50 text-left text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-3 py-2">Guía</th>
                  <th className="px-3 py-2">Destinatario</th>
                  <th className="px-3 py-2">Localidad</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Motivo de fallo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hormigon-100">
                {q.data.envios.map((e) => (
                  <tr key={e.codigo_guia}>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-hormigon-100 text-gray-600">
                          <Package className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        {e.codigo_guia}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                        {e.destinatario}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                        {e.localidad}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <EstadoEnvioBadge estado={e.estado} />
                    </td>
                    <td className="px-3 py-2 text-gray-700">{e.motivo_fallo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ))}
    </div>
  );
}

function TabRepartidores({ desde, hasta }: { desde: string; hasta: string }) {
  const q = useQuery({ queryKey: ["reportes", "repartidores", desde, hasta], queryFn: () => rankingRepartidores({ desde, hasta }), placeholderData: keepPreviousData });
  const ranking = q.data?.ranking ?? [];
  const medallas = ["bg-amber-100 border-amber-300", "bg-gray-100 border-gray-300", "bg-orange-100 border-orange-300"];

  return (
    <div className="flex flex-col gap-4">
      <Estado cargando={q.isLoading} error={q.error} fallback="No se pudo cargar el ranking" />
      {q.data &&
        (ranking.length === 0 ? (
          <EmptyState title="Sin datos de repartidores en el período" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              {ranking.slice(0, 3).map((r, i) => (
                <div key={r.repartidor_id} className={`rounded-2xl border p-4 text-center ${medallas[i]}`}>
                  <Medal className={`mx-auto h-7 w-7 ${["text-amber-500", "text-slate-400", "text-orange-700"][i]}`} aria-hidden />
                  <p className="font-expandida text-2xl font-black text-gray-900">#{r.posicion}</p>
                  <p className="font-medium text-gray-900">{r.nombre}</p>
                  <p className="text-sm text-gray-600">{r.tasa_efectividad}% efectividad</p>
                </div>
              ))}
            </div>
            <table className="min-w-full divide-y divide-hormigon-200 text-sm">
              <thead className="bg-hormigon-50 text-left text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-3 py-2">Pos.</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Asignados</th>
                  <th className="px-3 py-2">Entregados</th>
                  <th className="px-3 py-2">Fallidos</th>
                  <th className="px-3 py-2">Tasa</th>
                  <th className="px-3 py-2">Prom. min</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hormigon-100">
                {ranking.map((r) => (
                  <tr key={r.repartidor_id}>
                    <td className="px-3 py-2 text-gray-700">
                      <span className="inline-flex items-center gap-1">
                        {r.posicion <= 3 ? <Trophy className={`h-3.5 w-3.5 ${["", "text-amber-500", "text-slate-400", "text-orange-700"][r.posicion]}`} aria-hidden /> : <Hash className="h-3.5 w-3.5 text-gray-300" aria-hidden />}
                        {r.posicion}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-asfalto-900 text-xs font-bold text-movii-500">{r.nombre.slice(0, 1)}</span>
                        {r.nombre}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.asignados}</td>
                    <td className="px-3 py-2 text-gray-700">{r.entregados}</td>
                    <td className="px-3 py-2 text-gray-700">{r.fallidos}</td>
                    <td className="px-3 py-2 text-gray-700">{r.tasa_efectividad}%</td>
                    <td className="px-3 py-2 text-gray-700">{r.promedio_minutos_entrega ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ))}
    </div>
  );
}

const ICONO_MOTIVO: Record<string, LucideIcon> = {
  cliente_ausente: UserX,
  direccion_incorrecta: MapPinOff,
  rechazado: Ban,
  zona_insegura: ShieldAlert,
  otro: CircleHelp,
};

function FilaMotivo({ d }: { d: DistribucionMotivo }) {
  const [abierto, setAbierto] = useState(false);
  const Icono = ICONO_MOTIVO[d.motivo] ?? CircleHelp;
  const casos = d.casos ?? [];
  return (
    <li>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        disabled={d.cantidad === 0}
        aria-expanded={abierto}
        aria-label={`${d.etiqueta}: ${d.cantidad} incidencias. ${abierto ? "Ocultar" : "Ver"} detalle`}
        className="block w-full rounded-lg text-left enabled:hover:bg-hormigon-50 disabled:cursor-default"
      >
        <div className="mb-1 flex justify-between gap-3 text-sm text-gray-700">
          <span className="inline-flex items-center gap-2">
            <Icono className="h-4 w-4 text-red-500" aria-hidden />
            {d.etiqueta}
          </span>
          <span className="inline-flex items-center gap-2">
            {d.cantidad} ({d.porcentaje}%)
            {d.cantidad > 0 && <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />}
          </span>
        </div>
        <div className="h-3 rounded-full bg-hormigon-100">
          <div className="h-3 rounded-full bg-gradient-to-r from-red-400 to-red-500" style={{ width: `${d.porcentaje}%` }} />
        </div>
      </button>
      {abierto && casos.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-hormigon-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Guía</th>
                <th className="px-3 py-2">Destinatario</th>
                <th className="px-3 py-2">Repartidor</th>
                <th className="px-3 py-2">Cuándo</th>
                <th className="px-3 py-2">Comentario</th>
              </tr>
            </thead>
            <tbody>
              {casos.map((c) => (
                <tr key={`${c.codigo_guia}-${c.fecha}`} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{c.codigo_guia}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{c.destinatario}</div>
                    <div className="text-xs text-gray-500">{c.direccion}</div>
                  </td>
                  <td className="px-3 py-2 font-semibold text-gray-900">{c.repartidor}</td>
                  <td className="px-3 py-2 text-gray-700">{formatearFecha(c.fecha)}</td>
                  <td className="px-3 py-2 text-gray-700">{c.comentario || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

function TabIncidencias({ desde, hasta }: { desde: string; hasta: string }) {
  const q = useQuery({ queryKey: ["reportes", "incidencias", desde, hasta], queryFn: () => reporteIncidencias({ desde, hasta }), placeholderData: keepPreviousData });

  return (
    <div className="flex flex-col gap-4">
      <Estado cargando={q.isLoading} error={q.error} fallback="No se pudo cargar las incidencias" />
      {q.data &&
        (q.data.total_incidencias === 0 ? (
          <EmptyState title="Sin incidencias en el período" />
        ) : (
          <>
            <p className="text-sm text-gray-700">
              Total de incidencias: <strong>{q.data.total_incidencias}</strong>
            </p>
            <ul className="flex flex-col gap-3">
              {q.data.distribucion.map((d) => (
                <FilaMotivo key={d.motivo} d={d} />
              ))}
            </ul>
          </>
        ))}
    </div>
  );
}

export function ReportesPage() {
  const [desde, setDesde] = useState(primerDiaMesISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [pestana, setPestana] = useState<Pestana>("envios");

  const errorPeriodo = !desde || !hasta ? "Indicá desde y hasta" : desde > hasta ? "La fecha desde no puede ser posterior a hasta" : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reportes" icon={BarChart3}
        description="Envíos, desempeño de repartidores e incidencias del período elegido."
        action={
          <div className="flex flex-wrap items-end gap-3">
            <CalendarRange className="mb-2.5 h-5 w-5 text-gray-400" aria-hidden />
            <DateField label="Desde" value={desde} onChange={setDesde} />
            <DateField label="Hasta" value={hasta} onChange={setHasta} error={errorPeriodo} />
          </div>
        }
      />

      <div role="tablist" aria-label="Reportes" className="flex gap-1 border-b border-gray-200">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            role="tab"
            type="button"
            id={`tab-${p.id}`}
            aria-selected={pestana === p.id}
            aria-controls={`panel-${p.id}`}
            onClick={() => setPestana(p.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold ${
              pestana === p.id ? "border-b-2 border-movii-500 text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <p.icono className={`h-4 w-4 ${pestana === p.id ? "text-movii-600" : ""}`} aria-hidden />
            {p.label}
          </button>
        ))}
      </div>

      <Card>
        <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`tab-${pestana}`}>
          {errorPeriodo ? (
            <Alert variant="error">{errorPeriodo}</Alert>
          ) : (
            <>
              {pestana === "envios" && <TabEnvios desde={desde} hasta={hasta} />}
              {pestana === "repartidores" && <TabRepartidores desde={desde} hasta={hasta} />}
              {pestana === "incidencias" && <TabIncidencias desde={desde} hasta={hasta} />}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
