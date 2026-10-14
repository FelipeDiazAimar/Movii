# API — HU-06 + HU-07 (Transiciones de estado, incidencias e historial) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer `PUT /envios/{id}/estado` (HU-06, `asignado` ⇄ `en_camino`) y `POST /envios/{id}/incidencia` (HU-07, → `no_entregado` con motivo), con historial de eventos (migración `0003`) visible en `GET /envios/{id}`. Es la base que HU-08/09/10 reutilizan: sin esto no hay eventos que mostrar ni transiciones que extender.

**Architecture:** Mismas capas que HU-01 a HU-05: `handlers → services → repository`, SQL explícito con `pgx`, sin ORM. Nuevo `EstadoService` (matriz de transiciones pura y testeable) + `repository.EventoRepo` (insertar/listar eventos, chequeo de pertenencia). Cada operación estado+evento corre en una transacción (todo o nada, como la asignación de HU-04).

**Tech Stack:** Go 1.27, chi v5, pgx v5, testify. Sin dependencias nuevas.

**Spec:** [Apuntes/Sprints/Borrador-HU-Sprint2.md](../../../Apuntes/Sprints/Borrador-HU-Sprint2.md) (fichas HU-06/HU-07 + matriz de transiciones). Contrato ya cerrado en diseño: [docs/api/openapi.yaml](../../docs/api/openapi.yaml) (`/envios/{id}/estado`, `/envios/{id}/incidencia`, schemas `EventoEnvio`, `EnvioDetalle`) — **no re-diseñar, implementar lo documentado**. Migraciones `0003_eventos` y `0004_evidencias` ya escritas en `services/api/migrations/` (este plan aplica la 0003; la 0004 la usa el plan de HU-08/09).

## Global Constraints

- Módulo Go: `movii/api`.
- Todas las respuestas HTTP son JSON. Error: `{"error":{"code":"...","message":"..."}}`.
- Roles: `repartidor` (SOLO envíos de sus rutas,Ownership por JWT vía `middleware.ClaimsFromContext` — nunca por parámetro), `operador`/`supervisor` (cualquier envío). Montar en el grupo autenticado general (los tres roles entran; la pertenencia se chequea en el service).
- Repartidor que pide un envío ajeno o inexistente → `404 no_encontrado` (genérico, no revelar existencia — igual que HU-05).
- Fechas en UTC. `created_at` del evento lo pone la base (`now()`).
- Códigos de error según openapi: `estado_invalido` (400), `motivo_invalido` / `comentario_obligatorio` / `imagen_invalida` (400), `imagen_muy_grande` (413), `transicion_invalida` (409), `no_encontrado` (404).
- Tests contra Postgres local (ver Task 0), nunca en paralelo con otra corrida: `go test ./... -p 1`.
- Listas serializan `[]` nunca `null` (lección HU-05): el historial vacío es `"historial": []`.
- Commits en español, cierran con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- `gofmt` y `go vet` limpios antes de cada commit. No tocar `apps/mobile`.

## Task 0: Entorno local + línea base verde

La API ya no apunta a Supabase en desarrollo: Postgres 17 en Docker (ver `gestion-envios/infra/docker/README.md`).

- [x] **Paso 1: Levantar la base local**
  - `cd gestion-envios/infra/docker && docker compose up -d`
  - Verificar `services/api/.env` con `DATABASE_URL=postgresql://movii:movii_dev@localhost:5432/movii?sslmode=disable` (si no existe, crearlo según el README).
- [x] **Paso 2: Aplicar migraciones 0001–0004**
  - `cd services/api && go run ./cmd/migrate up`
  - Verificar: `eventos_envio` existe y tiene el backfill (un evento raíz por envío existente).
- [x] **Paso 3: Suite base en verde**
  - `go test ./... -p 1` todo pasa antes de tocar nada. Si algo falla, arreglar el entorno primero (no es parte de las HU).

## Task 1: Dominio — EventoEnvio, motivos y errores

**Files:**
- Edit: `gestion-envios/services/api/internal/domain/envio.go` (agregar tipos)
- Create: `gestion-envios/services/api/internal/services/estado_service.go` (errores centinela + matriz; el service completo va en Task 3, acá solo la matriz pura si se prefiere incremental — ver pasos)

**Interfaces:**
- Produces:
  ```go
  type EventoEnvio struct {
      Fecha          string  `json:"fecha"`
      ActorNombre    *string `json:"actor_nombre"`
      EstadoAnterior *string `json:"estado_anterior"`
      EstadoNuevo    string  `json:"estado_nuevo"`
      Motivo         *string `json:"motivo"`
      Comentario     *string `json:"comentario"`
  }

  const (
      MotivoClienteAusente       = "cliente_ausente"
      MotivoDireccionIncorrecta  = "direccion_incorrecta"
      MotivoRechazado            = "rechazado"
      MotivoZonaInsegura         = "zona_insegura"
      MotivoOtro                 = "otro"
  )

  var ErrTransicionInvalida = errors.New(...)
  var ErrMotivoInvalido = errors.New(...)
  var ErrComentarioObligatorio = errors.New(...) // motivo "otro" sin comentario
  ```

- [x] **Paso 1: Agregar `EventoEnvio` + consts de motivo a `domain/envio.go`**
- [x] **Paso 2: Matriz de transiciones de HU-06 como función pura**
  - `map[string][]string{ asignado: {en_camino}, en_camino: {asignado} }` (este plan; HU-08/09 agregan salidas en sus planes).
  - Función `transicionValida(origen, destino string) bool` + test unitario sin DB (tabla: todos los pares válidos/inválidos, incluyendo `entregado`/`no_entregado` como destino → false).

## Task 2: Repository — eventos y pertenencia

**Files:**
- Create: `gestion-envios/services/api/internal/repository/evento_repo.go`
- Create: `gestion-envios/services/api/internal/repository/evento_repo_test.go`

**Interfaces:**
- Consumes: `domain.EventoEnvio`, `Querier` (para correr dentro de tx).
- Produces:
  ```go
  func (r *EventoRepo) Registrar(ctx, q Querier, envioID string, anterior *string, nuevo string, motivo *string, comentario *string, actorID *string) error
  func (r *EventoRepo) ListarPorEnvio(ctx, envioID string) ([]domain.EventoEnvio, error) // JOIN usuarios para actor_nombre, ORDER BY created_at; slice inicializado (nunca nil)
  func (r *EventoRepo) EsDelRepartidor(ctx, envioID, repartidorID string) (bool, error)
    // EXISTS (envios JOIN rutas ON ruta_id WHERE e.id=$1 AND r.repartidor_id=$2)
    // Decisión Sprint 2: pertenencia = CUALQUIERA de sus rutas (sin filtro de fecha).
    // El "del día" lo gobierna el listado HU-05; acá el guard es no tocar envíos ajenos.
  ```

- [x] **Paso 1: `Registrar` con `INSERT` (actor/motivo/comentario/anterior nullables)**
- [x] **Paso 2: `ListarPorEnvio` con `LEFT JOIN usuarios` + `to_char(... UTC ...)` igual que `EnvioRepo.List`**
- [x] **Paso 3: `EsDelRepartidor`**
- [x] **Paso 4: Tests contra DB local** (registrar y listar incl. actor NULL; lista vacía → `[]`; pertenencia true/false)

## Task 3: Service — CambiarEstado + RegistrarIncidencia

**Files:**
- `gestion-envios/services/api/internal/services/estado_service.go` (completar)
- Create: `.../estado_service_test.go`

**Interfaces:**
- Consumes: `EnvioRepo` (leer estado actual + UPDATE), `EventoRepo`, `pool` (tx).
- Produces:
  ```go
  type EstadoService struct { pool *pgxpool.Pool; envios *repository.EnvioRepo; eventos *repository.EventoRepo }
  func (s *EstadoService) CambiarEstado(ctx, envioID, nuevo, actorID, rol string) (domain.Envio, error)
    // 1. Lee envío (no existe → repository.ErrNoEncontrado).
    // 2. Si rol == repartidor y !EsDelRepartidor → ErrNoEncontrado (404 genérico).
    // 3. Si !transicionValida(actual, nuevo) → ErrTransicionInvalida.
    //    Si nuevo es entregado/no_entregado, el mensaje indica el endpoint correcto (HU-08/HU-07).
    // 4. Tx: UPDATE estado + Registrar evento (actor). Commit.
  func (s *EstadoService) RegistrarIncidencia(ctx, envioID, motivo, comentario string, foto []byte, actorID, rol string) (domain.Envio, error)
    // 1-2 igual. 3. Motivo en lista cerrada → si no, ErrMotivoInvalido.
    // 4. motivo==otro y comentario vacío → ErrComentarioObligatorio.
    // 5. Actual ∈ {asignado, en_camino} → si no, ErrTransicionInvalida.
    // 6. Foto: este plan la ACEPTA y valida (≤5MB, magic bytes JPEG/PNG → si no, ErrImagenInvalida/ErrImagenMuyGrande)
    //    pero la PERSISTE el plan HU-08/09 (tabla confirmaciones la crea la 0004 para entregas).
    //    Decisión: guardar foto de incidencia en eventos_envio.comentario? NO — columna nueva rompería 0003 aplicada.
    //    Alternativa de este plan: la foto de incidencia se guarda en confirmaciones_entrega con receptor_nombre='(incidencia)'? NO — sucio.
    //    Resolución: HU-07 con foto queda pendiente del mecanismo HU-08 (el CA-03 del borrador ya la marca opcional).
    //    Este plan implementa incidencia SIN foto (motivo+comentario); el plan HU-08/09 agrega la columna/foto si se decide.
  ```
  > NOTA: la foto de incidencia (CA-03 HU-07, opcional) se resuelve en el plan HU-08/09 una vez exista el mecanismo de imágenes. Este plan no la implementa; el endpoint la rechaza con `imagen_no_soportada` (400) si se envía, para no aceptarla en silencio. (Ajustar openapi en ese plan.)

- [x] **Paso 1: `CambiarEstado` + tests** (camino feliz ambas direcciones, transición inválida, repartidor ajeno → NoEncontrado, operador sobre cualquiera OK)
- [x] **Paso 2: `RegistrarIncidencia` + tests** (motivo válido, motivo inválido, otro sin comentario, estado final → TransicionInvalida, evento con motivo persistido)
- [x] **Paso 3: UPDATE de estado como método del `EnvioRepo`** (`ActualizarEstado(ctx, q, envioID, nuevo)`) — q = tx

## Task 4: Handlers + rutas + wiring

**Files:**
- Create: `gestion-envios/services/api/internal/handlers/estado_handler.go` (usa `EstadoService`; lee claims; mapea centinelas a códigos HTTP del openapi)
- Edit: `.../httprouter/router.go` (grupo autenticado general: `PUT /envios/{id}/estado`, `POST /envios/{id}/incidencia`)
- Edit: `gestion-envios/services/api/internal/httprouter/router.go` Deps + `cmd/api/main.go` (construir `EstadoService` + handler)
- Tests de handlers con `httptest` (patrón de `envio_handler_test.go`)

- [x] **Paso 1: `EstadoHandler` con mapeo de errores** (tabla centinela→status+code según openapi)
- [x] **Paso 2: Rutas + Deps + main**
- [x] **Paso 3: Tests** (feliz + 400 + 404 repartidor ajeno + 409 por estado; al menos un error por endpoint)

## Task 5: Historial en el detalle

**Files:**
- Edit: `repository.EnvioRepo.GetByID` o nuevo método `GetDetalle` que sume `historial []domain.EventoEnvio` (vía `EventoRepo.ListarPorEnvio`)
- Edit: `services.EnvioService.GetByID` → devuelve `domain.EnvioDetalle` (nuevo struct: `EnvioConDetalle` + `Historial []EventoEnvio`; `reprogramado_para`/`franja`/`confirmacion` los agregan planes siguientes)
- Tests: detalle con eventos y sin eventos (`"historial": []`)

- [x] **Paso 1: `EnvioDetalle` en dominio + cableado repo/service/handler**
- [x] **Paso 2: Tests** (el `GET /envios/{id}` existente sigue pasando: campos nuevos son aditivos)

## Task 6: E2E + cierre

**Files:**
- Create: `gestion-envios/services/api/tests/seguimiento_flow_test.go` (login repartidor → en_camino → incidencia con motivo → 409 al reintentar cambio; login operador → en_camino de otro envío OK)

- [x] **Paso 1: E2E en verde**
- [x] **Paso 2: `gofmt -l .`, `go vet ./...`, `go test ./... -p 1` completos en verde**
- [x] **Paso 3: Registrar horas reales de la tarea (planilla cátedra) + commit(s) en español con trailer**
