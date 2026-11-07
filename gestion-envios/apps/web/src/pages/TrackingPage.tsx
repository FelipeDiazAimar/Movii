import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CircleCheck,
  Clock,
  Copy,
  Gauge,
  MapPin,
  Package,
  PackageCheck,
  Route,
  Search,
  Share2,
  Sparkles,
  Truck,
  Weight,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { obtenerTracking } from "@/features/envios/api";
import { trackingCodigoSchema } from "@/features/envios/schema";
import { HistorialTimeline } from "@/features/envios/HistorialTimeline";
import type { TrackingEnVivo, TrackingResponse } from "@/features/envios/types";
import { MapaMovii } from "@/features/flota/MapaMovii";
import { VehiculoIllustration } from "@/features/flota/VehiculoIllustration";
import { esHex } from "@/features/flota/colores";
import { ETIQUETA_TIPO_VEHICULO, type LatLng } from "@/features/flota/types";
import { getApiErrorMessage } from "@/services/api-client";
import { useBordesNavegador } from "@/hooks/useBordesNavegador";
import { Spinner } from "@/components/ui/Spinner";
import { hayWebGL } from "@/features/mapas/webgl";

// La vista 3D (MapLibre) pesa: se baja solo si la persona la elige.
const Seguimiento3D = lazy(() => import("@/features/mapas/Seguimiento3D").then((m) => ({ default: m.Seguimiento3D })));

const PASOS = [
  { clave: "pendiente", titulo: "Registrado", icono: Package },
  { clave: "asignado", titulo: "Preparado", icono: Route },
  { clave: "en_camino", titulo: "En camino", icono: Truck },
  { clave: "entregado", titulo: "Entregado", icono: PackageCheck },
] as const;

const INDICE_PASO: Record<string, number> = { pendiente: 0, asignado: 1, en_camino: 2, entregado: 3, no_entregado: 2 };

const FRANJAS: Record<string, string> = { manana: "por la mañana", tarde: "por la tarde", noche: "por la noche" };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function hora(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "hoy", "mañana" o "el lunes 9 de noviembre". */
function diaRelativo(ymd?: string) {
  const m = ymd ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd) : null;
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dif = Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
  if (dif === 0) return "hoy";
  if (dif === 1) return "mañana";
  if (dif === -1) return "ayer";
  return `el ${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function haceCuanto(iso: string, ahora: number) {
  const s = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (s < 60) return "hace instantes";
  const m = Math.round(s / 60);
  return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
}

/** Reloj que se actualiza cada segundo (para "hace X" y la cuenta regresiva). */
function useAhora() {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

function Encabezado({ data, ahora }: { data: TrackingResponse; ahora: number }) {
  const vivo = data.en_vivo;
  const dia = diaRelativo(data.fecha_entrega);
  const franja = data.franja ? FRANJAS[data.franja] : "";
  const ultimo = data.historial[data.historial.length - 1];

  let eyebrow = "";
  let titulo: ReactNode = "";
  let detalle: ReactNode = null;

  if (data.estado === "entregado") {
    eyebrow = "Entregado";
    titulo = <>¡Tu paquete llegó!</>;
    detalle = data.entregado_en ? <>Lo entregamos {diaRelativo(data.entregado_en.slice(0, 10))} a las {hora(data.entregado_en)}.</> : "Ya está en destino.";
  } else if (data.estado === "no_entregado") {
    eyebrow = "No pudimos entregarlo";
    titulo = <>Intentamos entregarlo</>;
    detalle = <>{ultimo?.descripcion ?? "La visita no pudo completarse"}. Vamos a coordinar una nueva visita.</>;
  } else if (vivo?.eta_desde && vivo.eta_hasta) {
    const minutos = Math.max(1, Math.round(((new Date(vivo.eta_desde).getTime() + new Date(vivo.eta_hasta).getTime()) / 2 - ahora) / 60_000));
    eyebrow = data.estado === "en_camino" ? "En camino a tu domicilio" : "Sale hoy a reparto";
    titulo = (
      <>
        Llega entre <span className="text-movii-500">{hora(vivo.eta_desde)}</span> y <span className="text-movii-500">{hora(vivo.eta_hasta)}</span>
      </>
    );
    detalle = (
      <>
        Aproximadamente en <b className="text-white">{minutos} min</b>
        {vivo.paradas_antes > 0 ? <>, después de {vivo.paradas_antes} {vivo.paradas_antes === 1 ? "parada" : "paradas"}</> : <>: sos la próxima parada</>}.
      </>
    );
  } else if (data.estado === "pendiente") {
    eyebrow = "Preparando tu envío";
    titulo = dia ? <>Llega {dia}</> : <>Estamos preparando tu envío</>;
    detalle = franja ? <>Entrega estimada {franja}.</> : <>Te avisamos cuando salga a reparto.</>;
  } else {
    eyebrow = data.estado === "en_camino" ? "En camino" : "Listo para salir";
    titulo = dia ? <>Llega {dia}</> : <>Ya está en una ruta de reparto</>;
    detalle = franja ? <>Entrega estimada {franja}.</> : <>Cuando el vehículo salga vas a ver su posición acá.</>;
  }

  const Icono = data.estado === "entregado" ? CircleCheck : data.estado === "no_entregado" ? AlertTriangle : vivo ? Truck : CalendarDays;
  const tono = data.estado === "entregado" ? "bg-green-500 text-white" : data.estado === "no_entregado" ? "bg-red-500 text-white" : "bg-movii-500 text-asfalto-900";

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,#262626,#161616)] p-6 text-white shadow-lift sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-movii-500/20 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tono} shadow-lift`}>
          <Icono className="h-7 w-7" strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-movii-500">
            {vivo && data.estado !== "entregado" && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-movii-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-movii-500" />
              </span>
            )}
            {eyebrow}
          </p>
          <h2 className="font-expandida mt-1 text-2xl font-black leading-tight sm:text-4xl">{titulo}</h2>
          {detalle && <p className="mt-2 text-sm text-gray-300 sm:text-base">{detalle}</p>}
        </div>
      </div>
      <Pasos estado={data.estado} />
      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-gray-400">
        <span className="font-mono tracking-wider text-gray-300">{data.codigo_guia}</span>
        <span>Actualizado {haceCuanto(data.actualizado_en, ahora)}</span>
      </div>
    </section>
  );
}

/** Línea de progreso con el camión avanzando hasta el paso actual. */
function Pasos({ estado }: { estado: string }) {
  const actual = INDICE_PASO[estado] ?? 0;
  const fallo = estado === "no_entregado";
  const [lleno, setLleno] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setLleno(actual / (PASOS.length - 1)), 120);
    return () => clearTimeout(t);
  }, [actual]);

  return (
    <div className="relative mt-7 px-4">
      <div className="absolute left-[calc(1rem+18px)] right-[calc(1rem+18px)] top-[18px] h-1.5 rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-[1400ms] ease-out ${fallo ? "bg-red-500" : "bg-[repeating-linear-gradient(90deg,#f4b400_0_14px,#ffd452_14px_22px)] animate-carril"}`}
          style={{ width: `${lleno * 100}%` }}
        />
      </div>
      <ol className="relative flex justify-between">
        {PASOS.map((p, i) => {
          const hecho = i < actual || (i === actual && estado === "entregado");
          const activo = i === actual && estado !== "entregado";
          const Icono = p.icono;
          return (
            <li key={p.clave} className="flex w-16 flex-col items-center gap-2 text-center">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                  hecho
                    ? "border-movii-500 bg-movii-500 text-asfalto-900"
                    : activo
                      ? fallo
                        ? "border-red-500 bg-red-500 text-white"
                        : "scale-110 border-movii-500 bg-asfalto-900 text-movii-500 shadow-[0_0_0_6px_rgba(244,180,0,0.18)]"
                      : "border-white/15 bg-asfalto-800 text-gray-500"
                }`}
                style={{ transitionDelay: `${i * 250}ms` }}
              >
                {hecho ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : <Icono className="h-4 w-4" aria-hidden />}
              </span>
              <span className={`text-[11px] font-semibold leading-tight ${hecho || activo ? "text-white" : "text-gray-500"}`}>
                {fallo && activo ? "Visita fallida" : p.titulo}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Dato({ icono: Icono, etiqueta, valor }: { icono: LucideIcon; etiqueta: string; valor: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-hormigon-50 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-movii-700 shadow-panel">
        <Icono className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{etiqueta}</p>
        <p className="break-words text-sm font-bold leading-snug text-gray-900">{valor}</p>
      </div>
    </div>
  );
}

function MapaEnVivo({ vivo }: { vivo: TrackingEnVivo }) {
  const [vista, setVista] = useState<"2d" | "3d">("2d");
  const con3D = typeof window !== "undefined" && hayWebGL();
  const color = esHex(vivo.vehiculo.color) ? vivo.vehiculo.color : "#f4b400";
  const destino = vivo.destino ? ([vivo.destino.lat, vivo.destino.lng] as LatLng) : undefined;
  const geometria = (vivo.recorrido?.geometria ?? []) as LatLng[];
  const km = vivo.recorrido && vivo.recorrido.distancia_m >= 100 ? (vivo.recorrido.distancia_m / 1000).toFixed(1).replace(".", ",") : null;
  return (
    <section className="overflow-hidden rounded-[28px] border border-hormigon-200 bg-white shadow-panel">
      <div className="flex items-center justify-between gap-3 border-b border-hormigon-100 px-4 py-3">
        <div>
          <h2 className="font-expandida text-base font-black text-gray-900">Seguí tu pedido en vivo</h2>
          <p className="text-xs text-gray-500">La posición del vehículo se actualiza sola.</p>
        </div>
        {con3D && (
          <div className="flex rounded-xl bg-hormigon-100 p-1 text-xs font-bold" role="radiogroup" aria-label="Tipo de mapa">
            {(["2d", "3d"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={vista === v}
                onClick={() => setVista(v)}
                className={`rounded-lg px-3 py-1.5 transition ${vista === v ? "bg-asfalto-900 text-movii-500 shadow-panel" : "text-gray-500 hover:text-gray-900"}`}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      {vista === "3d" ? (
        <div className="p-2">
          <Suspense fallback={<div className="flex h-[26rem] items-center justify-center"><Spinner label="Cargando vista 3D…" /></div>}>
            <Seguimiento3D vivo={vivo} />
          </Suspense>
        </div>
      ) : (
      <div className="relative">
        <MapaMovii
          className="h-[22rem] rounded-none border-0 sm:h-[26rem]"
          vehiculos={[{ id: "v", patente: vivo.vehiculo.patente, pos: [vivo.vehiculo.lat, vivo.vehiculo.lng], rumbo: vivo.vehiculo.rumbo, velocidad: vivo.vehiculo.velocidad, destacado: true, color }]}
          rutas={geometria.length > 1 ? [{ id: "r", nombre: "Hacia tu domicilio", color, geometria, destacada: true, destino, destinoTexto: "Tu zona (ubicación aproximada)" }] : []}
          paradas={geometria.length > 1 || !destino ? [] : [{ id: "d", orden: 1, estado: "asignado", pos: destino, titulo: "Tu zona", detalle: "Ubicación aproximada", destacada: true }]}
          encuadre={`${vivo.vehiculo.lat.toFixed(3)}-${vivo.destino?.lat}`}
        />
        <div className="pointer-events-none absolute right-3 top-3 z-[500] flex flex-wrap justify-end gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-asfalto-900/90 px-3 py-1.5 text-xs font-bold text-white shadow-lift backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            En vivo
          </span>
          {km && (
            <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-gray-900 shadow-lift">
              {km} km de recorrido
            </span>
          )}
        </div>
      </div>
      )}
      <p className="flex items-center gap-1.5 px-4 py-3 text-xs text-gray-500">
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        Por tu privacidad mostramos tu zona de forma aproximada.
      </p>
    </section>
  );
}

function TarjetaVehiculo({ vivo, ahora }: { vivo: TrackingEnVivo; ahora: number }) {
  const v = vivo.vehiculo;
  return (
    <section className="overflow-hidden rounded-[28px] border border-hormigon-200 bg-white shadow-panel md:grid md:grid-cols-[1.25fr_1fr]">
      <div className="bg-[radial-gradient(120%_100%_at_70%_0%,#ffffff_0%,#f1f3f5_60%,#e4e7ea_100%)] px-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Tu paquete viaja en</p>
            <p className="font-expandida text-xl font-black text-gray-900">{ETIQUETA_TIPO_VEHICULO[v.tipo] ?? "Vehículo"} {v.modelo}</p>
          </div>
          <span className="rounded-lg bg-asfalto-900 px-2.5 py-1 font-mono text-xs font-bold tracking-widest text-movii-500">{v.patente}</span>
        </div>
        <VehiculoIllustration tipo={v.tipo} color={esHex(v.color) ? v.color : "#f4b400"} containerCode={v.patente} className="mx-auto -mb-2 max-w-md" />
      </div>
      <div className="grid grid-cols-1 content-center gap-2 p-4 sm:grid-cols-3 md:grid-cols-1">
        <Dato icono={Gauge} etiqueta="Velocidad" valor={`${Math.round(v.velocidad)} km/h`} />
        <Dato icono={Route} etiqueta="Paradas antes" valor={vivo.paradas_antes === 0 ? "Sos la próxima" : vivo.paradas_antes} />
        <Dato icono={Clock} etiqueta="Posición" valor={haceCuanto(v.en, ahora)} />
      </div>
    </section>
  );
}

function TarjetaPaquete({ data }: { data: TrackingResponse }) {
  const p = data.paquete;
  return (
    <section className="rounded-[28px] border border-hormigon-200 bg-white p-5 shadow-panel">
      <h2 className="font-expandida mb-3 text-base font-black text-gray-900">Tu envío</h2>
      <div className="grid grid-cols-2 gap-2">
        <Dato icono={MapPin} etiqueta="Destino" valor={data.localidad} />
        <Dato icono={CalendarDays} etiqueta="Entrega" valor={data.fecha_entrega ? diaRelativo(data.fecha_entrega).replace(/^el /, "") : "A confirmar"} />
        {data.franja && <Dato icono={Clock} etiqueta="Franja" valor={FRANJAS[data.franja]?.replace("por la ", "") ?? data.franja} />}
        {p && <Dato icono={Weight} etiqueta="Peso" valor={`${p.peso} kg`} />}
        {p && <Dato icono={Package} etiqueta="Tamaño" valor={p.tamano.charAt(0).toUpperCase() + p.tamano.slice(1)} />}
      </div>
      {p && (p.fragil || p.urgente) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {p.fragil && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
              <Wine className="h-3.5 w-3.5" aria-hidden /> Frágil: lo manejamos con cuidado
            </span>
          )}
          {p.urgente && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">
              <Zap className="h-3.5 w-3.5" aria-hidden /> Urgente
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function Compartir({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/tracking/${codigo}` : "";
  async function compartir() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Seguí mi envío Movii", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* el usuario canceló */
    }
  }
  const Icono = copiado ? Check : typeof navigator !== "undefined" && "share" in navigator ? Share2 : Copy;
  return (
    <button
      type="button"
      onClick={compartir}
      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
    >
      <Icono className="h-4 w-4" aria-hidden />
      {copiado ? "Link copiado" : "Compartir seguimiento"}
    </button>
  );
}

export function TrackingPage() {
  const { codigo: codigoUrl } = useParams();
  const navigate = useNavigate();
  // Página oscura: las barras del navegador del celular, también oscuras.
  useBordesNavegador("#1a1a1a");
  const ahora = useAhora();
  const [codigo, setCodigo] = useState(codigoUrl ?? "");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [buscado, setBuscado] = useState<string | null>(() => {
    const parsed = trackingCodigoSchema.safeParse(codigoUrl ?? "");
    return parsed.success ? parsed.data : null;
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["tracking", buscado],
    queryFn: () => obtenerTracking(buscado as string),
    enabled: buscado !== null,
    retry: false,
    // Mientras está en reparto, la posición y la hora estimada se refrescan solas.
    refetchInterval: (q) => (q.state.data?.en_vivo ? 8_000 : 60_000),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = trackingCodigoSchema.safeParse(codigo);
    if (!parsed.success) {
      setErrorLocal(parsed.error.issues[0]?.message ?? "Código inválido");
      return;
    }
    setErrorLocal(null);
    setBuscado(parsed.data);
    navigate(`/tracking/${parsed.data}`, { replace: true });
  }

  function rastrearOtro() {
    setBuscado(null);
    setCodigo("");
    setErrorLocal(null);
    navigate("/tracking", { replace: true });
  }

  const conResultado = buscado !== null && !isLoading && !isError && data;

  return (
    <div className="pt-safe pb-safe min-h-screen bg-asfalto-900 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(244,180,0,0.16),transparent_70%)] px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Link to="/tracking" onClick={rastrearOtro} className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-movii-500 text-2xl font-light leading-none text-asfalto-900">›</span>
            <span className="font-expandida text-2xl font-black text-white">movii</span>
          </Link>
          {conResultado && <Compartir codigo={data.codigo_guia} />}
        </header>

        {!conResultado && (
          <div className="mb-6 text-center">
            <h1 className="font-expandida text-3xl font-black text-white sm:text-4xl">Rastreá tu envío</h1>
            <p className="mt-2 text-sm text-gray-400">Ingresá el código de guía para ver dónde está tu paquete y cuándo llega.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mb-6" noValidate>
          <div className={`flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-lift ring-2 ${errorLocal ? "ring-red-400" : "ring-transparent focus-within:ring-movii-500"}`}>
            <Search className="ml-2.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden />
            <label htmlFor="codigo" className="sr-only">
              Código de guía
            </label>
            <input
              id="codigo"
              name="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="MOV-20260909-0001"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-sm uppercase tracking-wider text-gray-900 outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400"
            />
            <button type="submit" className="rounded-xl bg-movii-500 px-5 py-2.5 text-sm font-bold text-asfalto-900 transition hover:bg-movii-400 disabled:opacity-60" disabled={isLoading && buscado !== null}>
              {isLoading && buscado !== null ? "Buscando…" : "Rastrear"}
            </button>
          </div>
          {errorLocal && (
            <p className="mt-2 text-sm text-red-300" role="alert">
              {errorLocal}
            </p>
          )}
        </form>

        {buscado === null && (
          <div className="grid gap-3 text-center sm:grid-cols-3">
            {[
              { i: Sparkles, t: "Estado al instante", d: "Cada cambio de tu envío, apenas pasa." },
              { i: Truck, t: "Vehículo en vivo", d: "El día de entrega, mirá por dónde viene." },
              { i: Clock, t: "Hora estimada", d: "Una ventana de llegada que se ajusta sola." },
            ].map(({ i: I, t, d }) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <I className="mx-auto h-6 w-6 text-movii-500" aria-hidden />
                <p className="mt-2 text-sm font-bold text-white">{t}</p>
                <p className="mt-1 text-xs text-gray-400">{d}</p>
              </div>
            ))}
          </div>
        )}

        {buscado !== null && isLoading && (
          <div className="rounded-[28px] bg-white p-10">
            <Spinner label="Buscando envío…" />
          </div>
        )}

        {buscado !== null && !isLoading && isError && (
          <div className="rounded-[28px] border border-red-400/30 bg-red-500/10 p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-300" aria-hidden />
            <p className="mt-2 font-bold text-white">{getApiErrorMessage(error, "No se encontró ningún envío con ese código")}</p>
            <p className="mt-1 text-sm text-gray-400">Revisá que el código esté completo, con los guiones.</p>
          </div>
        )}

        {conResultado && (
          <div className="flex flex-col gap-4">
            <Encabezado data={data} ahora={ahora} />
            {data.en_vivo && <MapaEnVivo vivo={data.en_vivo} />}
            {data.en_vivo && <TarjetaVehiculo vivo={data.en_vivo} ahora={ahora} />}
            <div className="grid gap-4 md:grid-cols-2">
              <TarjetaPaquete data={data} />
              <section className="rounded-[28px] border border-hormigon-200 bg-white p-5 shadow-panel">
                <h2 className="font-expandida mb-3 text-base font-black text-gray-900">Historial</h2>
                <HistorialTimeline eventos={data.historial} />
              </section>
            </div>
            <button type="button" onClick={rastrearOtro} className="self-center text-sm text-gray-400 hover:text-white hover:underline">
              Rastrear otro envío
            </button>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-gray-500">
          <Link to="/login" className="hover:underline">
            Acceso para operadores
          </Link>
        </p>
      </div>
    </div>
  );
}
