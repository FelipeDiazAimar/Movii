# API — HU-08 (Confirmación de entrega con firma y foto) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer `POST /envios/{id}/confirmacion` (→ `entregado` terminal, con evidencia auditable) + `GET /envios/{id}/confirmacion/firma` y `/foto` (binarios) + metadata en `GET /envios/{id}`. Además cierra el pendiente de HU-07: la foto de incidencia (Task 5, con migración `0005`).

**Architecture:** Mismas capas: `handlers → services → repository`, SQL explícito con `pgx`, sin ORM. Nuevo `ConfirmacionRepo` (tabla `confirmaciones_entrega` de la migración `0004`, ya aplicada). Imágenes: base64 en el JSON → BYTEA en la base (decisión Sprint 2 documentada en la 0004, vale igual en local y Supabase). Tx todo-o-nada: UPDATE estado + evidencia + evento(s).

**Tech Stack:** Go 1.27, chi v5, pgx v5, testify. Sin dependencias nuevas.

**Spec:** [Apuntes/Sprints/Borrador-HU-Sprint2.md](../../../Apuntes/Sprints/Borrador-HU-Sprint2.md) (ficha HU-08 + matriz). Contrato cerrado en [docs/api/openapi.yaml](../../docs/api/openapi.yaml) (`/envios/{id}/confirmacion`, `/firma`, `/foto`, schemas `ConfirmacionRequest`, `ConfirmacionMetadata`, `RelacionReceptor`, `EnvioDetalle.confirmacion`; `IncidenciaRequest.foto_base64` para Task 5) — **no re-diseñar, implementar lo documentado**.

## Global Constraints

- Módulo Go: `movii/api`.
- Respuestas JSON salvo los binarios (firma = `image/png`, foto = `image/jpeg` puros). Errores: `{"error":{"code":"...","message":"..."}}`.
- Roles POST: `repartidor` (SOLO envíos de sus rutas, JWT vía `middleware.ClaimsFromContext`), `operador`/`supervisor` (cualquiera). Grupo autenticado general. Repartidor ajeno/inexistente → `404 no_encontrado`.
- Roles GET firma/foto: autenticado cualquier rol **+ mismo guard de pertenencia para repartidor** (desviación consciente del openapi, que dice "cualquier rol" sin matizar: ver fotos de entregas ajenas sería un hueco de privacidad inconsistente con todos los demás endpoints; documentado acá a propósito).
- Códigos según openapi: `body_invalido` (400, JSON malformado), `evidencia_incompleta` (400, falta receptor/firma/foto), `relacion_invalida` (400), `imagen_invalida` (400, base64 malformado o magic bytes incorrectos), `transicion_invalida` (409, no está en `asignado`/`en_camino`), `no_encontrado` (404), `imagen_muy_grande` (413, >5 MB decodificados por imagen).
- Límites: 5 MB = `5*1024*1024` bytes por imagen (firma y foto por separado). Magic bytes: PNG `89 50 4E 47 0D 0A 1A 0A` (firma), JPEG `FF D8 FF` (foto).
- `PUT /envios/{id}/estado` sigue sin poder llegar a `entregado` (su vocabulario filtra antes); la matriz puede crecer (ver Task 1).
- Tests contra Postgres local (`127.0.0.1:5433` vía `.env`), `go test ./... -p 1`, nunca en paralelo.
- Commits en español + `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. `gofmt` + `go vet` limpios. No tocar `apps/mobile` ni `apps/web`.

## Task 1: Dominio + ConfirmacionRepo + matriz

**Files:**
- Edit: `internal/domain/envio.go` (consts relación + struct Confirmacion + metadata)
- Create: `internal/repository/confirmacion_repo.go` + `confirmacion_repo_test.go`
- Edit: `internal/services/estado_service.go` (matriz + centinelas) + `estado_service_test.go` (casos nuevos)

**Interfaces:**
- Produces:
  ```go
  const ( RelacionDestinatario="destinatario"; RelacionFamiliar="familiar"; RelacionVecino="vecino"; RelacionEncargado="encargado" )
  var ErrEvidenciaIncompleta, ErrRelacionInvalida, ErrImagenInvalida, ErrImagenMuyGrande // (los dos últimos los reutiliza Task 5)
  const MaxImagenBytes = 5 * 1024 * 1024
  type Confirmacion struct { EnvioID, ReceptorNombre, ReceptorRelacion string; Firma, Foto []byte; ConfirmadaPor *string; ConfirmadaAt string /* to_char UTC como eventos */ }
  type ConfirmacionMetadata struct { ReceptorNombre string `json:"receptor_nombre"`; ReceptorRelacion string `json:"receptor_relacion"`; ConfirmadaAt string `json:"confirmada_at"`; FirmaURL string `json:"firma_url"`; FotoURL string `json:"foto_url"` }
  func (r *ConfirmacionRepo) Guardar(ctx, q Querier, c domain.Confirmacion) error
    // INSERT (PK envio_id: segunda confirmación → error de constraint; el service chequea estado antes, esto es red de seguridad)
  func (r *ConfirmacionRepo) Obtener(ctx, envioID string) (domain.Confirmacion, error)
    // SELECT ...; sin fila → repository.ErrNoEncontrado (sirve al detalle y a los binarios)
  ```

- [x] **Paso 1: Consts + structs + centinelas** (metadata SIN bytes; las URLs se construyen en Task 4 como `/envios/{id}/confirmacion/firma|foto`)
- [x] **Paso 2: Matriz += `asignado: {en_camino, entregado}`, `en_camino: {asignado, entregado}`** + casos en `TestTransicionValida`
- [x] **Paso 3: `ConfirmacionRepo` + tests** (guardar/obtener roundtrip con bytes reales mínimos —PNG de 1px y JPEG mínimo inline como `[]byte{...}`—, inexistente → NoEncontrado)

## Task 2: Service — ConfirmarEntrega

**Files:**
- Edit: `internal/services/estado_service.go` + create `estado_service_confirmar_test.go`

**Interfaces:**
- Produces:
  ```go
  func (s *EstadoService) ConfirmarEntrega(ctx, envioID, receptorNombre, receptorRelacion string, firma, foto []byte, actorID, rol string) (domain.Envio, error)
    // 1. Lee envío (→ ErrNoEncontrado). 2. Guard repartidor (→ ErrNoEncontrado).
    // 3. receptorNombre en blanco (TrimSpace) o firma/foto vacías → ErrEvidenciaIncompleta.
    // 4. Relacion ∉ consts → ErrRelacionInvalida.
    // 5. len(firma)>Max / len(foto)>Max → ErrImagenMuyGrande.
    // 6. Magic bytes (firma PNG, foto JPEG) → si no, ErrImagenInvalida.
    //    (Los []byte YA vienen decodificados: el base64 lo valida el handler, Task 3.)
    // 7. actual ∈ {asignado, en_camino} → si no, ErrTransicionInvalida (%w).
    // 8. Tx: ActualizarEstado(entregado) + ConfirmacionRepo.Guardar (confirmada_por=actorID)
    //    + evento(s): si actual==asignado, DOS eventos (asignado→en_camino con comentario
    //    "paso por en_camino (confirmación directa)", luego en_camino→entregado);
    //    si en_camino, UN evento. Commit. Devuelve domain.Envio (patrón Task 3).
  ```

- [x] **Paso 1: `ConfirmarEntrega` + tests** (feliz desde en_camino; feliz desde asignado con 2 eventos; operador ajeno OK; repartidor ajeno/inexistente; incompleta ×3; relación mala; PNG-con-JPEG y viceversa; >5MB (construir slice, no archivo); entregado/no_entregado/pendiente → 409; errors.Is + no-cambios en errores)

## Task 3: Handler + rutas + wiring

**Files:**
- Edit: `internal/handlers/estado_handler.go` (`Confirmar`, `DescargarFirma`, `DescargarFoto`)
- Edit: `internal/httprouter/router.go` (3 líneas, grupo general)
- Edit: `cmd/api/main.go` + `Deps` (construir `ConfirmacionRepo`; `EstadoService` necesita el repo nuevo → **cambia `NewEstadoService`: actualizar TODOS sus llamadores** — buscar con grep: main + tests)
- Create: `internal/handlers/estado_handler_confirmar_test.go`

**Interfaces:**
- POST body `{receptor_nombre, receptor_relacion, firma_base64, foto_base64}` (todos requeridos en presencia; ausentes/vacíos/JSON malo → 400 `body_invalido`; el CONTENIDO lo valida el service). `firma_base64`/`foto_base64` con base64 malformado → 400 `imagen_invalida` (el handler decodifica; el service recibe bytes).
- Mapeo: `ErrEvidenciaIncompleta`→400 `evidencia_incompleta`; `ErrRelacionInvalida`→400 `relacion_invalida`; `ErrImagenInvalida`→400 `imagen_invalida`; `ErrImagenMuyGrande`→413 `imagen_muy_grande`; `ErrTransicionInvalida`→409; `ErrNoEncontrado`→404. 200: el envío.
- GETs: `w.Header().Set("Content-Type", "image/png"|"image/jpeg")`, `w.Write(bytes)`; claims obligatorias (401); repartidor con guard de pertenencia vía service (404 genérico); sin confirmación → 404 `no_encontrado` (envelope JSON, NO binario).

- [x] **Paso 1: Constructor + main + Deps + 3 rutas**
- [x] **Paso 2: Los 3 métodos del handler**
- [x] **Paso 3: Tests** (POST feliz + 400s + 409 + 404 + 413 con payload >5MB generado en memoria; GETs: content-type + bytes idénticos a los guardados, 404 sin confirmación, 404 repartidor ajeno)

## Task 4: Metadata en el detalle

**Files:**
- Edit: `internal/domain/envio.go` (`EnvioDetalle` suma `Confirmacion *ConfirmacionMetadata \`json:"confirmacion"\``; nil → null)
- Edit: `internal/services/envio_service.go` (`GetByID`: si `ConfirmacionRepo.Obtener` da fila, mapea a metadata con URLs; si `ErrNoEncontrado`, nil — NO es error)
- `EnvioService` necesita el `ConfirmacionRepo`: agregarlo al constructor (actualizar llamadores con grep, igual que Task 3).

- [x] **Paso 1: Campo + `GetByID` + tests** (con confirmación: metadata con URLs correctas; sin: null; tests viejos del detalle en verde)

## Task 5: Foto de incidencia HU-07 (cierra el pendiente)

**Files:**
- Create: `migrations/0005_incidencia_foto.up.sql` + `.down.sql`:
  ```sql
  -- up: ALTER TABLE eventos_envio ADD COLUMN foto BYTEA;
  -- down: ALTER TABLE eventos_envio DROP COLUMN foto;
  ```
  (Nullable, sin backfill: NULL = sin foto. Vale igual en Supabase cuando se aplique allá.)
- Edit: `internal/repository/evento_repo.go` (`Registrar` acepta `foto []byte` — nil → NULL; actualizar tests/lamadores: `CambiarEstado`, `Reprogramar`, `ConfirmarEntrega` pasan nil)
- Edit: `internal/services/estado_service.go` (`RegistrarIncidencia` recibe la foto y la persiste; **se elimina el rechazo `ErrImagenNoSoportada`** — validación: JPEG magic bytes → `ErrImagenInvalida`, >5MB → `ErrImagenMuyGrande`; el tipo queda para compatibilidad pero sin uso... mejor: eliminarlo y ajustar su único test de Task 4/HU-06/07 que lo cubría)
- Edit: `internal/handlers/estado_handler.go` (incidencia: `foto_base64` ausente → nil; presente → decodifica, base64 malo → 400 `imagen_invalida`)
- El openapi YA documenta `foto_base64` + `imagen_invalida`/`imagen_muy_grande` en incidencia: **no hay que tocarlo** (verificar que `imagen_no_soportada` no figure en ningún lado; si figura, quitarlo).

- [x] **Paso 1: Migración 0005 + aplicar (`go run ./cmd/migrate up`)**
- [x] **Paso 2: Repo + service + handler + tests** (incidencia con foto roundtrip: se persiste y el evento la referencia; sin foto sigue igual; tests viejos de incidencia en verde)

## Task 6: E2E + cierre

**Files:**
- Create: `tests/confirmacion_flow_test.go`: repartidor en_camino → confirmar (200 entregado, metadata en detalle, firma/foto descargables byte-idénticos) → reconfirmar 409 → confirmar directo desde asignado (2 eventos) → operador OK → incidencia con foto (Task 5) roundtrip.

- [x] **Paso 1: E2E en verde**
- [x] **Paso 2: `gofmt -l .`, `go vet ./...`, `go test ./... -p 1` en verde (2 corridas)**
- [x] **Paso 3: Horas + commits (orquestador, NO el worker)**
