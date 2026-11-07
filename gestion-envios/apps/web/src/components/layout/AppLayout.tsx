import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Route,
  Truck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBordesNavegador } from "@/hooks/useBordesNavegador";

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
    return localStorage.getItem(CLAVE_COLAPSADO) === "1";
  } catch {
    return false;
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
      {!compacta && <span className="font-expandida text-xl font-black tracking-tight text-white">movii</span>}
    </div>
  );
}

function Navegacion({ compacta, rol, alNavegar }: { compacta: boolean; rol: Rol; alNavegar?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2" aria-label="Secciones">
      {GRUPOS.map((g) => {
        const items = g.items.filter((i) => !i.roles || i.roles.includes(rol));
        if (items.length === 0) return null;
        return (
          <div key={g.titulo}>
            {!compacta && <p className="mb-2 px-3 text-xs font-medium text-white/40">{g.titulo}</p>}
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={alNavegar}
                    title={compacta ? item.label : undefined}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive ? "bg-white/[0.08] text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white"
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
                        <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-movii-500" : ""}`} strokeWidth={2} aria-hidden />
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

function PieUsuario({ compacta, email, rol, onLogout }: { compacta: boolean; email: string; rol: string; onLogout: () => void }) {
  // La sesión restaurada puede no traer el email: se muestra el rol.
  const nombre = email || (rol === "admin" ? "Admin" : "Operador");
  const inicial = nombre.slice(0, 1).toUpperCase();
  return (
    <div className="border-t border-white/10 p-3">
      <a
        href={import.meta.env.VITE_REPARTIDOR_URL ?? "/app/"}
        target="_blank"
        rel="noreferrer"
        title={compacta ? "Panel del repartidor" : undefined}
        className={`mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white ${compacta ? "justify-center" : ""}`}
      >
        <ExternalLink className="h-[18px] w-[18px] shrink-0" aria-hidden />
        {!compacta && "Panel del repartidor"}
      </a>
      <div className={`flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5 ${compacta ? "flex-col" : ""}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-movii-500 text-sm font-bold text-movii-900">{inicial}</span>
        {!compacta && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{nombre}</p>
            <p className="text-xs capitalize text-white/50">{rol}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          title="Cerrar sesión"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span className="sr-only">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { sesion, logout } = useAuth();
  const [compacta, setCompacta] = useState(leerColapsado);
  const [abierto, setAbierto] = useState(false);
  const location = useLocation();
  // Barra de estado del celular = barra superior oscura; abajo = fondo de trabajo.
  useBordesNavegador("#1a1a1a", "#eef0f2");

  useEffect(() => setAbierto(false), [location.pathname]);

  if (!sesion) return null;
  const rol = sesion.rol as Rol;

  function alternar() {
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
    <div className="flex min-h-screen bg-hormigon-100">
      {/* Sidebar de escritorio */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-asfalto-900 transition-[width] duration-300 ease-out lg:flex ${compacta ? "w-[84px]" : "w-64"}`}
      >
        <div className={`flex items-center px-5 pb-4 pt-6 ${compacta ? "justify-center px-0" : "justify-between"}`}>
          <Marca compacta={compacta} />
        </div>
        <Navegacion compacta={compacta} rol={rol} />
        <button
          type="button"
          onClick={alternar}
          className={`mx-3 mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-white/40 transition-colors hover:text-white ${compacta ? "justify-center" : ""}`}
        >
          {compacta ? <ChevronsRight className="h-4 w-4" aria-hidden /> : <ChevronsLeft className="h-4 w-4" aria-hidden />}
          {!compacta && "Contraer menú"}
          <span className="sr-only">{compacta ? "Expandir menú" : "Contraer menú"}</span>
        </button>
        <PieUsuario compacta={compacta} email={sesion.email} rol={sesion.rol} onLogout={logout} />
      </aside>

      {/* Menú lateral en celular */}
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAbierto(false)} />
          <aside className="pt-safe pb-safe relative flex h-full w-72 max-w-[85vw] flex-col bg-asfalto-900 shadow-2xl">
            <div className="flex items-center justify-between px-5 pb-4 pt-5">
              <Marca compacta={false} />
              <button type="button" onClick={() => setAbierto(false)} className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" aria-hidden />
                <span className="sr-only">Cerrar menú</span>
              </button>
            </div>
            <Navegacion compacta={false} rol={rol} alNavegar={() => setAbierto(false)} />
            <PieUsuario compacta={false} email={sesion.email} rol={sesion.rol} onLogout={logout} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior solo en celular/tablet */}
        <header className="pt-safe sticky top-0 z-30 bg-asfalto-900 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button type="button" onClick={() => setAbierto(true)} className="rounded-xl p-2 text-white/80 hover:bg-white/10">
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
