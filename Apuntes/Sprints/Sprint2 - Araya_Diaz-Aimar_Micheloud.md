# Sprint 2 — Trabajo Final Integrador

## Sistema de Gestión de Envíos y Distribución — Movii

---

**UTN — Facultad Regional San Francisco**

**Cátedra:** Ingeniería y Calidad del Software

**Docentes:** Gandino, Diego · Saldarini, Javier Daniel

**Grupo N° 7:** Araya, Ulises · Díaz Aimar, Felipe · Micheloud, Jeremías

**Duración del Sprint:** 14 días (10/09/2026 – 24/09/2026)

**Presentación del Backlog:** Jueves 10/09/2026 · **Presentación del Sprint:** Jueves 24/09/2026 (prevista, deadline autoimpuesto)

> **Nota de estado (informe redactado el 10/09/2026):** este documento se escribe con el sprint en curso. La parte de API + web (Araya) está implementada y verificada al 100 % (HU-06 a HU-10, suites en verde); la parte móvil (Díaz Aimar) está pendiente. Las secciones 4, 6, 7 y 9 lo indican HU por HU. Al cierre del sprint se completan las columnas Real, el burndown y la retrospectiva definitiva.

---

## 1. Objetivo del Sprint

Implementar el seguimiento completo del ciclo de vida del envío: transiciones de estado durante el reparto, incidencias con motivo y foto, reprogramación de fallidas, confirmación con evidencia auditable y tracking público, con su reflejo en la web operativa y en la app móvil.

> **Meta:** Al finalizar el sprint, un repartidor podrá avanzar, fallar, confirmar y reprogramar entregas desde el móvil; el operador lo gestionará desde la web; y el cliente final podrá consultar el estado de su paquete por código de guía sin llamar a la empresa.

**Reparto por interfaz:** HU-06, HU-07 y HU-09 se implementan en **web y móvil** (mismo endpoint, distinta interfaz). HU-08 se confirma desde la **app móvil** (firma + foto) y se visualiza en la **web** (en la web no hay formulario de confirmación: la evidencia queda visible en el detalle). HU-10 se implementa en la **API pública** y en la **página pública `/tracking` de la web**. Todas las interfaces consumen la misma API y comparten la base de datos. El stack de cada parte está en el documento de Sprint 0 y en la sección 6 de este informe.

---

## 2. Product Backlog priorizado

| ID    | Historia de Usuario                         | Prioridad | Valor | SP | Sprint      |
| ----- | ------------------------------------------- | --------- | :---: | :-: | ----------- |
| HU-01 | Registro y autenticación de usuarios       | Muy Alta  |   8   |  8 | ✅ Sprint 1 |
| HU-02 | Registro de envíos                         | Muy Alta  |   8   |  5 | ✅ Sprint 1 |
| HU-03 | Gestión de rutas diarias                   | Alta      |   5   |  5 | ✅ Sprint 1 |
| HU-04 | Asignación de envíos a ruta                | Alta      |   5   |  5 | ✅ Sprint 1 |
| HU-05 | Listado de envíos del día para repartidor | Alta      |   5   |  3 | ✅ Sprint 1 |
| HU-06 | Actualización de estado de entrega         | Alta      |   8   |  5 | Sprint 2    |
| HU-07 | Registro de entrega fallida con motivo      | Alta      |   5   |  5 | Sprint 2    |
| HU-08 | Confirmación de entrega con firma y foto   | Alta      |   5   |  8 | Sprint 2    |
| HU-09 | Reprogramación de entregas fallidas        | Media     |   5   |  5 | Sprint 2    |
| HU-10 | Tracking público por código de guía      | Media     |   5   |  3 | Sprint 2    |
| HU-11 | Panel de operaciones en tiempo real         | Media     |   3   |  5 | Sprint 3    |
| HU-12 | Visualización de ruta en mapa              | Media     |   3   |  5 | Sprint 3    |
| HU-13 | Reportes de envíos por período            | Baja      |   2   |  3 | Sprint 3    |
| HU-14 | Ranking de desempeño de repartidores       | Baja      |   2   |  3 | Sprint 3    |
| HU-15 | Clasificación de incidencias por motivo    | Baja      |   2   |  3 | Sprint 3    |

Las fichas completas de cada Historia de Usuario (descripción, criterios de aceptación y propiedades) se encuentran detalladas en el documento **Sprint Backlog 2**.

### 2.1 Modificaciones al Product Backlog durante el Sprint 2

| Fecha | Cambio | HU afectada(s) | Motivo |
| ----- | ------ | -------------- | ------ |
| 10/09 | HU-04 pasa a titularse "Asignación de envíos a ruta" (antes "…a ruta y repartidor"). Sin cambio de alcance ni de SP. | HU-04 | Corrección del docente en la presentación del Sprint 1: el envío se asigna a la ruta, el repartidor llega vía `rutas.repartidor_id`. El código ya lo hacía bien; se alinea el wording en docs y en la web. |
| 10/09 | Alcance del Sprint 2 confirmado COMPLETO, sin recortes. Orden por dependencias: HU-06 → HU-07 → HU-09 → HU-08 → HU-10. | HU-06 a HU-10 | Decisión del equipo: las 5 HU se implementan. Candidata a recorte si aprieta el tiempo: CA-03 de HU-08 (foto obligatoria). |
| 10/09 | Decisiones de diseño cerradas: foto de HU-07 opcional con mecanismo de HU-08; confirmación directa desde `asignado` registra doble evento; franja de HU-09 obligatoria; tracking solo con columnas blancas; notificación al cliente fuera de alcance. | HU-07, HU-08, HU-09, HU-10 | Cierre de los puntos "a validar" del borrador de fichas. |

---

## 3. Estimaciones de Valor y Esfuerzo

**Escalas utilizadas:**

- **Valor de Negocio:** 1 (soporte) · 2 (útil) · 3 (operativo) · 5 (central) · 8 (imprescindible).
- **Esfuerzo (SP — Fibonacci):** 1 (trivial) · 2 (directo) · 3 (moderado) · 5 (significativo) · 8 (complejo) · 13 (muy complejo).

| ID    | Historia de Usuario                | Valor | SP | V/E  | Responsable                |
| ----- | ---------------------------------- | :---: | :-: | :--: | -------------------------- |
| HU-06 | Actualización de estado           |   8   |  5 | 1.60 | Araya / Díaz Aimar        |
| HU-07 | Entrega fallida con motivo         |   5   |  5 | 1.00 | Araya / Díaz Aimar        |
| HU-08 | Confirmación con firma y foto     |   5   |  8 | 0.63 | Araya / Díaz Aimar        |
| HU-09 | Reprogramación                    |   5   |  5 | 1.00 | Araya / Díaz Aimar        |
| HU-10 | Tracking público                 |   5   |  3 | 1.67 | Araya                      |
|       | **Total**                          |**28** |**26**|     |                            |

**Capacidad:** 3 integrantes × 14 días × ~2 hs/día = **~84 horas** · **Estimado total de tareas:** 118 horas (según el desglose tarea por tarea del Sprint Backlog 2).

> Margen excedido a propósito y declarado desde el backlog (igual que en el Sprint 1): se sostiene con trabajo en paralelo (API/web y móvil por separado) y con el avance temprano de la API + web. Si el tiempo aprieta, la candidata a recorte es CA-03 de HU-08.

---

## 4. Sprint Backlog — Desglose de tareas

> Vista resumida. El desglose canónico tarea por tarea (con fases análisis / diseño / desarrollo / prueba y columnas Estimado y Real) está en el documento **Sprint Backlog 2**. Los subtotales de ambos documentos coinciden. La columna Real refleja el avance al 10/09 (parte API + web de Araya, con registro de horas día por día; el móvil queda pendiente).

### HU-06 — Actualización de estado de entrega (Araya / Díaz Aimar)

| #       | Fase       | Tarea                                                              | Est. (hs) | Real (hs) |
| ------- | ---------- | ------------------------------------------------------------------ | :-------: | :-------: |
| T-06.01–02 | Análisis | Matriz de transiciones + guards por rol                         |     3     |    0.3    |
| T-06.03–04 | Diseño/Des. | Migración 0003 + EventoRepo + historial en detalle             |     7     |    0.4    |
| T-06.05–07 | Desarrollo | EstadoService + handler + rutas + wiring                        |     6     |    0.3    |
| T-06.08 | Desarrollo | Acción según estado en móvil *(Díaz Aimar, pendiente)*            |     2     |     —     |
| T-06.09–10 | Desarrollo/Prueba | Botones + historial en web + E2E                      |     2     |   Incl. en web (ver §9) |
|         |            | **Subtotal HU-06**                                                 |  **20**   |           |

### HU-07 — Registro de entrega fallida con motivo (Araya / Díaz Aimar)

| #       | Fase       | Tarea                                                              | Est. (hs) | Real (hs) |
| ------- | ---------- | ------------------------------------------------------------------ | :-------: | :-------: |
| T-07.01–03 | Análisis/Des. | Motivos + RegistrarIncidencia + validaciones                 |     7     |   Incl. en 1 h bloque HU-06/07 |
| T-07.04 | Desarrollo | Foto de incidencia (migración 0005 + GET binario + flag)           |     3     |    0.5    |
| T-07.05 | Desarrollo | Handler + ruta + mapeo de errores                                  |     2     |   Incl. arriba |
| T-07.06 | Desarrollo | Pantalla de incidencia en móvil *(Díaz Aimar, pendiente)*          |     4     |     —     |
| T-07.07–08 | Desarrollo/Prueba | Form web + Ver foto + E2E                            |     6     |   Incl. en web (ver §9) |
|         |            | **Subtotal HU-07**                                                 |  **22**   |           |

### HU-08 — Confirmación de entrega con firma y foto (Araya / Díaz Aimar)

| #       | Fase       | Tarea                                                              | Est. (hs) | Real (hs) |
| ------- | ---------- | ------------------------------------------------------------------ | :-------: | :-------: |
| T-08.01–04 | Análisis/Des. | ConfirmacionRepo + ConfirmarEntrega + matriz + doble evento |    12     |    0.3    |
| T-08.05–06 | Desarrollo | Handler POST + 2 GET binarios + metadata en detalle                |     5     |    0.2    |
| T-08.07 | Desarrollo | Confirmación + signature-pad en móvil *(Díaz Aimar, pendiente)*    |     5     |     —     |
| T-08.08–09 | Desarrollo/Prueba | Evidencia en web + E2E + 413/magic                    |     6     |   Incl. en web (ver §9) |
|         |            | **Subtotal HU-08**                                                 |  **28**   |           |

### HU-09 — Reprogramación de entregas fallidas (Araya / Díaz Aimar)

| #       | Fase       | Tarea                                                              | Est. (hs) | Real (hs) |
| ------- | ---------- | ------------------------------------------------------------------ | :-------: | :-------: |
| T-09.01–05 | Análisis/Des. | Repo + service + handler + validaciones fecha/franja        |    11     |    0.3    |
| T-09.06 | Desarrollo/Prueba | Detalle + filtro fecha + E2E                               |     2     |    0.2    |
| T-09.07 | Desarrollo | Reprogramación en móvil *(Díaz Aimar, pendiente)*                  |     2     |     —     |
| T-09.08–09 | Desarrollo/Prueba | Form web + "comprometido para" + pruebas              |     3     |   Incl. en web (ver §9) |
|         |            | **Subtotal HU-09**                                                 |  **18**   |           |

### HU-10 — Tracking público por código de guía (Araya)

| #       | Fase       | Tarea                                                              | Est. (hs) | Real (hs) |
| ------- | ---------- | ------------------------------------------------------------------ | :-------: | :-------: |
| T-10.01–04 | Análisis/Des. | Eventos crear/asignar/desasignar + TrackingRepo + mapeo   |     8     |    0.3    |
| T-10.05 | Desarrollo | Handler + ruta pública                                             |     1     |    0.2    |
| T-10.06–07 | Desarrollo/Prueba | Página /tracking + no-leak + E2E ciclo completo     |     5     |   Incl. en web (ver §9) |
|         |            | **Subtotal HU-10**                                                 |  **14**   |           |

### Tareas transversales

| #       | Tarea                                                                        | Responsable | Est. (hs) | Real (hs) |
| ------- | ---------------------------------------------------------------------------- | ----------- | :-------: | :-------: |
| T-00.01 | Postgres local Docker + migraciones 0003/0004/0005                           | Araya       |     3     |    0.3    |
| T-00.02 | OpenAPI: 7 endpoints + schemas nuevos                                        | Araya       |     2     |    0.2    |
| T-00.03 | CI verde (gofmt + vet + lint + build)                                        | Araya       |     2     |   Incl.   |
| T-00.04 | Rama feature/sprint2 + PRs + revisión cruzada *(pendiente: push bloqueado)*  | Equipo      |     2     |     —     |
| T-00.05 | E2E flujo completo + casos vacíos                                           | Araya       |     3     |   Incl.   |
| T-00.06 | Docs de cátedra (backlog + este informe)                                     | Araya       |     2     |     — *   |
| T-00.07 | Contrato API ↔ móvil (DTOs en openapi.yaml)                                 | Equipo      |     2     |   Incl.   |
|         | **Subtotal Transversales**                                                   |             |  **16**   |           |

\* La redacción de estos documentos es la que el lector tiene en sus manos; sus horas se registran al cierre.

### Resumen de horas

| Grupo                  | Horas Est. | Horas Real (al 10/09, solo Araya API+web) |
| ---------------------- | :--------: | :---------------------------------------: |
| HU-06 — Estado        |     20     | Parte de 1 h (bloque HU-06/07 + entorno)  |
| HU-07 — Fallida       |     22     | Parte de 1 h + 0.5 h (foto)               |
| HU-08 — Confirmación |     28     | 0.5 h                                      |
| HU-09 — Reprogramación|     18     | 0.5 h                                      |
| HU-10 — Tracking      |     14     | 0.5 h                                      |
| Web Sprint 2           | (incl.)    | 1 h                                        |
| Transversales          |     16     | Incl. arriba                               |
| **Total**              |  **118**   | **~4 h (Araya, 10/09)**                   |

Detalle de horas reales de Araya (10/09, día por día como exige la cátedra): entorno + HU-06/07 API 1 h · HU-09 API 0.5 h · HU-08 API + foto HU-07 0.5 h · HU-10 API 0.5 h · web (detalle + acciones + tracking) 1 h · ver foto de incidencia (endpoint + botón web) 0.5 h.

---

## 5. Modelo de Datos

El modelo del sprint agrega el seguimiento al esquema del Sprint 1 (que queda sin cambios salvo dos columnas aditivas en `envios`). Se compone de 1 tabla nueva, 1 tabla de evidencia y 3 enums:

**`eventos_envio`** (migración 0003) — id (UUID, PK), envio_id (FK → envios, CASCADE), estado_anterior (nullable; NULL = evento raíz), estado_nuevo, motivo (enum motivo_fallo, nullable), comentario (TEXT, nullable), foto (BYTEA, nullable, migración 0005), actor_id (FK → usuarios, SET NULL), created_at (TIMESTAMPTZ, UTC). Backfill: un evento raíz por cada envío preexistente.

**`confirmaciones_entrega`** (migración 0004) — envio_id (PK + FK → envios, CASCADE; un envío = una confirmación como máximo), receptor_nombre, receptor_relacion (enum relacion_receptor), firma (BYTEA, PNG ≤ 5 MB), foto (BYTEA, JPEG ≤ 5 MB), confirmada_por (FK → usuarios, SET NULL), confirmada_at (TIMESTAMPTZ, UTC). Tabla separada para no cargar BYTEAs en los listados.

**`envios`** (+ migración 0004) — suma `reprogramado_para` (DATE, nullable) y `franja` (enum franja_horaria, nullable). Al asignarse a una ruta, la fecha de la ruta manda y ambas columnas se limpian.

**Enums nuevos:** motivo_fallo (cliente_ausente, direccion_incorrecta, rechazado, zona_insegura, otro) · franja_horaria (manana, tarde, noche) · relacion_receptor (destinatario, familiar, vecino, encargado).

**Relaciones nuevas:**

```
  usuarios ◄──(1:N)── eventos_envio ──(N:1)──► envios ◄──(1:1)── confirmaciones_entrega
                                           │
              (Sprint 1: rutas / remitentes / destinatarios sin cambios)
```

**Decisión documentada:** firma y foto se guardan como BYTEA en la misma base (sin Supabase Storage ni RLS a mitad del sprint). Vale idéntico en Postgres local y en Supabase; si el volumen lo pide a futuro, se migra a Storage conservando estas columnas lógicas.

---

## 6. Implementación

La parte de API + web del sprint está implementada y funcionando de punta a punta contra Postgres local en Docker (paridad garantizada con Supabase: las migraciones son el mismo SQL en ambos). A continuación se detalla cómo se resolvió cada HU, con evidencia tomada del sistema. La parte móvil (CA-06/07 de HU-06/07/08/09) queda pendiente de Felipe.

### 6.1 Arquitectura entregada (al 10/09)

- **API REST en Go** (`gestion-envios/services/api`): mismo patrón del Sprint 1 (`handlers → services → repository`, `chi`, `pgx` sin ORM). Nuevo `EstadoService` (matriz de transiciones pura y testeable) + `EventoRepo` + `ConfirmacionRepo` + `TrackingRepo/Service/Handler`. Cada operación estado+evento corre en transacción todo-o-nada (como la asignación de HU-04).
- **Web** (`gestion-envios/apps/web`, React 19 + Vite + TS + Tailwind + Zod + react-query): detalle del envío extendido (timeline, acciones, evidencia) + página pública `/tracking`. Sin dependencias nuevas.
- **Base local:** Postgres 17 en Docker (`gestion-envios/infra/docker`), migraciones 0003/0004/0005 aplicadas con `go run ./cmd/migrate up`. Contratos en `gestion-envios/docs/api/openapi.yaml` (7 endpoints nuevos + schemas `EventoEnvio`, `ConfirmacionRequest/Metadata`, `ReprogramacionRequest`, `TrackingResponse`).
- Rama `feature/sprint2-seguimiento-tracking` (12 commits al 10/09, sin pushear: GitHub devolvió 403 por falta de acceso de escritura — ver §9).

### 6.2 HU-06 — Actualización de estado de entrega

Endpoints: `PUT /envios/{id}/estado` (`asignado` ⇄ `en_camino`), historial en `GET /envios/{id}`.

```
$ curl -X PUT localhost:8080/envios/<id>/estado -H "Authorization: Bearer <token-repartidor>" -d '{"estado":"en_camino"}'
→ 200 {"id":"...","estado":"en_camino",...}

$ curl -X PUT localhost:8080/envios/<id>/estado -H "Authorization: Bearer <token-repartidor>" -d '{"estado":"entregado"}'
→ 409 {"error":{"code":"transicion_invalida","message":"usá la confirmación (HU-08) para entregar"}}

$ curl localhost:8080/envios/<id> -H "Authorization: Bearer <token-operador>"
→ 200 {"id":"...",...,"historial":[{"fecha":"...","actor_nombre":"...","estado_anterior":"asignado","estado_nuevo":"en_camino",...}]}
```

Guards: repartidor solo sobre envíos de sus rutas (JWT, cualquiera de ellas); ajeno o inexistente → 404 genérico. Operador/supervisor sobre cualquier envío no final. Historial vacío serializa `[]`, nunca `null` (lección HU-05).

Commits: `4146e6f` (API HU-06+07), `707a6aa` (openapi), `eef8c74` (migración 0003).

### 6.3 HU-07 — Registro de entrega fallida con motivo

Endpoints: `POST /envios/{id}/incidencia` (→ `no_entregado`), `GET /envios/{id}/eventos/{eventoId}/foto` (JPEG con el mismo guard que HU-08).

```
$ curl -X POST localhost:8080/envios/<id>/incidencia -H "Authorization: Bearer <token-repartidor>" -d '{"motivo":"cliente_ausente"}'
→ 200 {"id":"...","estado":"no_entregado",...}

$ curl -X POST localhost:8080/envios/<id>/incidencia -d '{"motivo":"otro"}'
→ 400 {"error":{"code":"comentario_obligatorio","message":"..."}}
```

Motivo de lista cerrada (5 valores), comentario obligatorio solo con "otro", foto opcional (base64 → BYTEA, JPEG, ≤ 5 MB; flag `tiene_foto` en el historial, descarga por evento porque un envío puede tener varias incidencias). Solo desde `asignado`/`en_camino`.

Commits: `4146e6f`, `b031708` (foto HU-07, migración 0005), `4007403` (ver foto: endpoint + flag + botón web).

### 6.4 HU-09 — Reprogramación de entregas fallidas

Endpoint: `POST /envios/{id}/reprogramacion` (solo sobre `no_entregado` → `pendiente` + fecha/franja, se desvincula de la ruta).

```
$ curl -X POST localhost:8080/envios/<id>/reprogramacion -H "Authorization: Bearer <token-operador>" -d '{"nueva_fecha":"2026-09-20","franja":"manana"}'
→ 200 {"id":"...","estado":"pendiente",...}

$ curl "localhost:8080/envios?fecha=2026-09-20" → incluye el reprogramado como pendiente
$ curl -X POST .../reprogramacion -d '{"nueva_fecha":"2026-09-01","franja":"manana"}'
→ 400 {"error":{"code":"fecha_invalida","message":"..."}}
```

Fecha ≥ hoy (UTC, formato estricto `YYYY-MM-DD`), franja obligatoria. El evento registra "reprogramado para {fecha} ({franja})" con el motivo original visible. Al asignarse a una ruta, la fecha de la ruta manda y las columnas se limpian. Notificación al cliente: fuera de alcance (decisión registrada).

Commit: `d1f3b79`.

### 6.5 HU-08 — Confirmación de entrega con firma y foto

Endpoints: `POST /envios/{id}/confirmacion` (→ `entregado` terminal), `GET /envios/{id}/confirmacion/firma` (PNG) y `/foto` (JPEG, ambos con guard de pertenencia para repartidor), metadata en el detalle.

```
$ curl -X POST localhost:8080/envios/<id>/confirmacion -H "Authorization: Bearer <token-repartidor>" -d '{"receptor_nombre":"...","receptor_relacion":"destinatario","firma_base64":"...","foto_base64":"..."}'
→ 200 {"id":"...","estado":"entregado",...}

$ curl localhost:8080/envios/<id>/confirmacion/firma → 200 image/png (bytes idénticos a los guardados)
$ curl -X POST .../confirmacion (otra vez) → 409 transicion_invalida
```

Receptor + relación obligatorios, firma PNG y foto JPEG obligatorias (≤ 5 MB cada una, magic bytes validados; 413 si se supera). Desde `en_camino` (1 evento) o directo desde `asignado` (2 eventos: paso por `en_camino` + entrega). PK = envio_id: no hay doble confirmación.

Commit: `b031708`.

### 6.6 HU-10 — Tracking público por código de guía

Endpoint público (sin login, fuera del grupo autenticado, junto a `/health` y `/auth/*`): `GET /tracking/{codigo}`.

```
$ curl localhost:8080/tracking/MOV-20260910-0001
→ 200 {"codigo_guia":"MOV-...","estado":"en_camino","localidad":"San Francisco","actualizado_en":"...","historial":[{"fecha":"...","descripcion":"Envío registrado"},{"fecha":"...","descripcion":"Asignado a ruta de reparto"},...]}

$ curl localhost:8080/tracking/MOV-XXXX
→ 404 {"error":{"code":"no_encontrado","message":"no se encontró ningún envío con ese código"}}
```

Privacidad por doble barrera: el repo selecciona solo columnas blancas (código, estado, localidad, eventos sin actor/comentario/foto) y los tests afirman la ausencia de las keys sensibles (`telefono`, `email`, `calle`, `numero`, `actor_nombre`, `comentario`, `repartidor`, `direccion`). Match exacto, sin sugerencias. Incluyó completar los eventos que HU-01/04 no registraban (crear/asignar/desasignar), sin los cuales el tracking de envíos nuevos salía vacío.

Commit: `19e6804`.

### 6.7 Web Sprint 2

- **Detalle del envío** (`EnvioDetallePage`): sección Historial (componente `HistorialTimeline`, sirve a detalle y a tracking; vacío → `EmptyState`), etiqueta "Comprometido para {fecha} ({franja})" si hay reprogramación, sección "Evidencia de entrega" (receptor, relación, fecha + botones Ver firma/Ver foto por blob con auth, no `<img src>` directo), botón Ver foto en incidencias con `tiene_foto`.
- **Acciones** (`AccionesEnvio`): visibilidad por estado — `asignado` → "Iniciar reparto"; `en_camino` → "Volver a asignado" + "Registrar incidencia" (también desde `asignado`); `no_entregado` → "Reprogramar"; `entregado`/`pendiente` → nota informativa. Formularios con validación Zod (motivo "otro" exige comentario; fecha `YYYY-MM-DD`; foto opcional por FileReader → base64). Tras cada mutación se invalidan `["envios", id]` (+ `["envios"]`).
- **Tracking público** (`TrackingPage`, ruta `/tracking` fuera de `ProtectedRoute`, layout standalone sin sidebar): buscador + header (código + badge + localidad + actualizado_en) + timeline con colores semánticos. 404 → mensaje amable sin tecnicismos.

Commits: `8917c5c` (web), `4007403` (botón ver foto).

### 6.8 Testing

Los tests de la API corren contra Postgres real (local en Docker durante este sprint; mismo SQL que Supabase), sin mocks de base de datos: repositorios, servicios, handlers con `httptest`, más un test E2E por cada flujo nuevo (seguimiento, reprogramación, confirmación, tracking). Se ejecutan con `go test ./... -p 1` (en serie, por las 5 acciones del Sprint 1).

| Suite | Tests | Resultado (10/09) |
| ----- | :---: | ----------------- |
| API (Go, `services/api`) | 178 funciones Test + 7 flujos E2E (auth, envíos/rutas, repartidor, seguimiento, reprogramación, confirmación, tracking) | Suite completa en verde (2 corridas: la del worker y la del orquestador) |
| Web (vitest, `apps/web`) | 59 | 59 pasan · lint 0 errores · build OK |
| App móvil (vitest) | 19 (Sprint 1) | Pendiente parte Sprint 2 (Felipe) |
| **Total verificado** | **API + web** | **Verde al 10/09** |

Cobertura destacada del sprint: matriz de transiciones (tabla de pares válidos/inválidos), motivo inválido / "otro" sin comentario / transición desde estado final, fecha pasada y franja mala, reconfirmación 409, payload > 5 MB (413), magic bytes cruzados (PNG↔JPEG), repartidor ajeno → 404 en cada endpoint, lista/historial vacíos → `[]`, y no-leak del tracking (ausencia de keys sensibles con seed cargado).

CI: `api-ci.yml` y `mobile-ci.yml` (como en el Sprint 1); `gofmt` + `go vet` limpios antes de cada commit.

### 6.9 Revisión parcial y pendiente

Al 10/09 la API + web cubren los 7 endpoints nuevos, el detalle extendido y la página pública, verificados con suites completas (no solo la parte tocada al final, por la acción 6 del Sprint 1) y con repaso de cada CA sobre la interfaz que el criterio nombra (acción 4). Queda pendiente: pantallas móviles de HU-06 (acción en tarjeta), HU-07 (incidencia), HU-08 (confirmación + signature-pad) y HU-09 (reprogramar); push de la rama (403 por falta de acceso — ver §9); y la revisión de cierre HU por HU con el equipo antes del 24/09.

---

## 7. Cronograma y Burndown Chart

### Cronograma

| Período        | Actividades principales                                                              |
| --------------- | ------------------------------------------------------------------------------------- |
| 10/09 (día 1)  | Presentación del Backlog · Postgres local + migraciones 0003/0004 · openapi · API HU-06/07/09/08/10 + foto HU-07 · web completa. Suites en verde. |
| 11/09 – 17/09  | App móvil (HU-06/07/09/08) · push de la rama + PRs · revisión de CAs sobre cada interfaz. |
| 18/09 – 23/09  | Revisión de cierre HU por HU · suites completas · correcciones y regresión.            |
| **24/09**      | **Cierre + retrospectiva + presentación del Sprint 2** (fecha autoimpuesta)             |

### Burndown Chart (avance al 10/09)

| Fecha            | SP Ideal | SP Real | Horas Ideal | Horas Real (Araya) |
| ---------------- | :------: | :-----: | :---------: | :----------------: |
| 10/09 (inicio)   |    26    |   26    |     118     |         4          |
| 14/09 (semana 1) |    18    |         |      84     |                    |
| 17/09 (semana 2) |    13    |         |      59     |                    |
| 21/09 (semana 3) |     7    |         |      30     |                    |
| 24/09 (cierre)   |     0    |         |       0     |                    |

*Criterio de quemado: los SP de una HU se queman al cerrarla completa (API + web + móvil según corresponda), no por capas. Por eso el Real sigue en 26 al 10/09 pese al avance de API + web. Las horas Real se registran día por día desde el 10/09 (acción de la retrospectiva del Sprint 1).*

---

## 8. Criterios del Sprint

### Definition of Done (DoD)

1. Código revisado por al menos un compañero vía pull request.
2. Código sigue lineamientos de estilo (ESLint + Prettier / gofmt).
3. Funcionalidad probada manualmente con casos positivos y negativos.
4. Pruebas unitarias para lógica de negocio (cobertura mínima 70%).
5. Integrado en rama `develop` sin conflictos; CI pasa sin errores.
6. Documentación de API actualizada en Swagger/OpenAPI si afecta endpoints.
7. Historia demostrada y aprobada por el equipo en revisión de sprint.
8. Sin bugs de severidad alta o crítica pendientes.
9. `go test ./... -p 1` (nunca en paralelo) antes de cerrar tarea que toca la base.
10. Test de lista vacía en cada endpoint que devuelve una lista.
11. Repaso de CAs sobre la interfaz que el criterio nombra.
12. Suites completas (API y móvil) en verde antes del cierre.
13. Implementación documentada HU por HU a medida que se cierran.
14. Línea de integración y despliegue contemplada en la estimación.

### Convenciones del equipo

- **Ramas:** `feature/HU-XX-descripcion-breve` (este sprint: `feature/sprint2-seguimiento-tracking`)
- **Commits:** en español, prefijo con ID de tarea + trailer `Co-Authored-By`
- **Pull Requests:** descripción + checklist de DoD + screenshots si aplica
- **Daily Standup:** comunicación asíncrona por Discord (3 preguntas clásicas)
- **Respuestas API:** éxito = recurso/lista; error = `{"error":{"code","message"}}`
- **Fechas:** UTC. Repartidor por JWT, nunca por parámetro URL.
- **Bugs:** issues en GitHub con etiqueta `bug` y severidad. Alta/crítica bloquea sprint.

> Pendiente de definir con el equipo (viene del Sprint 1): `develop` + PRs como línea de integración antes de mergear la rama del Sprint 2.

---

## 9. Retrospectiva — Parcial al 10/09 (se completa al cierre)

### Teórico vs. Real (parcial, solo Araya API + web)

| Grupo                  | Estimado (hs) | Real 10/09 (hs) | Observaciones parciales |
| ---------------------- | :-----------: | :-------------: | ----------------------- |
| HU-06 — Estado        |      20       | Parte de 1 (con entorno + HU-07) | La matriz pura y el EventoRepo salieron directos; el patrón de HU-04 (tx + guards) se reutilizó sin fricción. |
| HU-07 — Fallida       |      22       | Parte de 1 + 0.5 (foto) | La foto quedó para el plan de HU-08 como estaba previsto; migración 0005 mínima. |
| HU-08 — Confirmación |      28       | 0.5 | Lo más pesado en estimado (binarios + doble evento + metadata); en API salió rápido por el camino ya abierto. Falta el móvil, que es donde está el grueso (signature-pad). |
| HU-09 — Reprogramación|      18       | 0.5 | Filtro de fecha + limpieza al asignar, aditivos sin romper tests viejos. |
| HU-10 — Tracking      |      14       | 0.5 | El grueso fue completar eventos de HU-01/04; el mapeo puro se testeó sin DB. |
| Web                    | (en cada HU)  | 1 | Timeline compartido + acciones + tracking en una pasada. |
| **Total**              |   **118**     | **~4** | Ritmo del día 1 muy por encima del estimado en API + web; el estimado real se juega en el móvil. |

### Seguimiento de las 6 acciones del Sprint 1

1. `go test ./... -p 1`, nunca en paralelo → **cumplida** (todas las corridas del sprint en serie, 2 corridas completas en verde).
2. Línea de integración en la estimación → **cumplida** (T-00.01 a T-00.07 en el backlog).
3. Documentar cada HU al cerrarla → **cumplida** (planes tildados HU por HU + este informe en curso).
4. Repasar CAs sobre la interfaz que nombran → **cumplida en API + web** (pendiente en móvil).
5. Test de lista vacía en cada lista → **cumplida** (historial vacío, tracking sin eventos, listados).
6. Suites completas antes de cerrar → **parcial** (API + web completas en verde; falta la móvil).

### Parcial: qué salió bien / a mejorar (al 10/09)

**¿Qué salió bien?**
- El contrato primero (openapi + matriz + migraciones antes que el código) permitió implementar 5 HU en un día sin re-diseñar a mitad de camino; el móvil tiene el contrato cerrado antes de arrancar.
- Paridad local/Supabase por construcción (mismo SQL, BYTEA sin infra nueva) + Postgres en Docker: se trabajó sin depender de la nube.
- Cada transición en transacción + evento, y `entregado` terminal solo por HU-08: el historial es la fuente única que HU-10 lee.

**¿Qué puede mejorarse? (riesgos abiertos)**
- La rama con 12 commits no pudo pushearse (403: falta acceso de escritura para Araya en `FelipeDiazAimar/Movii`) → pedir acceso o definir fork, y avisar por Discord por las migraciones antes del push/merge.
- Falta la parte móvil completa (Felipe) y la definición de `develop` + PRs con el equipo.
- Las horas del móvil y de Micheloud aún no están registradas: retomar el log diario hasta el 24/09.

**Bloqueos y próximos pasos:** push (cuando haya acceso) → móvil (Felipe) → revisión de cierre HU por HU → retrospectiva definitiva del 24/09.

---

*Documento del Sprint 2 — Proyecto Movii — UTN FRSF — Ingeniería y Calidad del Software — 2026*
