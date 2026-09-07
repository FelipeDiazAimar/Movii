# Diseño — Sprint 1 Movii (Sistema de Gestión de Envíos y Distribución)

**Fecha:** 2026-09-05
**Grupo N° 7:** Araya, Ulises · Díaz Aimar, Felipe · Micheloud, Jeremías
**Cierre de la entrega:** miércoles 09/09/2026
**Cátedra:** Ingeniería y Calidad del Software — UTN FRSF

---

## 1. Contexto y objetivo

El proyecto tiene documentación de Sprint 0 y Sprint 1 (Product Backlog, Sprint
Backlog, modelo de datos, estimaciones) pero **cero implementación**: solo la
estructura de carpetas en `gestion-envios/` y un prototipo móvil no funcional en
`movii/` (Expo + datos mock, hecho con manus.ai).

Este documento define la implementación real de las **5 Historias de Usuario del
Sprint 1** para llegar a la entrega del 09/09/2026 con software funcionando y
desplegado, además de tests.

### Historias de Usuario del Sprint 1

| ID | HU | Interfaz | SP |
|----|----|----------|----|
| HU-01 | Registro y autenticación de usuarios | Web | 8 |
| HU-02 | Registro de envíos | Web | 5 |
| HU-03 | Gestión de rutas diarias | Web | 5 |
| HU-04 | Asignación de envíos a ruta y repartidor | Web | 5 |
| HU-05 | Listado de envíos del día para repartidor | Móvil | 3 |

Los criterios de aceptación de cada HU están en el documento
`Apuntes/Sprints/sprint backlog1.md` y no se repiten acá; este spec cubre **cómo
se implementan**.

---

## 2. Alcance

### Dentro

- API REST en Go con los endpoints de las 5 HU, autenticación JWT y control de rol.
- Base de datos PostgreSQL en Supabase con las 5 tablas del modelo y migraciones versionadas.
- App web (React) con las pantallas de HU-01 a HU-04 para los roles operador y supervisor.
- App móvil (Expo/React Native) con login real y la vista "Mi ruta de hoy" (HU-05) contra la API.
- Tests: unitarios de lógica de negocio en Go, integración de handlers, y tests de componentes/hooks clave en web.
- Documentación OpenAPI/Swagger de los endpoints.
- Despliegue: Supabase (DB), Render (API), Vercel (web), Expo Go / dev build (móvil).
- CI en GitHub Actions: lint + test para Go y TS.

### Fuera (Sprint 2/3, no se implementa)

- HU-06 a HU-15 (actualización de estado, entrega fallida, firma/foto, reprogramación, tracking público, panel en vivo, mapa, reportes, ranking, clasificación de incidencias).
- Las pantallas del prototipo móvil que corresponden a esas HU quedan como maqueta estática, sin conexión a la API.
- Optimización de rutas, integraciones externas, facturación, multi-tenant.

---

## 3. Arquitectura

### 3.1 Monorepo

Se usa la estructura ya presente en `gestion-envios/`. Workspace pnpm para los
paquetes TypeScript; `services/api` es un módulo Go independiente.

```
gestion-envios/
├── pnpm-workspace.yaml
├── services/api/              # API REST en Go
│   ├── cmd/api/main.go
│   ├── internal/
│   │   ├── config/            # carga de env
│   │   ├── domain/            # structs de dominio (Usuario, Envio, Ruta, ...)
│   │   ├── handlers/          # HTTP handlers por recurso
│   │   ├── middleware/        # auth JWT, verificación de rol, logging, CORS
│   │   ├── repository/        # acceso a datos con pgx
│   │   ├── services/          # lógica de negocio (testeable sin HTTP)
│   │   ├── platform/db/       # pool pgx, helpers
│   │   └── platform/http/     # router chi, montaje de rutas, respuestas JSON
│   ├── migrations/            # SQL de golang-migrate (0001_*.up.sql / .down.sql)
│   ├── docs/                  # openapi.yaml + Swagger UI
│   ├── tests/                 # integración
│   ├── Dockerfile
│   └── go.mod
├── apps/web/                  # Vite + React + TS + Tailwind
│   └── src/{routes,features,components,services,hooks,styles}
├── apps/mobile/               # Expo Router + React Native (ex-prototipo movii/)
│   └── app/, src/, lib/
├── packages/shared/           # tipos + esquemas Zod (consumidos por web y mobile)
│   └── src/{types,schemas,constants}
├── supabase/                  # symlink lógico: migrations viven en services/api/migrations
└── .github/workflows/ci.yml
```

El prototipo `movii/` (hoy en la raíz del repo) se **mueve a
`gestion-envios/apps/mobile/`**. Se conserva su sistema de diseño, navegación
Expo Router y pantallas; se reemplaza la capa de datos mock por un cliente HTTP
real para login y HU-05.

### 3.2 API en Go

- **Router:** `chi` (`github.com/go-chi/chi/v5`) + middlewares de `chi` (RequestID, RealIP, Recoverer) y propios (auth, rol, CORS).
- **Base de datos:** `pgx/v5` con `pgxpool`. Capa `repository` con SQL explícito; sin ORM.
- **Migraciones:** `golang-migrate` (CLI + archivos SQL en `services/api/migrations`). Comando `make migrate-up` / `migrate-down`.
- **Configuración:** struct `Config` poblada desde variables de entorno; `godotenv` solo en desarrollo. Variables: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGINS`, `ENV`.
- **Capas y dependencias:** `handlers` dependen de `services`; `services` dependen de interfaces `repository`; `repository` depende del pool `pgx`. Esto permite testear `services` con repos fake y `handlers` con `httptest`.
- **Respuestas:** JSON uniforme. Éxito: el recurso o lista. Error: `{ "error": { "code": "...", "message": "..." } }` con el status HTTP correspondiente.
- **Documentación:** `openapi.yaml` mantenido a mano; Swagger UI servido en `GET /docs`.

### 3.3 App web

- Vite + React 18 + TypeScript + Tailwind CSS.
- Ruteo con React Router; datos con TanStack Query + `axios` (instancia con interceptor que agrega el `Authorization: Bearer <token>`).
- Estado de sesión: token en `localStorage` + contexto de auth; guard de rutas por rol.
- Layout de panel simple (sidebar + topbar), color de acento amarillo Movii, sin diseño custom elaborado.
- Formularios con validación usando los esquemas Zod de `packages/shared`.
- Pantallas:
  - **Login** (HU-01)
  - **Usuarios**: alta y listado, solo rol supervisor (HU-01, CA-06)
  - **Envíos**: formulario de alta (remitente + destinatario + paquete) y listado con filtro por estado y fecha (HU-02)
  - **Rutas**: alta, listado del día con estado, edición si `planificada`, detalle con envíos (HU-03)
  - **Asignación**: selección de envíos pendientes y asignación/desasignación a una ruta, con peso y cantidad acumulados (HU-04)

### 3.4 App móvil

- Base: el prototipo `movii/` (Expo SDK 54, Expo Router, NativeWind).
- Se agrega `lib/api.ts` (cliente HTTP con token en `expo-secure-store`).
- **Login** contra `POST /auth/login` (rol repartidor).
- **Mi ruta de hoy** (HU-05): consume `GET /repartidor/envios-del-dia`; muestra tarjetas por envío (destinatario, dirección, código de guía, peso, estado), agrupadas por ruta, con filtro por estado y un resumen del día (total / entregados / pendientes / no entregados). Mobile-first 390×844.
- El resto de pantallas del prototipo (confirmar entrega, incidencia, reprogramar, tracking) quedan como maqueta estática.

### 3.5 Paquete compartido

`packages/shared` exporta, **solo para web y mobile**:

- Tipos TypeScript de los DTOs (`Usuario`, `Envio`, `Ruta`, `Remitente`, `Destinatario`, enums de estado y rol).
- Esquemas Zod para validar formularios y respuestas.
- Constantes (estados, roles, formato de código de guía).

La API en Go **no** consume este paquete. Los DTOs se mantienen sincronizados a
mano entre `services/api/internal/domain` y `packages/shared/src/types`, con el
`openapi.yaml` como referencia única. (Alternativa descartada por tiempo:
generar el cliente TS desde OpenAPI.)

---

## 4. Autenticación y autorización

- **Registro** (`POST /auth/register`): valida email único y formato, hashea la contraseña con `bcrypt` (cost 10), persiste en `usuarios` con `rol` y `activo=true`.
- **Login** (`POST /auth/login`): verifica credenciales; si son válidas devuelve un JWT firmado con `JWT_SECRET` (HS256), claims `sub` (id), `rol`, `exp` (24 h). Credenciales inválidas → `401` sin revelar si el email existe.
- **Middleware `RequireAuth`**: valida el JWT del header `Authorization`; inyecta el usuario en el contexto. Sin token o inválido → `401`.
- **Middleware `RequireRole(roles...)`**: `403` si el rol del token no está en la lista.
- Reglas por endpoint:
  - `POST /envios`, `POST/PUT /rutas`, asignación → `operador` o `supervisor`
  - `GET /users`, alta de usuarios → `supervisor`
  - `GET /repartidor/envios-del-dia` → `repartidor` (y solo sus rutas del día)
  - Lecturas de envíos/rutas → cualquier rol autenticado del panel

Supabase se usa exclusivamente como PostgreSQL gestionado; **no** se usa Supabase Auth ni RLS en este sprint.

---

## 5. Contrato de la API

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/auth/register` | supervisor | Crea un usuario con rol |
| POST | `/auth/login` | público | Devuelve JWT |
| GET | `/users` | supervisor | Lista usuarios (nombre, email, rol, activo) |
| POST | `/envios` | operador/supervisor | Crea envío; genera `codigo_guia` `MOV-YYYYMMDD-XXXX`; estado `pendiente` |
| GET | `/envios` | autenticado | Lista con filtros `?estado=&fecha=` |
| GET | `/envios/{id}` | autenticado | Detalle del envío |
| POST | `/rutas` | operador/supervisor | Crea ruta (nombre, zona, fecha, repartidor); estado `planificada` |
| GET | `/rutas` | autenticado | Lista con filtro `?fecha=`; incluye conteo de envíos |
| GET | `/rutas/{id}` | autenticado | Detalle con lista de envíos, peso y cantidad totales |
| PUT | `/rutas/{id}` | operador/supervisor | Edita ruta solo si `planificada` |
| POST | `/rutas/{id}/envios` | operador/supervisor | Asigna 1..N envíos pendientes; pasan a `asignado`; valida fecha no vencida y ruta `planificada` |
| DELETE | `/rutas/{id}/envios/{envioId}` | operador/supervisor | Desasigna; el envío vuelve a `pendiente`; solo si ruta `planificada` |
| GET | `/repartidor/envios-del-dia` | repartidor | Envíos de las rutas del repartidor logueado con fecha de hoy, agrupados por ruta |
| GET | `/health` | público | Health check |
| GET | `/docs` | público | Swagger UI |

Errores estándar: `400` validación, `401` sin/mal token, `403` rol incorrecto,
`404` no encontrado, `409` conflicto (email duplicado, regla de negocio), `500`
interno.

---

## 6. Modelo de datos

Cinco tablas en el schema `public` (definición completa en `sprint backlog1.md`
§6). Resumen:

- **usuarios**: `id` UUID PK, `nombre`, `email` UNIQUE, `password_hash`, `rol` (`operador`|`repartidor`|`supervisor`), `activo` bool, `created_at`, `updated_at`.
- **remitentes**: `id` UUID PK, `nombre`, `telefono`, `direccion`, `created_at`.
- **destinatarios**: `id` UUID PK, `nombre`, `telefono`, `calle`, `numero`, `piso_depto`, `localidad`, `codigo_postal`, `created_at`.
- **rutas**: `id` UUID PK, `nombre`, `zona`, `fecha` DATE, `estado` (`planificada`|`en_curso`|`completada`), `repartidor_id` FK→usuarios, `created_at`, `updated_at`.
- **envios**: `id` UUID PK, `codigo_guia` UNIQUE, `estado` (`pendiente`|`asignado`|`en_camino`|`entregado`|`no_entregado`), `peso` numeric, `tamano` (`chico`|`mediano`|`grande`), `tipo_contenido`, `fragil` bool, `urgente` bool, `remitente_id` FK, `destinatario_id` FK, `ruta_id` FK NULL, `created_at`, `updated_at`.

Migración `0001` crea las 5 tablas, tipos enum, índices (`envios.codigo_guia`,
`envios.estado`, `envios.ruta_id`, `rutas.fecha`, `usuarios.email`) y triggers de
`updated_at`. Migración `0002` inserta seed de demo: un usuario por rol, algunos
remitentes/destinatarios, ~8 envíos, 1 ruta con envíos asignados para hoy.

Generación de `codigo_guia`: `MOV-` + fecha `YYYYMMDD` + `-` + secuencia diaria de
4 dígitos con cero a la izquierda, calculada en el `service` dentro de la misma
transacción del alta.

---

## 7. Estrategia de tests

- **Go — unit (`internal/services`):** lógica de negocio con repos fake en memoria. Casos: validación de alta de envío, generación de código de guía, transición de estado en asignación/desasignación, reglas de ruta (fecha vencida, estado no planificada), filtro del repartidor por fecha y rol.
- **Go — integración (`tests/`):** handlers vía `httptest` contra un schema `test` separado en la misma instancia de Supabase, con las migraciones aplicadas antes de correr y limpieza entre casos. Al menos el camino feliz + un error por endpoint principal.
- **Web — Vitest + Testing Library:** validación de formularios (envío, ruta), render de listas con filtros, guard de rutas por rol, interceptor de token.
- **Meta:** cobertura significativa de `services` y de la validación de formularios. No se persigue un número fijo; se prioriza cubrir las reglas de negocio de los criterios de aceptación.
- CI corre `go test ./...`, `go vet`, `pnpm -r lint`, `pnpm -r test`.

---

## 8. Despliegue

| Pieza | Plataforma | Preparo yo | Hace el equipo |
|-------|-----------|------------|----------------|
| Base de datos | Supabase (free) | migraciones, `.env.example`, script de aplicación | crear el proyecto, pasar `DATABASE_URL` y credenciales |
| API Go | Render (free web service) | `Dockerfile`, `render.yaml`, health check | conectar el repo, cargar env vars |
| Web | Vercel | `vercel.json`, build config, `VITE_API_URL` | importar el repo en Vercel |
| Móvil | Expo Go / dev build para la demo; APK con EAS si sobra tiempo | `app.config.ts` con `API_URL`, `eas.json` | correr `expo start` o `eas build -p android` con su cuenta |

Las tareas de "crear cuenta / linkear repo / correr build" las ejecuta el equipo
siguiendo un `DEPLOY.md` con pasos exactos que se genera al final.

---

## 9. Secuencia de implementación

1. **Fundaciones:** instalar Go; `pnpm-workspace.yaml`; scaffold `services/api` (config, pool pgx, router chi, `/health`); CI mínima; mover `movii/` → `apps/mobile/`.
2. **Modelo de datos:** migraciones `0001` (tablas + enums + índices + triggers) y `0002` (seed). Verificar contra Supabase.
3. **HU-01 (auth):** dominio `Usuario`, repo, service (register/login/list), handlers, middlewares `RequireAuth` / `RequireRole`, tests. Web: login + contexto de auth + pantalla usuarios. Mobile: login.
4. **HU-02 (envíos):** dominio + repo + service (alta con código de guía, listado con filtros) + handlers + tests. Web: formulario + listado.
5. **HU-03 (rutas):** repo + service (alta, listado con conteo, edición condicionada, detalle) + handlers + tests. Web: gestión de rutas.
6. **HU-04 (asignación):** service (asignar/desasignar con transición de estado y validaciones) + handlers + tests. Web: pantalla de asignación con totales.
7. **HU-05 (repartidor):** service + handler `GET /repartidor/envios-del-dia` + tests. Mobile: "Mi ruta de hoy" con datos reales.
8. **Despliegue:** Supabase prod, API en Render, web en Vercel, `openapi.yaml` + Swagger, `DEPLOY.md`.
9. **Documentación de entrega:** completar la sección "Implementación" del documento Sprint 1 (capturas, endpoints, enlaces a commits/PR por HU), corregir la fecha de presentación `10/09` → `09/09` en los tres documentos, y completar el apartado "Modificaciones al Product Backlog".

Cada fase deja algo ejecutable. Si el tiempo aprieta, se corta después de la
fase 5 o 6 con lo anterior sólido y testeado, que cubre lo que la cátedra pidió
mostrar en detalle ("1 o 2 HU descompuestas e implementadas").

---

## 10. Convenciones

- **Ramas:** `feature/HU-XX-descripcion-breve`.
- **Commits:** en español, prefijo con ID de tarea cuando aplique (`T-02.03: implementar POST /envios`). Cierre con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **PRs:** descripción + checklist de DoD + capturas.
- **Go:** `gofmt` + `go vet`. **TS:** ESLint + Prettier.
- **DoD** (del Sprint Backlog): revisado por PR, estilo OK, probado manual +/-, tests de lógica de negocio, integrado sin conflictos y CI verde, Swagger actualizado si cambian endpoints, demo aprobada, sin bugs alta/crítica.

---

## 11. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Alcance de 5 HU + web + móvil + deploy en ~4 días | Fases independientes; cortar después de HU-02/03 si hace falta, con lo previo sólido. |
| Equipo sin experiencia en Go | API en capas finas y homogéneas; un patrón claro por recurso que se repite; HU-01 sirve de plantilla. |
| Creación de cuentas/deploy depende del equipo | `DEPLOY.md` con pasos exactos; la app corre en local sin deploy para la demo si falla algo. |
| DTOs Go/TS se desincronizan | `openapi.yaml` como fuente única; revisión al cerrar cada HU. |
| Tests de integración necesitan DB | Schema de test en la misma Supabase; migraciones automáticas antes de correr. |
