# API+Web — HU-07 cierre (ver foto de incidencia) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La foto de incidencia hoy se guarda pero nadie la ve. Agregar `GET /envios/{id}/eventos/{eventoId}/foto` (JPEG autenticado, por evento porque un envío puede tener varias incidencias) + flag `tiene_foto` en el historial + botón "Ver foto" en el timeline web. Espeja el patrón de firma/foto de HU-08.

**Tech Stack:** Go 1.27 + React 19/TS. Sin dependencias nuevas.

**Spec:** openapi.yaml (hay que AGREGAR `tiene_foto` al schema `EventoEnvio` — aditivo; el resto ya documenta foto_base64 en incidencia).

## Global Constraints

- Error: `{"error":{"code":"...","message":"..."}}`. Tests `-p 1`, nunca en paralelo.
- Guard repartidor (JWT, 404 genérico) igual que los binarios de HU-08. Tracking NO expone foto (público; sin cambios).
- `tiene_foto: boolean` (nunca null) en `EventoEnvio` JSON; `TrackingEvento` sin cambios.
- Commits en español + trailer (orquestador). `gofmt`/`vet`/lint limpios. No tocar mobile.

## Task 1: API

**Files:** `repository/evento_repo.go` (+test), `services/estado_service.go` (+test), `handlers/estado_handler.go` (+test), `httprouter/router.go`, `domain/envio.go` (`TieneFoto`), `docs/api/openapi.yaml` (schema `EventoEnvio` += `tiene_foto`; path del nuevo GET con sus 401/404).

- `EventoRepo.ObtenerFoto(ctx, eventoID) (foto []byte, envioID string, err error)`: SELECT foto, envio_id; sin fila o foto NULL → `ErrNoEncontrado`.
- `ListarPorEnvio` suma `(foto IS NOT NULL) AS tiene_foto` → `EventoEnvio.TieneFoto bool`.
- `EstadoService.ObtenerFotoIncidencia(ctx, envioID, eventoID, actorID, rol)`: guard repartidor (`EsDelRepartidor(envioID)` → NoEncontrado) + `ObtenerFoto` + verificar `fotoEnvioID == envioID` (mismatch → NoEncontrado).
- Handler `DescargarFotoIncidencia`: claims→401; bytes `image/jpeg`; errores→404 `no_encontrado` JSON. Ruta `protected.Get("/envios/{id}/eventos/{eventoId}/foto", ...)` en grupo general.
- Tests: repo (con/sin foto, inexistente), service (feliz, null→404, mismatch envío, repartidor ajeno), handler (content-type + bytes, 404s, 401).

- [x] **Paso 1: Repo + `tiene_foto` en historial + tests**
- [x] **Paso 2: Service + handler + ruta + openapi + tests**

## Task 2: Web

**Files:** `features/envios/types.ts` (`EventoEnvio` += `tiene_foto: boolean`), `HistorialTimeline.tsx` (+test), `api.ts` (descarga blob).

- Item de incidencia (motivo no-null) con `tiene_foto` → botón "Ver foto" (descarga blob `image/jpeg` con auth, objectURL, toggle, revoke; mismo patrón que evidencia HU-08). `TrackingEvento` no trae el flag → sin botón en tracking.
- El backend devuelve `tiene_foto` siempre (false por defecto en eventos viejos) — tiparlo requerido, no opcional.

- [x] **Paso 1: Flag + botón + tests**
- [x] **Paso 2: `npm test` + `lint` + `build` en verde (solo web)**

## Task 3: Cierre (orquestador)

- [x] Suite Go completa + commit(s) + AGENTS.md
