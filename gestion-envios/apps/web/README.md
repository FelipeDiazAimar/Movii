# Movii — Panel web (operador / admin)

Panel web del operador logístico y del admin, más el seguimiento público del cliente (`/tracking`).
El repartidor usa la app móvil (`apps/mobile`, también servida como PWA en `/app`).

Stack: Vite 6 + React 19 + TypeScript + Tailwind CSS + React Router + TanStack Query + axios + Zod,
mapas con Leaflet (2D) y MapLibre (3D). Consume la API en Go de `services/api`.

## Ejecución local

```bash
npm install
cp .env.example .env   # ajustar VITE_API_URL si la API no corre en localhost:8080
npm run dev            # http://localhost:5173
```

La API tiene que estar corriendo con `CORS_ORIGINS=http://localhost:5173` (valor por defecto de su
`.env.example`). Desde `gestion-envios/`, `npm run dev` levanta API, web y app juntas.

```bash
npm run build   # type-check (tsc -b) + build de producción
npm test        # Vitest + Testing Library
npm run lint
```

## Pantallas

| Ruta | HU | Rol | Qué hace |
|---|---|---|---|
| `/login`, `/primer-acceso` | HU-01, HU-16 | — | Login en dos pasos (código por WhatsApp), login con Google y cambio de contraseña obligatorio en el primer ingreso. |
| `/operaciones` | HU-11, HU-12 | operador, admin | Centro de operaciones: KPIs, flota, camión con su carga y **seguimiento en vivo** (mapa 2D/3D, paradas de la ruta en orden, parada a la que va el camión, botón "Iniciar ruta"). El admin tiene el botón ▶ que deja el día de demostración en su estado inicial. |
| `/envios`, `/envios/nuevo`, `/envios/:id` | HU-02, HU-06 a HU-10, HU-17 | operador, admin | Alta (con máscaras y límites en todos los campos), listado con filtros y detalle con historial, incidencia, reprogramación, seguimiento en vivo y avisos enviados. |
| `/rutas`, `/rutas/nueva`, `/rutas/:id` | HU-03, HU-04 | operador, admin | Rutas con avance y carga; detalle con asignación de envíos (sugerencias y recomendación por distancia), vehículo e "Iniciar ruta". Una ruta iniciada no admite envíos nuevos. |
| `/rutas/:id/mapa`, `/rutas/:id/3d` | HU-12 | operador, admin | Mapa de la ruta por calles (2D) y vista 3D. |
| `/vehiculos` | HU-18 | operador, admin | Flota del día elegido: estado, carga, ruta asignada y asignar ruta a un vehículo libre. |
| `/repartidores`, `/repartidores/:id` | HU-03 | operador, admin | Repartidores con sus rutas. |
| `/reportes` | HU-13 a HU-15 | operador, admin | Envíos por período (CSV), ranking de repartidores y Pareto de incidencias. |
| `/usuarios`, `/usuarios/nuevo` | HU-01 | admin | Alta y listado de usuarios. |
| `/configuracion/whatsapp` | HU-16, HU-17 | admin | Vincular la cuenta de WhatsApp de la empresa (QR). |
| `/tracking`, `/tracking/:codigo` | HU-10 | público | Seguimiento por código de guía con el camión en vivo el día de entrega. |

## Estructura

```
src/
├── features/<dominio>/   # types, api.ts (llamadas HTTP), schema.ts (Zod) y componentes del dominio
│                         # (envios, rutas, flota, mapas, analitica, auth, usuarios, whatsapp, demo)
├── pages/                # una pantalla por ruta
├── components/ui/        # Button, Field, Popover, MenuAcciones, BotonEliminar, Skeleton…
├── components/layout/    # AppLayout (panel lateral que se expande al pasar el cursor)
├── routes/               # ProtectedRoute (sesión y rol)
├── utils/                # fechas (día argentino), máscaras de formularios, filtros
└── services/api-client.ts  # axios con el token y manejo de 401
```

Los tipos se definen en cada `features/<dominio>` y se mantienen a mano en línea con
`docs/api/openapi.yaml` (`packages/shared` no se usa).

Las actualizaciones en vivo llegan por SSE (`/operaciones/flota/stream`): el evento `posicion` mueve
los camiones y el evento `cambio` hace que la página recargue los datos al instante cuando cambia
el estado de un envío o de una ruta.
