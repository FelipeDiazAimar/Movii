import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { InputField, SelectField } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { getApiErrorMessage } from "@/services/api-client";

type Pestana = "envios" | "repartidores" | "incidencias";

const PESTANAS: Array<{ id: Pestana; label: string }> = [
  { id: "envios", label: "Envíos" },
  { id: "repartidores", label: "Repartidores" },
  { id: "incidencias", label: "Incidencias" },
];

const ESTADOS = ["pendiente", "asignado", "en_camino", "entregado", "no_entregado"];

function Estado({ cargando, error, fallback }: { cargando: boolean; error: unknown; fallback: string }) {
  if (cargando) return <Spinner />;
  if (error) return <Alert variant="error">{getApiErrorMessage(error, fallback)}</Alert>;
  return null;
}

function TabEnvios({ desde, hasta }: { desde: string; hasta: string }) {
  const [estado, setEstado] = useState("");
  const filtro = { desde, hasta, estado };
  const q = useQuery({ queryKey: ["reportes", "envios", desde, hasta, estado], queryFn: () => reporteEnvios(filtro) });
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
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Guía</th>
                  <th className="px-3 py-2">Destinatario</th>
                  <th className="px-3 py-2">Localidad</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Motivo de fallo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {q.data.envios.map((e) => (
                  <tr key={e.codigo_guia}>
                    <td className="px-3 py-2 font-medium text-gray-900">{e.codigo_guia}</td>
                    <td className="px-3 py-2 text-gray-700">{e.destinatario}</td>
                    <td className="px-3 py-2 text-gray-700">{e.localidad}</td>
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
  const q = useQuery({ queryKey: ["reportes", "repartidores", desde, hasta], queryFn: () => rankingRepartidores({ desde, hasta }) });
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
                <div key={r.repartidor_id} className={`rounded-lg border p-4 text-center ${medallas[i]}`}>
                  <p className="text-2xl font-bold text-gray-900">#{r.posicion}</p>
                  <p className="font-medium text-gray-900">{r.nombre}</p>
                  <p className="text-sm text-gray-600">{r.tasa_efectividad}% efectividad</p>
                </div>
              ))}
            </div>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
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
              <tbody className="divide-y divide-gray-100">
                {ranking.map((r) => (
                  <tr key={r.repartidor_id}>
                    <td className="px-3 py-2 text-gray-700">{r.posicion}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{r.nombre}</td>
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

function TabIncidencias({ desde, hasta }: { desde: string; hasta: string }) {
  const q = useQuery({ queryKey: ["reportes", "incidencias", desde, hasta], queryFn: () => reporteIncidencias({ desde, hasta }) });

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
                <li key={d.motivo}>
                  <div className="mb-1 flex justify-between text-sm text-gray-700">
                    <span>{d.etiqueta}</span>
                    <span>
                      {d.cantidad} ({d.porcentaje}%)
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-200">
                    <div className="h-3 rounded-full bg-red-400" style={{ width: `${d.porcentaje}%` }} />
                  </div>
                </li>
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
      <h1 className="text-xl font-semibold text-gray-900">Reportes</h1>

      <div className="flex items-start gap-3">
        <InputField label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <InputField label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} error={errorPeriodo} />
      </div>

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
            className={`px-4 py-2 text-sm font-medium ${
              pestana === p.id ? "border-b-2 border-movii-500 text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
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
