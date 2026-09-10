# API — HU-10 (Tracking público por código de guía) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer `GET /tracking/{codigo}` PÚBLICO (sin login): estado actual, localidad e historial con descripciones legibles, sin exponer jamás datos sensibles. Cierra el Sprint 2.

**Architecture:** Mismas capas: `handlers → services → repository`, SQL explícito con `pgx`. Nuevo `TrackingRepo` (solo columnas blancas) + `TrackingService` (mapeo puro evento→descripción) + `TrackingHandler` sin claims. Incluye completar el historial: crear/asignar/desasignar hoy NO registran eventos (son de HU-01/04, anteriores a la tabla) y sin ellos el tracking de envíos nuevos sale vacío (Task 1).

**Tech Stack:** Go 1.27, chi v5, pgx v5, testify. Sin dependencias nuevas.

**Spec:** [Apuntes/Sprints/Borrador-HU-Sprint2.md](../../../Apuntes/Sprints/Borrador-HU-Sprint2.md) (ficha HU-10). Contrato cerrado en [docs/api/openapi.yaml](../../docs/api/openapi.yaml) (`/tracking/{codigo}`, schemas `TrackingResponse`, `TrackingEvento`, ejemplo con descripciones) — **no re-diseñar, implementar lo documentado**.

## Global Constraints

- Módulo Go: `movii/api`.
- Respuesta JSON. Error: `{"error":{"code":"...","message":"..."}}`.
- **Ruta PÚBLICA**: fuera del grupo autenticado (junto a `/health`, `/auth/*`). Sin claims, sin roles.
- **Privacidad (crítica, es el corazón de la HU)**: el JSON solo lleva `codigo_guia`, `estado`, `localidad`, `actualizado_en`, `historial[{fecha, descripcion, motivo?}]`. NUNCA teléfonos, emails, dirección exacta, nombre del repartidor, comentarios internos ni actor. Doble barrera: el repo selecciona solo columnas blancas Y los tests (handler + E2E) afirman la AUSENCIA de esas keys en el JSON.
- Código inexistente → `404 no_encontrado` genérico ("no se encontró ningún envío con ese código", texto exacto del openapi). Match exacto por código, sin sugerencias (no enumerar).
- `motivo` en TrackingEvento se OMITE cuando es nil (`omitempty`, como el ejemplo del openapi que muestra items solo con fecha+descripcion).
- Tests contra Postgres local (`127.0.0.1:5433` vía `.env`), `go test ./... -p 1`, nunca en paralelo.
- Commits en español + `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. `gofmt` + `go vet` limpios. No tocar `apps/mobile` ni `apps/web`.

## Task 1: Completar eventos (crear / asignar / desasignar)

**Files:**
- Edit: `internal/services/envio_service.go` (`Create`), `internal/repository/envio_repo.go` (`AsignarEnvios`, `DesasignarEnvio`) + tests

**Interfaces:**
- `EnvioService.Create`: envolver en tx (tiene `pool` + `eventoRepo`): `Create` + `Registrar` raíz (anterior=nil, nuevo=pendiente, motivo/comentario/foto=nil, actor=nil — el handler de creación hoy no pasa actor; verificar y si hay claims disponibles usarlas, si no nil con comentario en código). Leer la implementación actual de `Create` antes (puede que ya use tx o no).
- `EnvioRepo.AsignarEnvios` (tiene tx interna + `r.pool`): dentro de la MISMA tx, por cada id asignado, `Registrar` (anterior=pendiente, nuevo=asignado, todo nil). Instanciar `EventoRepo` con `r.pool` y pasarle la tx como `Querier` (mismo package, sin cambios de firma).
- `EnvioRepo.DesasignarEnvio`: igual (anterior=asignado, nuevo=pendiente). Leer su implementación (¿tx? ¿UPDATE simple?) y mantener atomicidad.
- La descripción de cada caso vive en Task 2; acá solo persistencia.

- [x] **Paso 1: Evento raíz en `Create` + test** (detalle nuevo trae 1 evento "raíz"; tests viejos de creación en verde)
- [x] **Paso 2: Evento en `AsignarEnvios` + test** (N envíos → N eventos; tests viejos de asignación en verde)
- [x] **Paso 3: Evento en `DesasignarEnvio` + test** (idem)

## Task 2: TrackingRepo + descripciones + service

**Files:**
- Create: `internal/repository/tracking_repo.go` + `tracking_repo_test.go`
- Create: `internal/services/tracking_service.go` + `tracking_service_test.go` (unitario SIN DB para el mapeo)
- Edit: `internal/domain/envio.go` (structs)

**Interfaces:**
- Produces:
  ```go
  type TrackingEvento struct { Fecha string `json:"fecha"`; Descripcion string `json:"descripcion"`; Motivo *string `json:"motivo,omitempty"` }
  type TrackingResponse struct { CodigoGuia string `json:"codigo_guia"`; Estado string `json:"estado"`; Localidad string `json:"localidad"`; ActualizadoEn string `json:"actualizado_en"`; Historial []TrackingEvento `json:"historial"` }
  func (r *TrackingRepo) PorCodigo(ctx, codigo string) (codigoGuia, estado, localidad, creadoEn string, err error)
    // envios JOIN destinatarios WHERE codigo_guia=$1 EXACTO; sin fila → repository.ErrNoEncontrado.
    // Selecciona SOLO esas 4 columnas (código, estado, localidad, created_at UTC).
  func (r *TrackingRepo) EventosBlancos(ctx, envioID string) ([]eventoBlanco, error)
    // SELECT fecha UTC, estado_anterior, estado_nuevo, motivo de eventos_envio WHERE envio_id=$1 ORDER BY created_at;
    // SIN actor, SIN comentario, SIN foto. Slice inicializado (vacío → []).
  func describirEvento(anterior *string, nuevo string, motivo *string) string // pura:
    // anterior==nil → "Envío registrado"
    // nuevo==asignado → "Asignado a ruta de reparto"
    // nuevo==en_camino → "En camino"
    // nuevo==entregado → "Entregado"
    // nuevo==no_entregado → "No se pudo entregar: "+motivoLegible(motivo) (nil → "motivo no especificado")
    // nuevo==pendiente && anterior==no_entregado → "Reprogramado para un nuevo intento"
    // nuevo==pendiente && anterior==asignado → "Desasignado de la ruta de reparto"
    // default → "Actualización de estado"
  func motivoLegible(m string) string // cliente_ausente→"cliente ausente", direccion_incorrecta→"dirección incorrecta", rechazado→"rechazado por el destinatario", zona_insegura→"zona insegura", otro→"otro motivo"
  func (s *TrackingService) PorCodigo(ctx, codigo string) (domain.TrackingResponse, error)
    // PorCodigo + EventosBlancos → mapea a TrackingEvento (motivo tal cual, puede ser nil);
    // actualizado_en = fecha del ÚLTIMO evento, o creadoEn si no hay eventos. Sin fila → ErrNoEncontrado.
  ```

- [x] **Paso 1: Structs + repo (columnas blancas) + tests** (con seed con teléfonos/emails cargados: el struct ni siquiera tiene esos campos — garantía en tiempo de compilación)
- [x] **Paso 2: Mapeo puro + tests sin DB** (tabla: todos los casos de `describirEvento` + `motivoLegible`)
- [x] **Paso 3: `TrackingService.PorCodigo` + tests** (con eventos, sin eventos → actualizado_en=creación, inexistente)

## Task 3: Handler + ruta pública

**Files:**
- Create: `internal/handlers/tracking_handler.go` + `tracking_handler_test.go`
- Edit: `internal/httprouter/router.go` (fuera del grupo protegido) + `Deps` + `cmd/api/main.go` (construir repo+service+handler)

**Interfaces:**
- `GET /tracking/{codigo}` (código del path tal cual, sin normalizar: match exacto). 200 TrackingResponse; 404 `no_encontrado` con el mensaje exacto del openapi. Sin 401/403 (pública).
- Tests: feliz (shape exacta + ejemplo del openapi), 404 genérico (código inexistente Y código con formato raro — ambos 404, sin distinguir), **no-leak**: el JSON NO contiene las keys `telefono`, `email`, `calle`, `numero`, `actor_nombre`, `comentario`, `repartidor`, `direccion` (usar un envío del seed con esos datos cargados).

- [x] **Paso 1: Handler + ruta + wiring**
- [x] **Paso 2: Tests** (feliz + 404s + no-leak)

## Task 4: E2E + cierre

**Files:**
- Create: `tests/tracking_flow_test.go`: ciclo completo (crear → asignar → en_camino → incidencia con motivo → reprogramar → asignar → confirmar) y tras cada hito verificar el tracking: timeline con las descripciones en orden, `actualizado_en` avanzando, `localidad` correcta, y ausencia permanente de keys sensibles. Reutilizar helpers de los flow tests existentes.

- [x] **Paso 1: E2E en verde**
- [x] **Paso 2: `gofmt -l .`, `go vet ./...`, `go test ./... -p 1` en verde (2 corridas)**
- [x] **Paso 3: Horas + commits (orquestador, NO el worker)**
