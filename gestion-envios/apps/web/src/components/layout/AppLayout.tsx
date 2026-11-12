import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Sun,
  Truck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBordesNavegador } from "@/hooks/useBordesNavegador";
import { useTema, type Tema } from "@/hooks/useTema";

type Rol = "operador" | "admin";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Rol[];
}

interface Grupo {
  titulo: string;
  items: NavItem[];
}

const GRUPOS: Grupo[] = [
  {
    titulo: "Operación",
    items: [
      { to: "/operaciones", label: "Operaciones", icon: LayoutDashboard },
      { to: "/envios", label: "Envíos", icon: Package },
      { to: "/rutas", label: "Rutas", icon: Route },
      { to: "/vehiculos", label: "Vehículos", icon: Truck },
      { to: "/repartidores", label: "Repartidores", icon: UserRound },
    ],
  },
  { titulo: "Análisis", items: [{ to: "/reportes", label: "Reportes", icon: BarChart3 }] },
  {
    titulo: "Administración",
    items: [
      { to: "/usuarios", label: "Usuarios", icon: Users, roles: ["admin"] },
      { to: "/configuracion/whatsapp", label: "WhatsApp", icon: MessageCircle, roles: ["admin"] },
    ],
  },
];

const CLAVE_COLAPSADO = "movii.web.sidebar";

function leerColapsado(): boolean {
  try {
    // Solo el "0" explícito deja el menú fijado expandido; sin nada
    // guardado arranca contraído como riel.
    return localStorage.getItem(CLAVE_COLAPSADO) !== "0";
  } catch {
    return true;
  }
}

function Marca({ compacta }: { compacta: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-movii-500 text-movii-900 shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
      {!compacta && <span className="font-expandida text-xl font-black tracking-tight text-white claro:text-gray-900">movii</span>}
    </div>
  );
}

function Navegacion({ compacta, rol, alNavegar }: { compacta: boolean; rol: Rol; alNavegar?: () => void }) {
  return (
    <nav className="scroll-oscuro flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2" aria-label="Secciones">
      {GRUPOS.map((g) => {
        const items = g.items.filter((i) => !i.roles || i.roles.includes(rol));
        if (items.length === 0) return null;
        return (
          <div key={g.titulo}>
            {!compacta && <p className="mb-2 px-3 text-xs font-medium text-white/40 claro:text-gray-400">{g.titulo}</p>}
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={alNavegar}
                    title={compacta ? item.label : undefined}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-white/[0.08] text-white claro:bg-hormigon-100 claro:text-gray-900"
                          : "text-white/60 hover:bg-white/[0.05] hover:text-white claro:text-gray-500 claro:hover:bg-hormigon-100 claro:hover:text-gray-900"
                      } ${compacta ? "justify-center" : ""}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Línea de carril: el marcador del ítem activo. */}
                        <span
                          aria-hidden
                          className={`absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`}
                          style={{ backgroundImage: "linear-gradient(to bottom, #f4b400 0 60%, transparent 60% 100%)", backgroundSize: "3px 8px" }}
                        />
                        <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-movii-500 claro:text-movii-600" : ""}`} strokeWidth={2} aria-hidden />
                        {!compacta && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function BotonTema({ tema, onTema, compacto = false }: { tema: Tema; onTema: () => void; compacto?: boolean }) {
  const aClaro = tema === "oscuro";
  const etiqueta = aClaro ? "Modo claro" : "Modo oscuro";
  const Icono = aClaro ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={onTema}
      title={etiqueta}
      aria-label={etiqueta}
      className={
        compacto
          ? "flex h-9 w-9 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white claro:text-gray-500 claro:hover:bg-hormigon-100 claro:hover:text-gray-900"
          : "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white claro:text-gray-500 claro:hover:bg-hormigon-100 claro:hover:text-gray-900"
      }
    >
      <Icono className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!compacto && etiqueta}
    </button>
  );
}

function PieUsuario({
  expandida,
  fijada,
  mostrarFijar,
  email,
  rol,
  onLogout,
  onAlternar,
  tema,
  onTema,
}: {
  expandida: boolean;
  fijada: boolean;
  mostrarFijar: boolean;
  email: string;
  rol: string;
  onLogout: () => void;
  onAlternar?: () => void;
  tema: Tema;
  onTema: () => void;
}) {
  // La sesión restaurada puede no traer el email: se muestra el rol.
  const nombre = email || (rol === "admin" ? "Admin" : "Operador");
  const inicial = nombre.slice(0, 1).toUpperCase();

  // Riel contraído: abajo va solo el botón de expandir/fijar, sin "Cerrar sesión".
  if (!expandida) {
    return (
      <div className="flex flex-col items-center gap-1 border-t border-white/10 p-3 claro:border-hormigon-200">
        <button
          type="button"
          onClick={onAlternar}
          title="Expandir menú"
          aria-label="Expandir menú"
          aria-expanded={false}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white claro:text-gray-500 claro:hover:bg-hormigon-100 claro:hover:text-gray-900"
        >
          <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
        </button>
        <BotonTema tema={tema} onTema={onTema} compacto />
      </div>
    );
  }

  const etiquetaFijar = fijada ? "Contraer menú" : "Fijar menú";
  const IconoFijar = fijada ? PanelLeftClose : PanelLeftOpen;
  return (
    <div className="border-t border-white/10 p-3 claro:border-hormigon-200">
      {mostrarFijar && (
        <button
          type="button"
          onClick={onAlternar}
          title={etiquetaFijar}
          aria-label={etiquetaFijar}
          aria-expanded={fijada}
          className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-white/40 transition-colors hover:text-white claro:text-gray-400 claro:hover:text-gray-900"
        >
          <IconoFijar className="h-4 w-4 shrink-0" aria-hidden />
          {etiquetaFijar}
        </button>
      )}
      <a
        href={import.meta.env.VITE_REPARTIDOR_URL ?? "/app/"}
        target="_blank"
        rel="noreferrer"
        className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white claro:text-gray-500 claro:hover:bg-hormigon-100 claro:hover:text-gray-900"
      >
        <ExternalLink className="h-[18px] w-[18px] shrink-0" aria-hidden />
        Panel del repartidor
      </a>
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5 claro:bg-hormigon-100">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-movii-500 text-sm font-bold text-movii-900">{inicial}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white claro:text-gray-900">{nombre}</p>
          <p className="text-xs capitalize text-white/50 claro:text-gray-500">{rol}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Cerrar sesión"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white claro:text-gray-500 claro:hover:bg-white claro:hover:text-gray-900"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span className="sr-only">Cerrar sesión</span>
        </button>
      </div>
      <div className="mt-2 border-t border-white/10 pt-2 claro:border-hormigon-200">
        <BotonTema tema={tema} onTema={onTema} />
      </div>
    </div>
  );
}

export function AppLayout() {
  const { sesion, logout } = useAuth();
  const [compacta, setCompacta] = useState(leerColapsado);
  const [abierto, setAbierto] = useState(false);
  // Apertura transitoria por hover/foco con el menú contraído (estilo Zen):
  // el panel flota por encima del contenido sin mover la página.
  const [flotante, setFlotante] = useState(false);
  const temporizadorCierre = useRef<number | undefined>(undefined);
  const location = useLocation();
  const { tema, alternar: alternarTema } = useTema();
  // Barra de estado del celular = barra superior (oscura, o blanca en modo claro); abajo = fondo de trabajo (gris, o blanco en modo claro).
  useBordesNavegador(tema === "claro" ? "#ffffff" : "#1a1a1a", tema === "claro" ? "#ffffff" : "#eef0f2");

  useEffect(() => setAbierto(false), [location.pathname]);
  useEffect(() => () => window.clearTimeout(temporizadorCierre.current), []);

  if (!sesion) return null;
  const rol = sesion.rol as Rol;
  const expandida = !compacta || flotante;
  const compactaVisual = !expandida;

  function cancelarCierre() {
    window.clearTimeout(temporizadorCierre.current);
    temporizadorCierre.current = undefined;
  }

  function abrirFlotante() {
    if (!compacta) return;
    cancelarCierre();
    setFlotante(true);
  }

  function programarCierreFlotante() {
    if (!compacta) return;
    cancelarCierre();
    // Demora corta para que no parpadee si el cursor sale un instante.
    temporizadorCierre.current = window.setTimeout(() => setFlotante(false), 250);
  }

  function alternar() {
    cancelarCierre();
    setFlotante(false);
    setCompacta((c) => {
      try {
        localStorage.setItem(CLAVE_COLAPSADO, c ? "0" : "1");
      } catch {
        // sin almacenamiento: solo dura esta sesión
      }
      return !c;
    });
  }

  return (
    <div className="flex min-h-screen bg-hormigon-100 claro:bg-white">
      {/* Sidebar de escritorio. El contenedor reserva el lugar en el layout (riel de
          84 px o menú fijado de w-64) para que el contenido no se re-acomode cuando
          el panel se abre por hover como overlay por encima de la página. */}
      <div className={`hidden shrink-0 lg:block ${compacta ? "w-[84px]" : "w-64"}`}>
        <aside
          data-testid="sidebar"
          onMouseEnter={abrirFlotante}
          onMouseLeave={programarCierreFlotante}
          onFocus={abrirFlotante}
          onBlur={(e) => {
            if (!compacta || e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            cancelarCierre();
            setFlotante(false);
          }}
          className={`h-screen flex-col bg-asfalto-900 claro:border-r claro:border-hormigon-200 claro:bg-white transition-[width] duration-300 ease-out motion-reduce:transition-none lg:flex ${
            flotante ? "fixed left-0 top-0 z-[1090] w-64 shadow-2xl" : "sticky top-0 w-full"
          }`}
        >
          <div className={`flex items-center px-5 pb-4 pt-6 ${compactaVisual ? "justify-center px-0" : "justify-between"}`}>
            <Marca compacta={compactaVisual} />
          </div>
          <Navegacion compacta={compactaVisual} rol={rol} />
          <PieUsuario
            expandida={expandida}
            fijada={!compacta}
            mostrarFijar
            email={sesion.email}
            rol={sesion.rol}
            onLogout={logout}
            onAlternar={alternar}
            tema={tema}
            onTema={alternarTema}
          />
        </aside>
      </div>
      {/* Zona de ~8 px en el borde izquierdo: con el menú contraído, acercar el
          cursor ahí expande el panel (estilo Zen). */}
      {compacta && !flotante && (
        <div aria-hidden data-testid="borde-expandir" onMouseEnter={abrirFlotante} className="fixed bottom-0 left-0 top-0 z-[1080] hidden w-2 lg:block" />
      )}

      {/* Menú lateral en celular */}
      {abierto && (
        <div className="fixed inset-0 z-[1090] lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAbierto(false)} />
          <aside className="pt-safe pb-safe relative flex h-full w-72 max-w-[85vw] flex-col bg-asfalto-900 shadow-2xl claro:bg-white">
            <div className="flex items-center justify-between px-5 pb-4 pt-5">
              <Marca compacta={false} />
              <button type="button" onClick={() => setAbierto(false)} className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white claro:text-gray-500 claro:hover:bg-hormigon-100 claro:hover:text-gray-900">
                <X className="h-5 w-5" aria-hidden />
                <span className="sr-only">Cerrar menú</span>
              </button>
            </div>
            <Navegacion compacta={false} rol={rol} alNavegar={() => setAbierto(false)} />
            <PieUsuario expandida fijada={false} mostrarFijar={false} email={sesion.email} rol={sesion.rol} onLogout={logout} tema={tema} onTema={alternarTema} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior solo en celular/tablet */}
        <header className="pt-safe sticky top-0 z-[1080] bg-asfalto-900 claro:border-b claro:border-hormigon-200 claro:bg-white lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button type="button" onClick={() => setAbierto(true)} className="rounded-xl p-2 text-white/80 hover:bg-white/10 claro:text-gray-700 claro:hover:bg-hormigon-100">
              <Menu className="h-5 w-5" aria-hidden />
              <span className="sr-only">Abrir menú</span>
            </button>
            <Marca compacta={false} />
            <span className="w-9" />
          </div>
        </header>

        <main className="pb-safe flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
