# Web — HU-06/07/09/08/10 (detalle + acciones + tracking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar el Sprint 2 a la web (React 19 + Vite + TS + Tailwind + Zod + react-query): historial y acciones en `EnvioDetallePage` (estado, incidencia, reprogramación; evidencia visible) + página pública `/tracking`. La API ya está completa y verificada (HU-06→HU-10); este plan solo consume endpoints existentes.

**Architecture:** Patrones existentes, sin inventar nuevos: tipos en `features/envios/types.ts`, llamadas en `features/envios/api.ts` vía `apiClient` (axios), validación con Zod en `features/envios/schema.ts` + formularios estilo `EnvioForm` (estado local + `safeParse` + `Field`/`Alert`), datos con `useQuery`/`useMutation` (react-query), UI con `Card`/`Button`/`Badge`/`Alert`/`Spinner`/`EmptyState`. Tests unitarios puros estilo `schema.test.ts` (sin mocks de fetch; el e2e real vive en el backend Go).

**Tech Stack:** React 19, react-router 7, TanStack Query 5, axios, Zod, Tailwind, Vitest. Sin dependencias nuevas.

**Spec:** Contrato en [gestion-envios/docs/api/openapi.yaml](../../docs/api/openapi.yaml) (endpoints, schemas, ejemplos). Fichas: [Apuntes/Sprints/Borrador-HU-Sprint2.md](../../../Apuntes/Sprints/Borrador-HU-Sprint2.md) (CA-07/08 de cada HU). **No re-diseñar.**
Alcance web por HU (leer las fichas): HU-06 = cambiar estado + ver historial; HU-07 = registrar incidencia (motivo+comentario+foto opcional); HU-09 = reprogramar + ver `reprogramado_para`; HU-08 = **SOLO ver evidencia** (confirmar es del móvil, no hay form de confirmación en web); HU-10 = página pública `/tracking`.

## Global Constraints

- Todo en `gestion-envios/apps/web/src`. No tocar API Go, mobile, openapi.
- La web es solo operador/supervisor (`ProtectedRoute allow={["operador","supervisor"]}` ya lo impone; repartidor ve acceso-denegado). Sin lógica extra de roles para las acciones. `/tracking` es la ÚNICA ruta pública nueva (fuera del bloque protegido, junto a `/login`).
- Errores del backend: mostrar `getApiErrorMessage(error, fallback)` en `Alert` (patrón existente). Éxito de mutación: invalidar `["envios", id]` (+ `["envios"]` si cambia estado/fecha) y mensaje `Alert success`.
- Fechas: `nueva_fecha` input `type="date"` (YYYY-MM-DD); el backend valida (pasada → 400, se muestra el mensaje).
- Foto (incidencia, opcional): `<input type="file" accept="image/*">` → base64 sin prefijo vía FileReader; se envía como `foto_base64` (ausente si no se eligió). Límite 5 MB lo valida el backend.
- Firma/foto de evidencia (HU-08, solo vista): los binarios exigen auth (Bearer), así que NO sirven `<a href>` ni `<img src>` directos: descargar con `apiClient` (`responseType: "blob"`) → `URL.createObjectURL` → mostrar en `<img>` / abrir en pestaña. Botones "Ver firma" / "Ver foto".
- Timeline compartido: un componente `HistorialTimeline` que sirva al detalle (EventoEnvio: fecha, actor_nombre?, anterior/nuevo, motivo, comentario) y al tracking (fecha, descripcion, motivo). Colores semánticos del sistema (verde/azul/amarillo/rojo según openapi HU-10 CA-06; reutilizar/extender `Badge` si calza).
- `historial: []` → `EmptyState` ("Sin movimientos todavía"), no lista vacía muda.
- Tests: `npm test` (vitest run), `npm run lint`, `npm run build` en verde. Instalar dependencias según el repo (`scripts/setup.mjs` / README de apps/web; hay pnpm-lock: preferir el package manager del repo).
- Commits en español + `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (los hace el orquestador, NO el worker).

## Task 1: Tipos + schemas + api

**Files:**
- Edit: `src/features/envios/types.ts` (agregar; no romper lo existente)
- Edit: `src/features/envios/schema.ts` (+ `schema.test.ts`)
- Edit: `src/features/envios/api.ts`

**Interfaces:**
- Types (nombres exactos del openapi, snake_case como el resto del archivo):
  ```ts
  interface EventoEnvio { fecha: string; actor_nombre: string | null; estado_anterior: EstadoEnvio | null; estado_nuevo: EstadoEnvio; motivo: string | null; comentario: string | null }
  // EnvioDetalle suma: historial: EventoEnvio[]; reprogramado_para: string | null; franja: "manana"|"tarde"|"noche" | null; confirmacion: ConfirmacionMetadata | null
  interface ConfirmacionMetadata { receptor_nombre: string; receptor_relacion: string; confirmada_at: string; firma_url: string; foto_url: string }
  interface TrackingEvento { fecha: string; descripcion: string; motivo?: string }
  interface TrackingResponse { codigo_guia: string; estado: EstadoEnvio; localidad: string; actualizado_en: string; historial: TrackingEvento[] }
  type CambiarEstadoInput = { estado: "asignado" | "en_camino" };
  type IncidenciaInput = { motivo: string; comentario?: string; foto_base64?: string };
  type ReprogramacionInput = { nueva_fecha: string; franja: "manana"|"tarde"|"noche" };
  ```
- Zod: `cambiarEstadoSchema` (enum 2 valores), `incidenciaSchema` (motivo enum 5 + comentario opcional + refinamiento: motivo "otro" exige comentario no-blanco), `reprogramacionSchema` (nueva_fecha regex `^\d{4}-\d{2}-\d{2}$` + franja enum 3), `trackingCodigoSchema` (trim, no-vacío; formato `MOV-YYYYMMDD-XXXX` como validación amable — el backend es la autoridad).
- api: `cambiarEstado(id, input) → PUT`, `registrarIncidencia(id, input) → POST`, `reprogramarEnvio(id, input) → POST`, `obtenerTracking(codigo) → GET /tracking/{codigo}` (mismo apiClient; sin login no hay token y el endpoint es público).

- [x] **Paso 1: Types** (aditivos; `EnvioDetalle` extendido)
- [x] **Paso 2: Schemas + `schema.test.ts`** (tabla por schema: feliz + cada regla; patrón de los tests existentes)
- [x] **Paso 3: Funciones api** (4 llamadas; tipos de retorno del openapi)

## Task 2: Detalle extendido (historial + reprogramación + evidencia)

**Files:**
- Create: `src/features/envios/HistorialTimeline.tsx` (+ test si aporta: mapeo estado→color/label como función pura testeable)
- Edit: `src/pages/envios/EnvioDetallePage.tsx` (3 secciones nuevas debajo de Paquete; las acciones van en Task 3)

**Interfaces:**
- `HistorialTimeline({ eventos }: { eventos: EventoEnvio[] | TrackingEvento[] })`: acepta ambas formas (union + type-guard por `"descripcion" in e`). Cada item: fecha legible, descripción (tracking: tal cual; detalle: derivada de anterior→nuevo + motivo — función pura `descripcionEvento` en el mismo archivo, testeada), color semántico por estado/motivo. Vacío → `EmptyState`.
- Detalle suma: sección "Historial" (timeline), `Dato` reprogramación (solo si `reprogramado_para`: "Comprometido para {fecha} ({franja})"), sección "Evidencia de entrega" (solo si `confirmacion`: receptor, relación, fecha + botones Ver firma/Ver foto con descarga blob).

- [x] **Paso 1: `HistorialTimeline` + `descripcionEvento` + tests**
- [x] **Paso 2: Secciones en `EnvioDetallePage`** (usa los datos que ya trae `obtenerEnvio`; sin llamadas nuevas salvo blobs)
- [x] **Paso 3: Descarga y vista de firma/foto** (blob + objectURL; liberar URLs al desmontar)

## Task 3: Acciones en el detalle (estado + incidencia + reprogramar)

**Files:**
- Create: `src/features/envios/CambiarEstadoButtons.tsx`, `IncidenciaForm.tsx`, `ReprogramarForm.tsx` (o una `AccionesEnvio.tsx` que las agrupe — a criterio del worker, UN solo archivo nuevo si agrupa)
- Edit: `src/pages/envios/EnvioDetallePage.tsx` (montar acciones; `useMutation` + invalidación + `Alert` éxito/error)

**Interfaces:**
- Visibilidad por estado (igual que el móvil): `asignado` → botón "Iniciar reparto" (→en_camino); `en_camino` → "Volver a asignado" + "Registrar incidencia"; `no_entregado` → "Reprogramar"; `entregado`/`pendiente` → sin acciones (nota informativa). Incidencia también disponible desde `asignado` (el backend lo permite).
- `IncidenciaForm`: select motivo + comentario + file foto opcional; validación Zod (otro→comentario); al éxito muestra el mensaje y colapsa.
- `ReprogramarForm`: date + select franja; idem.
- Tras mutación exitosa: `queryClient.invalidateQueries({ queryKey: ["envios", id] })` (+ `["envios"]` por si cambió estado/fecha) y la UI refleja el nuevo estado/historial sin recargar.

- [x] **Paso 1: Los 3 controles** (patrón `EnvioForm`: estado local + safeParse + Field + Button loading + Alert error)
- [x] **Paso 2: Montaje en detalle con visibilidad por estado + invalidación**
- [x] **Paso 3: Tests de schemas/visibilidad que aporten** (sin montar React si no hay infra: seguir el patrón unitario existente)

## Task 4: Tracking público

**Files:**
- Create: `src/pages/TrackingPage.tsx` (+ ruta en `App.tsx` fuera de ProtectedRoute)
- Reutilizar: `HistorialTimeline`, `Card`, `Alert`, `Spinner`, `EmptyState`, `trackingCodigoSchema`, `obtenerTracking`

**Interfaces:**
- Ruta `/tracking` (sin `:codigo` en la URL: buscador con input + botón; al buscar, `useQuery` con `enabled` + `obtenerTracking(codigo)`). 404 backend → Alert "No se encontró ningún envío con ese código" (mensaje amable, sin tecnicismos). Resultado: header con código + badge estado + localidad + actualizado_en + timeline. Link "Rastrear otro envío" limpia la búsqueda.
- Accesible sin login: verificar que nada de la página exige sesión (no está bajo ProtectedRoute; AppLayout con sidebar NO debe envolverla — página standalone minimalista con header propio).

- [x] **Paso 1: `TrackingPage` + ruta pública**
- [x] **Paso 2: Verificación manual de flujo** (el worker la describe; el orquestador la prueba en navegador si hace falta)

## Task 5: Verde + cierre

- [x] **Paso 1: `npm test`, `npm run lint`, `npm run build` en verde**
- [x] **Paso 2: Horas + commits (orquestador, NO el worker)**
