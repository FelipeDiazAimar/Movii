# Movii — Panel web (operador / supervisor)

Panel web para el operador logístico y el supervisor: registrar envíos, gestionar rutas diarias y asignarles envíos y repartidor (HU-01 a HU-04 del Sprint 1). Es la única interfaz para esos roles — el repartidor usa exclusivamente la app móvil (`apps/mobile`), y el tracking público del cliente por código de guía es HU-10 (Sprint 2, todavía no implementado acá).

Stack: Vite + React 18 + TypeScript + Tailwind CSS + React Router + TanStack Query + axios + Zod, consumiendo la API en Go de `services/api`.

## Ejecución local

```bash
npm install
cp .env.example .env   # ajustar VITE_API_URL si la API no corre en localhost:8080
npm run dev
```

La API (`services/api`) tiene que estar corriendo y con `CORS_ORIGINS=http://localhost:5173` (ya es el valor por defecto de su `.env.example`).

```bash
npm run build   # type-check (tsc -b) + build de producción
npm run test    # tests unitarios (Vitest)
npm run lint
```

## Pantallas

| Ruta | HU | Rol | Qué hace |
|---|---|---|---|
| `/login` | HU-01 | — | Login contra `POST /auth/login`. Un login con rol `repartidor` redirige a un aviso: ese rol usa la app móvil. |
| `/usuarios`, `/usuarios/nuevo` | HU-01 (CA-06) | supervisor | Listado y alta de usuarios (`GET /users`, `POST /auth/register`). |
| `/envios`, `/envios/nuevo`, `/envios/:id` | HU-02 | operador, supervisor | Alta de envío (remitente + destinatario + paquete) y listado con filtro por estado/fecha. |
| `/rutas`, `/rutas/nueva`, `/rutas/:id` | HU-03 | operador, supervisor | Alta, listado del día y detalle de ruta; edición solo mientras está `planificada`. |
| `/rutas/:id` (panel de asignación) | HU-04 | operador, supervisor | Desde el detalle de ruta: asignar envíos pendientes y desasignar, con peso y cantidad totales. |

## Estructura

```
src/
├── features/<dominio>/   # types, api.ts (llamadas HTTP), schema.ts (Zod), componentes de formulario
├── pages/<dominio>/      # pantallas, una por ruta
├── components/ui/        # Button, Field, Alert, Badge, Card, Spinner
├── components/layout/    # AppLayout (sidebar + topbar)
├── routes/               # ProtectedRoute (guard de sesión y de rol)
└── services/api-client.ts  # instancia de axios con interceptor de token y manejo de 401
```

No depende de `packages/shared`: los tipos y esquemas Zod están definidos localmente en cada `features/<dominio>`. Se optó por esto porque el workspace pnpm del monorepo no está realmente enlazado en este entorno (ver `apps/mobile/.env`, que tuvo el mismo problema con Metro) — depender de un paquete del workspace habría reproducido el mismo problema acá.

## Limitación conocida: selector de repartidor

`GET /users` es solo para `supervisor` (`services/api/internal/httprouter/router.go`). Un operador logueado no puede listar repartidores para elegirlos en el alta de una ruta, así que el formulario de ruta (`RepartidorSelect`) degrada a un campo de texto para pegar el UUID a mano cuando quien está logueado no es supervisor. No es ideal — la solución de fondo es un endpoint que liste repartidores para cualquier rol operativo — pero no se tocó el backend para esto.
