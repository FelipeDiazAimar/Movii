# Estructura de Directorios del Proyecto

## 1. Objetivo

Este documento describe la estructura inicial de carpetas creada para el proyecto **Sistema de Gestion de Envios y Distribucion** y la funcion de cada directorio.

La organizacion se basa en un esquema tipo monorepo para el stack definido:

- App movil con React Native y Expo.
- Frontend web con TypeScript.
- Backend con Go.
- Base de datos y servicios gestionados con Supabase.

## 2. Estructura general

```text
gestion-envios/
├── apps/
│   ├── mobile/
│   └── web/
├── services/
│   └── api/
├── packages/
│   └── shared/
├── supabase/
├── docs/
├── infra/
├── scripts/
└── .github/
```

## 3. Funcion de cada carpeta

### 3.1 `apps/`

Contiene las aplicaciones de usuario final y operativas.

- `apps/mobile/`: aplicacion movil principal para repartidores y uso operativo.
- `apps/web/`: frontend web para tracking publico y panel administrativo.

#### `apps/mobile/`

Estructura pensada para Expo + React Native.

- `assets/`: imagenes, iconos y recursos estaticos de la app.
- `src/components/`: componentes reutilizables de interfaz.
- `src/features/`: funcionalidades organizadas por dominio o modulo.
- `src/navigation/`: navegacion entre pantallas.
- `src/screens/`: pantallas principales de la app.
- `src/services/`: integraciones con API, autenticacion o servicios externos.
- `src/store/`: estado global de la aplicacion.
- `src/theme/`: colores, tipografia, espaciado y estilos base.
- `src/utils/`: utilidades compartidas dentro de la app.

#### `apps/web/`

Frontend web en TypeScript para tracking y administracion.

- `public/`: archivos publicos estaticos.
- `src/components/`: componentes reutilizables.
- `src/features/`: modulos de negocio y vistas por dominio.
- `src/hooks/`: hooks personalizados.
- `src/pages/`: paginas o vistas principales.
- `src/routes/`: definicion de rutas.
- `src/services/`: cliente HTTP y comunicacion con el backend.
- `src/styles/`: estilos globales o tokens visuales.
- `src/utils/`: funciones auxiliares compartidas.

### 3.2 `services/`

Contiene los servicios backend del sistema.

- `services/api/`: API principal escrita en Go.

#### `services/api/`

Organizacion base sugerida para un backend en Go.

- `cmd/api/`: punto de entrada del ejecutable principal.
- `internal/config/`: configuracion de entorno y variables.
- `internal/domain/`: entidades y reglas del negocio.
- `internal/handlers/`: controladores HTTP.
- `internal/middleware/`: middlewares de seguridad, logs y autenticacion.
- `internal/routes/`: definicion de rutas y grupos de endpoints.
- `internal/services/`: logica de aplicacion.
- `internal/repository/`: acceso a datos y persistencia.
- `internal/platform/db/`: conexion y soporte de base de datos.
- `internal/platform/http/`: configuracion del servidor HTTP.
- `pkg/`: paquetes reutilizables exportables dentro del backend.
- `tests/`: pruebas del backend.

### 3.3 `packages/`

Contiene codigo compartido entre frontend, movil y backend cuando aplique.

- `packages/shared/`: tipos, constantes, esquemas y utilidades comunes.

#### `packages/shared/`

- `src/types/`: tipos compartidos entre aplicaciones.
- `src/constants/`: constantes globales del dominio.
- `src/schemas/`: esquemas de validacion o contratos.
- `src/utils/`: helpers reutilizables.

### 3.4 `supabase/`

Contiene la configuracion y artefactos relacionados con Supabase.

- `migrations/`: migraciones de base de datos.
- `functions/`: funciones serverless o logica adicional gestionada por Supabase.
- `seeds/`: datos iniciales o de prueba.

### 3.5 `docs/`

Documentacion tecnica y funcional del proyecto.

- `docs/api/`: documentacion de endpoints.
- `docs/architecture/`: decisiones de arquitectura y diagramas.
- `docs/decisions/`: registro de decisiones tecnicas importantes.

### 3.6 `infra/`

Archivos de infraestructura y despliegue.

- `infra/docker/`: configuraciones relacionadas con contenedores.

### 3.7 `scripts/`

Scripts de automatizacion para tareas repetitivas, mantenimiento o despliegue.

### 3.8 `.github/`

Recursos de automatizacion y CI/CD para GitHub.

- `.github/workflows/`: pipelines automatizados.

## 4. Criterio de organizacion

La estructura separa claramente:

- Interfaz movil.
- Interfaz web.
- Logica de backend.
- Codigo compartido.
- Persistencia y configuracion de Supabase.
- Documentacion y automatizacion.

Esto facilita el trabajo paralelo del equipo y evita mezclar responsabilidades entre capas.

## 5. Relacion con el scope

Esta estructura acompaña el alcance definido en el Sprint 0:

- Registro de envios.
- Asignacion a rutas y repartidores.
- Seguimiento y tracking.
- Entregas fallidas y reprogramacion.
- Confirmacion de entrega.
- Firma digital y foto de evidencia.
- Paneles administrativos avanzados.
- Reportes de operacion.