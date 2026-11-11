import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listarRutas, eliminarRuta } from "@/features/rutas/api";
import { EstadoRutaBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Card";
import { SkeletonTarjetas } from "@/components/ui/Skeleton";
import { BarraFiltros, FiltroSelect } from "@/components/ui/BarraFiltros";
import { filtrarRutas } from "@/utils/filtros";
import { listarRepartidores } from "@/features/usuarios/api";
import { ESTADOS_RUTA, type RutaListItem } from "@/features/rutas/types";
import { DialogoEliminar, usePuedeEliminar } from "@/components/ui/BotonEliminar";
import { MenuAcciones } from "@/components/ui/MenuAcciones";
import { Alert } from "@/components/ui/Alert";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/services/api-client";
import { PageHeader, PAGE_WIDE } from "@/components/ui/PageHeader";
import { hoyISO } from "@/features/envios/formato";
import { SpotlightCard } from "@/components/ui/Efectos";
import { Box, Eye, MapPin, MapPinned, Package, Plus, Route, Trash2, Truck, Weight } from "lucide-react";

type Pestana = "hoy" | "proximas" | "anteriores" | "todas";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_INICIALES = 5;

function sumarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(a, m - 1, d + n);
  return hoyISO(f);
}

/** "Hoy · miércoles 11 de noviembre", "Mañana · …" o "lunes 9 de noviembre de 2026" si es de otro año. */
function tituloDia(iso: string, hoy: string): { titulo: string; detalle: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return { titulo: iso, detalle: "" };
  const f = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const largo = `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}${m[1] !== hoy.slice(0, 4) ? ` de ${m[1]}` : ""}`;
  if (iso === hoy) return { titulo: "Hoy", detalle: largo };
  if (iso === sumarDias(hoy, 1)) return { titulo: "Mañana", detalle: largo };
  if (iso === sumarDias(hoy, -1)) return { titulo: "Ayer", detalle: largo };
  return { titulo: largo.charAt(0).toUpperCase() + largo.slice(1), detalle: "" };
}

function agruparPorDia(rutas: RutaListItem[], descendente: boolean): Array<[string, RutaListItem[]]> {
  const grupos = new Map<string, RutaListItem[]>();
  for (const r of rutas) grupos.set(r.fecha, [...(grupos.get(r.fecha) ?? []), r]);
  const dias = [...grupos.keys()].sort();
  if (descendente) dias.reverse();
  return dias.map((d) => [d, (grupos.get(d) ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre))]);
}

function Avance({ ruta }: { ruta: RutaListItem }) {
  const total = ruta.cantidad_envios;
  const ok = ruta.entregados ?? 0;
  const mal = ruta.no_entregados ?? 0;
  const resueltos = ok + mal;
  const texto =
    total === 0
      ? "Todavía sin envíos asignados"
      : ruta.estado === "planificada" && resueltos === 0
        ? "Sin iniciar"
        : `${ok} de ${total} entregados${mal ? ` · ${mal} sin entregar` : ""}`;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{texto}</span>
        {total > 0 && <span className="tabular font-semibold text-gray-700">{Math.round((resueltos / total) * 100)}%</span>}
      </div>
      <div
        className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-hormigon-100"
        role="progressbar"
        aria-label="Avance de la ruta"
        aria-valuemin={0}
        aria-valuemax={total || 1}
        aria-valuenow={resueltos}
      >
        {total > 0 && (
          <>
            <div className="h-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${(ok / total) * 100}%` }} />
            <div className="h-full bg-red-400 transition-[width] duration-700" style={{ width: `${(mal / total) * 100}%` }} />
          </>
        )}
      </div>
    </div>
  );
}

function TarjetaRuta({ ruta, onEliminar }: { ruta: RutaListItem; onEliminar?: () => void }) {
  const nombre = ruta.nombre || "(sin nombre)";
  const peso = ruta.peso_total ?? 0;
  return (
    <SpotlightCard className="group relative flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-asfalto-900 text-movii-500">
            <Route className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            {/* El enlace del título cubre toda la tarjeta (after:inset-0); las acciones quedan por encima. */}
            <h3 title={nombre} className="font-expandida line-clamp-2 break-words text-base font-extrabold leading-snug text-gray-900">
              <Link to={`/rutas/${ruta.id}`} className="after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:outline-none group-focus-within:underline">
                {nombre}
              </Link>
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <EstadoRutaBadge estado={ruta.estado} />
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {ruta.zona || "Sin zona"}
              </span>
            </div>
          </div>
          <MenuAcciones
            nombre={nombre}
            className="-mr-2 -mt-1"
            acciones={[
              { etiqueta: "Ver detalle", icono: Eye, to: `/rutas/${ruta.id}` },
              { etiqueta: "Ver en el mapa", icono: MapPinned, to: `/rutas/${ruta.id}/mapa` },
              { etiqueta: "Vista 3D", icono: Box, to: `/rutas/${ruta.id}/3d` },
              { etiqueta: "Eliminar ruta", icono: Trash2, peligro: true, oculta: !onEliminar, onClick: onEliminar },
            ]}
          />
        </div>

        <Avance ruta={ruta} />

        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-hormigon-50 px-1 py-2">
            <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
              <Package className="h-3 w-3" aria-hidden />
              Envíos
            </dt>
            <dd className="font-expandida text-lg font-black text-gray-900">{ruta.cantidad_envios}</dd>
          </div>
          <div className="rounded-xl bg-hormigon-50 px-1 py-2">
            <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
              <Weight className="h-3 w-3" aria-hidden />
              Carga
            </dt>
            <dd className="font-expandida text-lg font-black text-gray-900">
              {peso >= 100 ? Math.round(peso) : peso.toFixed(1).replace(".", ",").replace(",0", "")}
              <span className="text-xs font-semibold text-gray-400"> kg</span>
            </dd>
          </div>
          <div className="rounded-xl bg-hormigon-50 px-1 py-2">
            <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
              <Truck className="h-3 w-3" aria-hidden />
              Vehículo
            </dt>
            <dd className={`truncate px-1 text-sm font-bold leading-7 ${ruta.vehiculo_patente ? "text-gray-900" : "text-gray-400"}`}>{ruta.vehiculo_patente || "Sin asignar"}</dd>
          </div>
        </dl>

        <div className="mt-auto flex items-center gap-3 border-t border-hormigon-100 pt-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-movii-500 text-sm font-bold text-movii-900">
            {(ruta.repartidor_nombre ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">Repartidor</p>
            <p className="truncate text-sm font-medium text-gray-900">{ruta.repartidor_nombre ?? "Sin asignar"}</p>
          </div>
          <Link
            to={`/rutas/${ruta.id}/mapa`}
            className="relative z-10 inline-flex items-center gap-1.5 rounded-xl border border-hormigon-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-hormigon-300 hover:bg-hormigon-50 hover:text-gray-900"
          >
            <MapPinned className="h-3.5 w-3.5" aria-hidden />
            Mapa
          </Link>
        </div>
      </div>
    </SpotlightCard>
  );
}

export function RutasListPage() {
  const navigate = useNavigate();
  const puedeEliminar = usePuedeEliminar();
  const [fecha, setFecha] = useState("");
  const [pestana, setPestana] = useState<Pestana>("hoy");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [repartidor, setRepartidor] = useState("");
  const [diasVisibles, setDiasVisibles] = useState(DIAS_INICIALES);
  const [aEliminar, setAEliminar] = useState<RutaListItem | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["rutas", { fecha }],
    queryFn: () => listarRutas({ fecha: fecha || undefined }),
    placeholderData: keepPreviousData,
  });
  const repartidores = useQuery({ queryKey: ["repartidores"], queryFn: listarRepartidores });

  const hoy = hoyISO();
  const filtradas = useMemo(() => (data ? filtrarRutas(data, { busqueda, estado, repartidor }) : []), [data, busqueda, estado, repartidor]);
  const conteo = useMemo(
    () => ({
      hoy: filtradas.filter((r) => r.fecha === hoy).length,
      proximas: filtradas.filter((r) => r.fecha > hoy).length,
      anteriores: filtradas.filter((r) => r.fecha < hoy).length,
      todas: filtradas.length,
    }),
    [filtradas, hoy],
  );

  // Con una fecha elegida, las pestañas no aplican: se ve ese día.
  const visibles = fecha
    ? filtradas
    : filtradas.filter((r) => (pestana === "hoy" ? r.fecha === hoy : pestana === "proximas" ? r.fecha > hoy : pestana === "anteriores" ? r.fecha < hoy : true));
  const grupos = agruparPorDia(visibles, !fecha && (pestana === "anteriores" || pestana === "todas"));
  const gruposMostrados = grupos.slice(0, diasVisibles);

  const cambiarPestana = (p: Pestana) => {
    setPestana(p);
    setDiasVisibles(DIAS_INICIALES);
  };

  const PESTANAS: Array<{ id: Pestana; texto: string }> = [
    { id: "hoy", texto: "Hoy" },
    { id: "proximas", texto: "Próximas" },
    { id: "anteriores", texto: "Anteriores" },
    { id: "todas", texto: "Todas" },
  ];

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        title="Rutas"
        icon={Route}
        description="Rutas de reparto por día: avance de las entregas, repartidor y vehículo."
        action={
          <Button type="button" onClick={() => navigate("/rutas/nueva")}>
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Nueva ruta
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Período" className={`flex max-w-full overflow-x-auto rounded-2xl bg-hormigon-100 p-1 ${fecha ? "opacity-50" : ""}`}>
          {PESTANAS.map((p) => {
            const activa = !fecha && pestana === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => {
                  setFecha("");
                  cambiarPestana(p.id);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors sm:px-3.5 ${
                  activa ? "bg-white text-gray-900 shadow-panel" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {p.texto}
                <span className={`tabular rounded-full px-1.5 text-[11px] ${activa ? "bg-movii-500 text-movii-900" : "bg-hormigon-200 text-gray-600"}`}>{conteo[p.id]}</span>
              </button>
            );
          })}
        </div>
        <DatePicker aria-label="Ir a una fecha" value={fecha} onChange={setFecha} limpiable placeholder="Ir a una fecha…" className="w-52" />
      </div>

      <BarraFiltros
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por nombre, zona o repartidor"
        hayFiltros={Boolean(busqueda || estado || repartidor || fecha)}
        onLimpiar={() => {
          setBusqueda("");
          setEstado("");
          setRepartidor("");
          setFecha("");
        }}
        resumen={data ? `${visibles.length} ${visibles.length === 1 ? "ruta" : "rutas"}` : undefined}
      >
        <FiltroSelect label="Estado" value={estado} onChange={setEstado}>
          <option value="">Todos</option>
          {ESTADOS_RUTA.map((e) => (
            <option key={e} value={e}>
              {e === "en_curso" ? "En curso" : e.charAt(0).toUpperCase() + e.slice(1)}
            </option>
          ))}
        </FiltroSelect>
        <FiltroSelect label="Repartidor" value={repartidor} onChange={setRepartidor}>
          <option value="">Todos</option>
          {(repartidores.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </FiltroSelect>
      </BarraFiltros>

      {isLoading && <SkeletonTarjetas label="Cargando rutas…" />}
      {isError && <Alert variant="error">{getApiErrorMessage(error, "No se pudieron cargar las rutas")}</Alert>}
      {data && visibles.length === 0 && (
        <EmptyState
          title={fecha ? "No hay rutas ese día" : pestana === "hoy" ? "No hay rutas para hoy" : pestana === "proximas" ? "No hay rutas planificadas" : "No hay rutas que coincidan"}
          description={busqueda || estado || repartidor ? "Probá con otros filtros." : "Creá una ruta y asignale envíos y un repartidor."}
        />
      )}

      {gruposMostrados.map(([dia, rutas]) => {
        const t = tituloDia(dia, hoy);
        const envios = rutas.reduce((s, r) => s + r.cantidad_envios, 0);
        return (
          <section key={dia} aria-label={`${t.titulo} ${t.detalle}`} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-2 border-b border-hormigon-200 pb-2">
              <h2 className="font-expandida text-lg font-extrabold text-gray-900">{t.titulo}</h2>
              {t.detalle && <span className="text-sm text-gray-500">{t.detalle}</span>}
              <span className="ml-auto text-xs text-gray-500">
                {rutas.length} {rutas.length === 1 ? "ruta" : "rutas"} · {envios} {envios === 1 ? "envío" : "envíos"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rutas.map((ruta) => (
                <TarjetaRuta key={ruta.id} ruta={ruta} onEliminar={puedeEliminar ? () => setAEliminar(ruta) : undefined} />
              ))}
            </div>
          </section>
        );
      })}

      {grupos.length > gruposMostrados.length && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={() => setDiasVisibles((n) => n + DIAS_INICIALES)}>
            Mostrar más días ({grupos.length - gruposMostrados.length} restantes)
          </Button>
        </div>
      )}

      {aEliminar && (
        <DialogoEliminar
          nombre={aEliminar.nombre || "(sin nombre)"}
          eliminar={() => eliminarRuta(aEliminar.id)}
          invalidar={[["rutas"], ["envios"]]}
          onCerrar={() => setAEliminar(null)}
        />
      )}
    </div>
  );
}
