import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

interface NavItem {
  to: string;
  label: string;
  roles?: Array<"operador" | "supervisor">;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/operaciones", label: "Operaciones" },
  { to: "/envios", label: "Envíos" },
  { to: "/rutas", label: "Rutas" },
  { to: "/vehiculos", label: "Vehículos" },
  { to: "/repartidores", label: "Repartidores" },
  { to: "/reportes", label: "Reportes" },
  { to: "/usuarios", label: "Usuarios", roles: ["supervisor"] },
  { to: "/configuracion/whatsapp", label: "WhatsApp", roles: ["supervisor"] },
];

export function AppLayout() {
  const { sesion, logout } = useAuth();
  if (!sesion) return null;

  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(sesion.rol as "operador" | "supervisor"));

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-44 shrink-0 md:w-60 flex-col border-r border-gray-200 bg-movii-900 text-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-movii-500 font-bold text-movii-900">M</span>
          <span className="text-lg font-semibold">Movii</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-movii-500 text-movii-900" : "text-gray-200 hover:bg-white/10"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <a
            href={import.meta.env.VITE_REPARTIDOR_URL ?? "/app/"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-white/10"
          >
            Panel del repartidor
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M11 3h6v6M17 3l-8 8M8 5H4v11h11v-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div className="text-sm text-gray-500">
            Panel del operador logístico
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <p className="font-medium text-gray-900">{sesion.email}</p>
              <p className="capitalize text-gray-500">{sesion.rol}</p>
            </div>
            <Button variant="secondary" onClick={logout}>
              Cerrar sesión
            </Button>
          </div>
        </header>

        <main className="flex-1 bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
