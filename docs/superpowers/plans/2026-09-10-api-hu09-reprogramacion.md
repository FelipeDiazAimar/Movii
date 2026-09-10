# API — HU-09 (Reprogramación de entregas fallidas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer `POST /envios/{id}/reprogramacion` (solo sobre `no_entregado`): el envío vuelve a `pendiente` para una nueva fecha + franja, con evento en el historial, y aparece en `GET /envios?fecha=<nueva>`. Cierra el loop que HU-07 dejó abierto (un `no_entregado` hoy no tiene salida).

**Architecture:** Mismas capas que HU-06/07: `handlers → services → repository`, SQL explícito con `pgx`, sin ORM. Se reutilizan `EstadoService`, `EventoRepo` y `EstadoHandler` (la reprogramación es una transición más, con endpoint propio). Tx todo-o-nada: UPDATE + evento.

**Tech Stack:** Go 1.27, chi v5, pgx v5, testify. Sin dependencias nuevas.

**Spec:** [Apuntes/Sprints/Borrador-HU-Sprint2.md](../../../Apuntes/Sprints/Borrador-HU-Sprint2.md) (ficha HU-09 + matriz). Contrato ya cerrado: [docs/api/openapi.yaml](../../docs/api/openapi.yaml) (`/envios/{id}/reprogramacion`, schemas `ReprogramacionRequest`, `FranjaHoraria`, `EnvioDetalle`, filtro `fecha` de `GET /envios`) — **no re-diseñar, implementar lo documentado**. Migración `0004` (columnas `reprogramado_para`/`franja`) ya aplicada.

## Global Constraints

- Módulo Go: `movii/api`.
- Todas las respuestas HTTP son JSON. Error: `{"error":{"code":"...","message":"..."}}`.
- Roles: `repartidor` (SOLO envíos de sus rutas, ownership por JWT vía `middleware.ClaimsFromContext` — nunca por parámetro), `operador`/`supervisor` (cualquier envío). Montar en el grupo autenticado general (los tres roles entran; sin `RequireRole`, igual que `/estado` e `/incidencia`).
- Repartidor que pide un envío ajeno o inexistente → `404 no_encontrado` (genérico, igual que HU-05/06/07).
- Fechas en UTC. "Hoy" = fecha actual en UTC. `nueva_fecha` formato estricto `YYYY-MM-DD` (cero-padeado; `time.Parse("2006-01-02")` lo garantiza).
- Códigos de error según openapi: `body_invalido` (400, JSON malformado o campos requeridos ausentes/vacíos), `fecha_invalida` (400, mal formato o pasada), `franja_invalida` (400), `transicion_invalida` (409, no está en `no_entregado`), `no_encontrado` (404).
- Tests contra Postgres local (`127.0.0.1:5433` vía `.env`, no cambiar), nunca en paralelo: `go test ./... -p 1`.
- Listas serializan `[]` nunca `null`.
- `PUT /envios/{id}/estado` NO debe permitir `no_entregado → pendiente` por su vocabulario (`estado_invalido` filtra antes); la matriz compartida puede crecer sin romperlo (ver Task 1).
- Commits en español, cierran con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- `gofmt` y `go vet` limpios antes de cada commit. No tocar `apps/mobile` ni `apps/web` (este plan es solo API; la web va después).
- NOTA (no implementar, solo saber): el 200 del openapi devuelve schema `Envio` base (sin `reprogramado_para` visible); la web re-lee el detalle. Si se quiere devolver el detalle, ajustar el openapi primero.

## Task 1: Dominio + repository

**Files:**
- Edit: `internal/domain/envio.go` (consts de franja)
- Edit: `internal/services/estado_service.go` (matriz + 2 centinelas nuevos)
- Edit: `internal/services/estado_service_test.go` (matriz: agregar caso válido)
- Edit: `internal/repository/envio_repo.go` (`Reprogramar`, `ReprogramacionDe`, `AsignarEnvios`, `List`)
- Create: `internal/repository/envio_repo_reprogramacion_test.go`

**Interfaces:**
- Produces:
  ```go
  const ( FranjaManana = "manana"; FranjaTarde = "tarde"; FranjaNoche = "noche" ) // = enum franja_horaria (0004) y FranjaHoraria del openapi
  var ErrFechaInvalida = errors.New(...)   // → 400 fecha_invalida
  var ErrFranjaInvalida = errors.New(...)  // → 400 franja_invalida
  func (r *EnvioRepo) Reprogramar(ctx, q Querier, envioID, fechaYYYYMMDD, franja string) error
    // UPDATE envios SET estado='pendiente', reprogramado_para=$2::date, franja=$3::franja_horaria, ruta_id=NULL
    //   WHERE id=$1::uuid; 0 filas → ErrNoEncontrado.
    //   ruta_id=NULL: un pendiente no pertenece a ninguna ruta (igual que DesasignarEnvio;
    //   evita que el envío aparezca con una ruta vieja en listados del día).
  func (r *EnvioRepo) ReprogramacionDe(ctx, envioID string) (para *string, franja *string, err error)
    // SELECT to_char(reprogramado_para,'YYYY-MM-DD'), franja::text ...; NULL → nil.
    // Envío inexistente → ErrNoEncontrado. (La usa EnvioService.GetByID en Task 4;
    //  método chico para no cambiar la firma de GetByID que usan muchos llamadores.)
  ```

- [x] **Paso 1: Matriz += `no_entregado: {pendiente}`** en `transicionesValidas` + agregar el caso a `TestTransicionValida` (si el test actual lo afirma como inválido, actualizarlo: el plan HU-06/07 ya preveía que HU-09 agrega salidas).
- [x] **Paso 2: Consts `Franja*` + centinelas `ErrFechaInvalida`/`ErrFranjaInvalida`**
- [x] **Paso 3: `Reprogramar`** (UPDATE con los 4 SET + `::date`/`::franja_horaria`; 0 filas → `ErrNoEncontrado`) + test (feliz verificando estado/fecha/franja/ruta_id NULL + inexistente)
- [x] **Paso 4: `ReprogramacionDe`** + test (con datos / sin datos → nil,nil / inexistente)
- [x] **Paso 5: `AsignarEnvios` limpia reprogramación** — el UPDATE suma `, reprogramado_para=NULL, franja=NULL` (lo exige el comentario de la 0004 y el openapi: "al asignarse a una ruta, la fecha de la ruta manda y se limpian"). + test (asignar un reprogramado deja las columnas en NULL). Los tests existentes de asignación deben seguir pasando.
- [x] **Paso 5: Filtro `fecha` de `List` incluye reprogramación** — `AND ($2='' OR e.created_at::date=$2::date OR e.reprogramado_para=$2::date)`. Es OR aditivo: los tests existentes de List (incl. caso vacío) deben seguir pasando. + test (reprogramado aparece en su nueva fecha).

## Task 2: Service — Reprogramar

**Files:**
- Edit: `internal/services/estado_service.go` (método `Reprogramar` + test en archivo nuevo `estado_service_reprogramar_test.go`, o extender el de tx si el worker lo ve mejor — un solo archivo de tests nuevo, no dos)

**Interfaces:**
- Consumes: `EnvioRepo` (`GetByID`, `Reprogramar`), `EventoRepo` (`EsDelRepartidor`, `Registrar`), `pool` (tx).
- Produces:
  ```go
  func (s *EstadoService) Reprogramar(ctx, envioID, nuevaFecha, franja, actorID, rol string) (domain.Envio, error)
    // 1. Lee envío (no existe → repository.ErrNoEncontrado).
    // 2. Si rol == repartidor (domain.RolRepartidor) y !EsDelRepartidor → ErrNoEncontrado (404 genérico).
    // 3. Valida fecha: time.Parse("2006-01-02", nuevaFecha) error → ErrFechaInvalida;
    //    fecha < hoy-UTC (comparar truncado a día) → ErrFechaInvalida. Hoy vale ("futura o de hoy").
    // 4. Franja ∈ {manana, tarde, noche} (consts domain.Franja*) → si no, ErrFranjaInvalida.
    // 5. transicionValida(actual, EstadoEnvioPendiente) → si no, ErrTransicionInvalida
    //    (con la matriz extendida esto equivale a exigir actual==no_entregado; envolver con %w).
    // 6. Tx: Reprogramar + Registrar evento (anterior=no_entregado, nuevo=pendiente,
    //    motivo=nil, comentario="reprogramado para {fecha} ({franja})", actor). Commit.
    //    Devuelve domain.Envio (seguir el patrón de CambiarEstado/RegistrarIncidencia de Task 3).
  ```

- [x] **Paso 1: `Reprogramar` + tests** (feliz: estado pendiente + columnas + evento con comentario; repartidor ajeno → NoEncontrado sin cambios; inexistente → NoEncontrado; fecha pasada / formato malo → FechaInvalida; franja mala → FranjaInvalida; estado asignado/en_camino/pendiente → TransicionInvalida via errors.Is; hoy vale)

## Task 3: Handler + ruta

**Files:**
- Edit: `internal/handlers/estado_handler.go` (método `Reprogramar`; el struct/servicio ya están cableados — NO tocar `main.go` ni `Deps`)
- Edit: `internal/httprouter/router.go` (una línea: `protected.Post("/envios/{id}/reprogramacion", ...)` en el grupo general)
- Create: `internal/handlers/estado_handler_reprogramar_test.go` (o extender el test de Task 4 si es más natural — un solo archivo)

**Interfaces:**
- Request: `{nueva_fecha: string, franja: string}` (ambos requeridos). Ausentes o vacíos o JSON malformado → 400 `body_invalido` (el handler valida presencia; el service valida valores).
- Mapeo (errors.Is): `ErrFechaInvalida`→400 `fecha_invalida`; `ErrFranjaInvalida`→400 `franja_invalida`; `ErrTransicionInvalida`→409 `transicion_invalida`; `repository.ErrNoEncontrado`→404 `no_encontrado`. Claims faltantes → 401 (igual que Task 4).
- Respuesta 200: el envío (schema `Envio` del openapi — seguir lo que hace `CambiarEstado`).

- [x] **Paso 1: `EstadoHandler.Reprogramar` + ruta**
- [x] **Paso 2: Tests** (feliz + 400 body + 400 fecha + 400 franja + 404 repartidor ajeno + 409 no-no_entregado; reutilizar la técnica de claims de los tests de Task 4)

## Task 4: Detalle + E2E + cierre

**Files:**
- Edit: `internal/domain/envio.go` (`EnvioDetalle` suma `ReprogramadoPara *string \`json:"reprogramado_para"\`` + `Franja *string \`json:"franja"\``; nil → null, igual que el resto. NO agregar `confirmacion`: es de HU-08)
- Edit: `internal/services/envio_service.go` (`GetByID` puebla ambos vía `ReprogramacionDe`; sin datos → nulls)
- Create: `tests/reprogramacion_flow_test.go` — E2E: login repartidor → incidencia (no_entregado) → reprogramar (200, pendiente, `reprogramado_para`/`franja` en detalle) → aparece en `GET /envios?fecha=<nueva>` → asignar a ruta limpia las columnas → 409 al reprogramar un asignado → 400 fecha pasada → login operador reprograma envío ajeno OK
- Tests de detalle: con reprogramación (campos presentes) y sin (nulls); los tests existentes de `GET /envios/{id}` siguen pasando (aditivo).

- [x] **Paso 1: Campos en `EnvioDetalle` + `GetByID` + tests**
- [x] **Paso 2: E2E en verde**
- [x] **Paso 3: `gofmt -l .`, `go vet ./...`, `go test ./... -p 1` completos en verde**
- [x] **Paso 4: Registrar horas reales + commit(s) en español con trailer (lo hace el orquestador, NO el worker)**
