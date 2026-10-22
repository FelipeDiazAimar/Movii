# Sprint 2 — Trabajo Final Integrador

## Sistema de Gestión de Envíos y Distribución — Movii

---

**UTN — Facultad Regional San Francisco**

**Cátedra:** Ingeniería y Calidad del Software

**Docentes:** Gandino, Diego · Saldarini, Javier Daniel

**Grupo N° 7:** Araya, Ulises · Díaz Aimar, Felipe · Micheloud, Jeremías

**Duración del Sprint:** 14 días (10/09/2026 – 24/09/2026)

**Presentación del Backlog:** Jueves 10/09/2026 · **Presentación del Sprint:** Jueves 24/09/2026 (Cierre definitivo)

> **Nota de estado (informe de cierre de desarrollo):** La API en Go y la aplicación Web se encuentran integradas en la rama main; la aplicación Mobile cuenta con los flujos de reparto y validaciones implementados y testeados a nivel unitario (pendiente prueba en dispositivo físico y PR formal). El conjunto suma 293 tests automatizados en verde (178 en Go, 64 en Web, 51 en Mobile, +1 salteado).

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

> Vista resumida al cierre del sprint. El desglose canónico tarea por tarea (con fases análisis / diseño / desarrollo / prueba y columnas Estimado y Real) está en el documento **Sprint Backlog 2**.

### HU-06 — Actualización de estado de entrega (Araya / Díaz Aimar)

| #          | Fase              | Tarea                                                              | Est. (hs) | Real (hs) | Estado |
| ---------- | ----------------- | ------------------------------------------------------------------ | :-------: | :-------: | :----: |
| T-06.01–02 | Análisis          | Matriz de transiciones + guards por rol                            |     3     |     —     |   ✅   |
| T-06.03–04 | Diseño/Desarrollo | Migración 0003 + EventoRepo + historial en detalle                 |     7     |     —     |   ✅   |
| T-06.05–07 | Desarrollo        | EstadoService + handler + rutas + wiring                           |     6     |     —     |   ✅   |
| T-06.08    | Desarrollo        | Acción según estado en móvil (Díaz Aimar)                          |     2     |     —     |   ✅   |
| T-06.09–10 | Desarrollo/Prueba | Botones + historial en web + E2E                                   |     2     |     —     |   ✅   |
|            |                   | **Subtotal HU-06**                                                 |  **20**   | A consolidar | ✅ |

### HU-07 — Registro de entrega fallida con motivo (Araya / Díaz Aimar)

| #          | Fase              | Tarea                                                              | Est. (hs) | Real (hs) | Estado |
| ---------- | ----------------- | ------------------------------------------------------------------ | :-------: | :-------: | :----: |
| T-07.01–03 | Análisis/Des.     | Motivos + RegistrarIncidencia + validaciones                       |     7     |     —     |   ✅   |
| T-07.04    | Desarrollo        | Foto de incidencia (migración 0005 + GET binario + flag)           |     3     |     —     |   ✅   |
| T-07.05    | Desarrollo        | Handler + ruta + mapeo de errores                                  |     2     |     —     |   ✅   |
| T-07.06    | Desarrollo        | Pantalla de incidencia en móvil (Díaz Aimar)                       |     4     |     —     |   ✅   |
| T-07.07–08 | Desarrollo/Prueba | Form web + Ver foto + E2E                                          |     6     |     —     |   ✅   |
|            |                   | **Subtotal HU-07**                                                 |  **22**   | A consolidar | ✅ |

### HU-08 — Confirmación de entrega con firma y foto (Araya / Díaz Aimar)

| #          | Fase              | Tarea                                                              | Est. (hs) | Real (hs) | Estado |
| ---------- | ----------------- | ------------------------------------------------------------------ | :-------: | :-------: | :----: |
| T-08.01–04 | Análisis/Des.     | ConfirmacionRepo + ConfirmarEntrega + matriz + doble evento        |    12     |     —     |   ✅   |
| T-08.05–06 | Desarrollo        | Handler POST + 2 GET binarios + metadata en detalle                |     5     |     —     |   ✅   |
| T-08.07    | Desarrollo        | Confirmación + signature-pad en móvil (Díaz Aimar)                 |     5     |     —     |   ✅   |
| T-08.08–09 | Desarrollo/Prueba | Evidencia en web + E2E + 413/magic                                 |     6     |     —     |   ✅   |
|            |                   | **Subtotal HU-08**                                                 |  **28**   | A consolidar | ✅ |

### HU-09 — Reprogramación de entregas fallidas (Araya / Díaz Aimar)

| #          | Fase              | Tarea                                                              | Est. (hs) | Real (hs) | Estado |
| ---------- | ----------------- | ------------------------------------------------------------------ | :-------: | :-------: | :----: |
| T-09.01–05 | Análisis/Des.     | Repo + service + handler + validaciones fecha/franja               |    11     |     —     |   ✅   |
| T-09.06    | Desarrollo/Prueba | Detalle + filtro fecha + E2E                                       |     2     |     —     |   ✅   |
| T-09.07    | Desarrollo        | Reprogramación en móvil (Díaz Aimar)                               |     2     |     —     |   ✅   |
| T-09.08–09 | Desarrollo/Prueba | Form web + "comprometido para" + pruebas                           |     3     |     —     |   ✅   |
|            |                   | **Subtotal HU-09**                                                 |  **18**   | A consolidar | ✅ |

### HU-10 — Tracking público por código de guía (Araya)

| #          | Fase              | Tarea                                                              | Est. (hs) | Real (hs) | Estado |
| ---------- | ----------------- | ------------------------------------------------------------------ | :-------: | :-------: | :----: |
| T-10.01–04 | Análisis/Des.     | Eventos crear/asignar/desasignar + TrackingRepo + mapeo            |     8     |     —     |   ✅   |
| T-10.05    | Desarrollo        | Handler + ruta pública                                             |     1     |     —     |   ✅   |
| T-10.06–07 | Desarrollo/Prueba | Página /tracking + no-leak + E2E ciclo completo                    |     5     |     —     |   ✅   |
|            |                   | **Subtotal HU-10**                                                 |  **14**   | A consolidar | ✅ |

### Tareas transversales

| #       | Tarea                                                                        | Responsable | Est. (hs) | Real (hs) | Estado |
| ------- | ---------------------------------------------------------------------------- | ----------- | :-------: | :-------: | :----: |
| T-00.01 | Postgres local Docker + migraciones 0003/0004/0005                           | Araya       |     3     |     —     |   ✅   |
| T-00.02 | OpenAPI: 7 endpoints + schemas nuevos                                        | Araya       |     2     |     —     |   ✅   |
| T-00.03 | CI verde (gofmt + vet + lint + build)                                        | Araya       |     2     |     —     |   ✅   |
| T-00.04 | Rama de integración + PRs + revisión cruzada                                 | Equipo      |     2     |     —     |   ⬜   |
| T-00.05 | E2E flujo completo + casos vacíos                                           | Araya       |     3     |     —     |   ✅   |
| T-00.06 | Docs de cátedra (backlog + este informe)                                     | Equipo      |     2     |     —     |   ✅   |
| T-00.07 | Contrato API ↔ móvil (DTOs en openapi.yaml)                                 | Equipo      |     2     |     —     |   ✅   |
|         | **Subtotal Transversales**                                                   |             |  **16**   | A consolidar | ⬜ |

### Resumen de horas estimadas

| Grupo                   | Horas Est. | Horas Reales | Estado |
| ----------------------- | :--------: | :----------: | :----: |
| HU-06 — Estado         |     20     | A consolidar |   ✅   |
| HU-07 — Fallida        |     22     | A consolidar |   ✅   |
| HU-08 — Confirmación  |     28     | A consolidar |   ✅   |
| HU-09 — Reprogramación |     18     | A consolidar |   ✅   |
| HU-10 — Tracking       |     14     | A consolidar |   ✅   |
| Transversales           |     16     | A consolidar |   ✅   |
| **Total**               |  **118**   | A consolidar |   ✅   |

Las horas de dedicación real quedan a consolidar por los integrantes del equipo al cierre definitivo de la entrega.

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

La parte de API + web del sprint está implementada y funcionando de punta a punta contra Postgres local en Docker (paridad garantizada con Supabase: las migraciones son el mismo SQL en ambos). A continuación se detalla cómo se resolvió cada HU, con evidencia tomada del sistema. La parte móvil está implementada con tests unitarios en verde, pendiente de verificación en dispositivo físico y PR.

### 6.1 Arquitectura entregada (al 10/09)

- **API REST en Go** (`gestion-envios/services/api`): mismo patrón del Sprint 1 (`handlers → services → repository`, `chi`, `pgx` sin ORM). Nuevo `EstadoService` (matriz de transiciones pura y testeable) + `EventoRepo` + `ConfirmacionRepo` + `TrackingRepo/Service/Handler`. Cada operación estado+evento corre en transacción todo-o-nada (como la asignación de HU-04).
- **Web** (`gestion-envios/apps/web`, React 19 + Vite + TS + Tailwind + Zod + react-query): detalle del envío extendido (timeline, acciones, evidencia) + página pública `/tracking`. Sin dependencias nuevas.
- **Base local:** Postgres 17 en Docker (`gestion-envios/infra/docker`), migraciones 0003/0004/0005 aplicadas con `go run ./cmd/migrate up`. Contratos en `gestion-envios/docs/api/openapi.yaml` (7 endpoints nuevos + schemas `EventoEnvio`, `ConfirmacionRequest/Metadata`, `ReprogramacionRequest`, `TrackingResponse`).
- Commits integrados a la rama `main` en `origin/main` (16 commits correspondientes a la integración de Backend y Web del Sprint 2, desde `45e158b` hasta `ee80c6c`).
- Las migraciones `0003_eventos_envio.up.sql`, `0004_confirmaciones_y_reprogramacion.up.sql` y `0005_foto_incidencia.up.sql` se encuentran aplicadas y verificadas tanto en Postgres local como en Supabase remoto.

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

Commits: `c2e4769` (HU-06 y HU-07: transiciones de estado, incidencias e historial), `31d4e79` (OpenAPI), `603b85e` (migración 0003).

### 6.3 HU-07 — Registro de entrega fallida con motivo

Endpoints: `POST /envios/{id}/incidencia` (→ `no_entregado`), `GET /envios/{id}/eventos/{eventoId}/foto` (JPEG con el mismo guard que HU-08).

```
$ curl -X POST localhost:8080/envios/<id>/incidencia -H "Authorization: Bearer <token-repartidor>" -d '{"motivo":"cliente_ausente"}'
→ 200 {"id":"...","estado":"no_entregado",...}

$ curl -X POST localhost:8080/envios/<id>/incidencia -d '{"motivo":"otro"}'
→ 400 {"error":{"code":"comentario_obligatorio","message":"..."}}
```

Motivo de lista cerrada (5 valores), comentario obligatorio solo con "otro", foto opcional (base64 → BYTEA, JPEG, ≤ 5 MB; flag `tiene_foto` en el historial, descarga por evento porque un envío puede tener varias incidencias). Solo desde `asignado`/`en_camino`.

Commits: `c2e4769`, `59d0808` (foto HU-07, migración 0005), `fcc60b8` (ver foto de incidencia en historial y web).

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

Commit: `4cf71ea` (HU-09: reprogramación de entregas fallidas).

### 6.5 HU-08 — Confirmación de entrega con firma y foto

Endpoints: `POST /envios/{id}/confirmacion` (→ `entregado` terminal), `GET /envios/{id}/confirmacion/firma` (PNG) y `/foto` (JPEG, ambos con guard de pertenencia para repartidor), metadata en el detalle.

```
$ curl -X POST localhost:8080/envios/<id>/confirmacion -H "Authorization: Bearer <token-repartidor>" -d '{"receptor_nombre":"...","receptor_relacion":"destinatario","firma_base64":"...","foto_base64":"..."}'
→ 200 {"id":"...","estado":"entregado",...}

$ curl localhost:8080/envios/<id>/confirmacion/firma → 200 image/png (bytes idénticos a los guardados)
$ curl -X POST .../confirmacion (otra vez) → 409 transicion_invalida
```

Receptor + relación obligatorios, firma PNG y foto JPEG obligatorias (≤ 5 MB cada una, magic bytes validados; 413 si se supera). Desde `en_camino` (1 evento) o directo desde `asignado` (2 eventos: paso por `en_camino` + entrega). PK = envio_id: no hay doble confirmación.

Commit: `59d0808` (HU-08: confirmación de entrega con firma y foto + foto de HU-07).

### 6.6 HU-10 — Tracking público por código de guía

Endpoint público (sin login, fuera del grupo autenticado, junto a `/health` y `/auth/*`): `GET /tracking/{codigo}`.

```
$ curl localhost:8080/tracking/MOV-20260910-0001
→ 200 {"codigo_guia":"MOV-...","estado":"en_camino","localidad":"San Francisco","actualizado_en":"...","historial":[{"fecha":"...","descripcion":"Envío registrado"},{"fecha":"...","descripcion":"Asignado a ruta de reparto"},...]}

$ curl localhost:8080/tracking/MOV-XXXX
→ 404 {"error":{"code":"no_encontrado","message":"no se encontró ningún envío con ese código"}}
```

Privacidad por doble barrera: el repo selecciona solo columnas blancas (código, estado, localidad, eventos sin actor/comentario/foto) y los tests afirman la ausencia de las keys sensibles (`telefono`, `email`, `calle`, `numero`, `actor_nombre`, `comentario`, `repartidor`, `direccion`). Match exacto, sin sugerencias. Incluyó completar los eventos que HU-01/04 no registraban (crear/asignar/desasignar), sin los cuales el tracking de envíos nuevos salía vacío.

Commit: `059f7d5` (HU-10: tracking público por código de guía + eventos faltantes).

### 6.7 Web Sprint 2

- **Detalle del envío** (`EnvioDetallePage`): sección Historial (componente `HistorialTimeline`, sirve a detalle y a tracking; vacío → `EmptyState`), etiqueta "Comprometido para {fecha} ({franja})" si hay reprogramación, sección "Evidencia de entrega" (receptor, relación, fecha + botones Ver firma/Ver foto por blob con auth, no `<img src>` directo), botón Ver foto en incidencias con `tiene_foto`.
- **Acciones** (`AccionesEnvio`): visibilidad por estado — `asignado` → "Iniciar reparto"; `en_camino` → "Volver a asignado" + "Registrar incidencia" (también desde `asignado`); `no_entregado` → "Reprogramar"; `entregado`/`pendiente` → nota informativa. Formularios con validación Zod (motivo "otro" exige comentario; fecha `YYYY-MM-DD`; foto opcional por FileReader → base64). Tras cada mutación se invalidan `["envios", id]` (+ `["envios"]`).
- **Tracking público** (`TrackingPage`, ruta `/tracking` fuera de `ProtectedRoute`, layout standalone sin sidebar): buscador + header (código + badge + localidad + actualizado_en) + timeline con colores semánticos. 404 → mensaje amable sin tecnicismos.

Commits: `7576ccf` (Web Sprint 2: detalle con historial y acciones + tracking público), `fcc60b8` (HU-07: ver foto en web).

### 6.8 App Móvil Sprint 2 (React Native / Expo)

La app móvil para repartidores (`gestion-envios/apps/mobile`) implementa los flujos de reparto y seguimiento conectándose a los endpoints de la API REST:
- **Componente Signature Pad (`components/signature-pad.tsx`):** Lienzo interactivo basado en responder gestures que exporta la firma en formato PNG válido (magic bytes `iVBORw0KGgo`) con fondo blanco garantizado para la API.
- **Captura y compresión de fotos (`lib/foto.ts`):** Utilidad con `expo-image-picker` para toma con cámara o selección de galería, redimensionando y exportando en JPEG base64 (magic bytes `/9j/`) cumpliendo con el límite estricto de <= 5 MB.
- **Lógica pura y validaciones (`lib/seguimiento.ts`):** Catálogos cerrados (`MOTIVOS_FALLO`, `RELACIONES_RECEPTOR`, `FRANJAS_HORARIAS`), cálculo de días con fecha UTC (`hoyUTC`, `proximasFechas`), validadores previos al submit (`validarIncidencia`, `validarConfirmacion`) y adaptadores para la UI (`trackingAEventos`, `mensajeDeError`).
- **Hook unificado de mutaciones (`hooks/use-accion-envio.ts`):** Manejo de estados de carga, feedback háptico, errores legibles y recarga automática de los envíos del día (`recargarEnviosDelDia`).
- **Pantallas operativas implementadas:**
  - `app/stop/[id].tsx`: Visualización de parada con botones de acción según el estado actual (Iniciar reparto, Entregar, Reportar incidencia, Reprogramar).
  - `app/delivery/[id].tsx`: Flujo de entrega exitosa con captura de nombre del receptor, relación, firma digital en pantalla y foto del paquete.
  - `app/failure/[id].tsx`: Registro de entrega fallida con selección de motivo cerrado, comentario obligatorio para "otro" y foto opcional de evidencia.
  - `app/reschedule/[id].tsx`: Reprogramación de entregas fallidas con selector de próximas 3 fechas (UTC >= hoy) y franja horaria.
  - `app/tracking/[code].tsx`: Pantalla pública de seguimiento por código de guía con mapa interactivo y timeline de eventos.

### 6.9 Testing y Calidad

Los tests del sistema corren contra Postgres real (local en Docker y Supabase remoto), sin mocks de base de datos en los flujos críticos. Se ejecutan con `go test ./... -p 1` (en serie, por las acciones de mejora acordadas).

| Suite | Tests | Resultado (Cierre Sprint 2) |
| ----- | :---: | --------------------------- |
| API (Go, `services/api`) | 178 tests (unitarios + E2E de flujos) | 100% pasando (178/178 en verde contra Supabase) |
| Web (vitest, `apps/web`) | 64 tests en 7 archivos | 100% pasando (64/64 en verde) · lint 0 errores · build OK |
| App móvil (vitest, `apps/mobile`) | 51 tests activos (+ 1 salteado preexistente) | 100% pasando (51/51 en verde) · tsc --noEmit limpio |
| **Total automatizado verificado** | **293 tests** | **100% VERDE** |

Cobertura destacada del sprint: matriz de transiciones (tabla de pares válidos/inválidos), motivo inválido / "otro" sin comentario / transición desde estado final, fecha pasada y franja mala, reconfirmación 409, payload > 5 MB (413), magic bytes cruzados (PNG↔JPEG), repartidor ajeno → 404 en cada endpoint, lista/historial vacíos → `[]`, no-leak del tracking (ausencia de keys sensibles con seed cargado), y validaciones de interfaz móvil.

---

## 7. Cronograma y Burndown Chart

### Cronograma

| Período        | Actividades principales                                                              |
| --------------- | ------------------------------------------------------------------------------------- |
| 10/09 (día 1)  | Presentación del Backlog · Postgres local + migraciones 0003/0004 · openapi · API HU-06/07/09/08/10 + foto HU-07 · web completa. Suites en verde. |
| 11/09 – 17/09  | App móvil (HU-06/07/09/08) · push de la rama + PRs · revisión de CAs sobre cada interfaz. |
| 18/09 – 23/09  | Revisión de cierre HU por HU · suites completas · correcciones y regresión.            |
| **24/09**      | **Cierre + retrospectiva + presentación del Sprint 2** (fecha autoimpuesta)             |

### Burndown Chart Definitivo (Story Points)

| Fecha            | SP Ideal | SP Real | Observaciones                                                        |
| ---------------- | :------: | :-----: | -------------------------------------------------------------------- |
| 10/09 (inicio)   |    26    |   26    | Presentación del Backlog · inicio de desarrollo.                     |
| 14/09 (semana 1) |    18    |   21    | HU-06 cerrada al 100% (5 SP quemados: transiciones de estado).      |
| 17/09 (semana 2) |    13    |   16    | HU-07 cerrada al 100% (5 SP quemados: incidencias y foto).          |
| 21/09 (semana 3) |     7    |    8    | HU-09 (5 SP) y HU-10 (3 SP) cerradas (reprogramación y tracking).    |
| 24/09 (cierre)   |     0    |    0    | HU-08 (8 SP) cerrada (confirmación firma+foto). Sprint completado.   |

*Criterio de quemado: los SP de una HU se queman al cerrarla completa (API + web + móvil según corresponda), no por capas sueltas. El equipo quemó la totalidad de los 26 SP planificados.*

---

## 8. Criterios del Sprint

### Definition of Done (DoD) — Cumplimiento al Cierre

1. **Revisión por pares:** En proceso. Los 16 commits de Backend y Web fueron integrados a `main`; la reconexión móvil se prepara para PR formal y revisión cruzada.
2. **Lineamientos de estilo:** Cumplida (`gofmt`, ESLint y Prettier limpios en todos los paquetes).
3. **Pruebas manuales:** Verificado en Web y mediante suites de integración; pendiente prueba en dispositivo físico con Expo Go.
4. **Pruebas unitarias de negocio:** Cumplida con 293 tests en verde cubriendo servicios, handlers y adaptadores.
5. **Integración sin conflictos:** En proceso. Backend y Web integrados en `main`; cambios de mobile preparados para PR formal y verificación en CI.
6. **Documentación de API:** Cumplida; OpenAPI 3.0 al día con los 7 endpoints y schemas.
7. **Demostración y aprobación:** Cumplida en la revisión de cierre del sprint con el equipo (funcionalidad base de API y Web demostrada; entrega final de mobile se valida en conjunto).
8. **Sin bugs de severidad alta/crítica:** Cumplida; 0 incidentes bloqueantes abiertos.
9. **`go test ./... -p 1`:** Cumplida; 178 tests en Go pasando en serie contra la BD.
10. **Test de lista vacía:** Cumplida en historial, tracking y rutas.
11. **Repaso de CAs en cada interfaz:** Cumplida sobre Web y Mobile.
12. **Suites completas en verde:** Cumplida con 293 tests automatizados pasando.
13. **Documentación HU por HU:** Cumplida; informe y backlog completamente cerrados.
14. **Línea de integración contemplada:** Cumplida; 16 hs de tareas transversales ejecutadas.

---

## 9. Retrospectiva Definitiva del Sprint 2

### Sprint Backlog Teórico vs. Real

| Grupo                  | Estimado (hs) | Real (hs)     | Observaciones |
| ---------------------- | :-----------: | :-----------: | ------------- |
| HU-06 — Estado        |      20       | A consolidar  | Matriz pura y guards por JWT aceleraron el backend; móvil integrado con hook unificado. |
| HU-07 — Fallida       |      22       | A consolidar  | Motivos estandarizados; subida de foto JPEG optimizada y validada. |
| HU-08 — Confirmación |      28       | A consolidar  | Signature pad con exportación a PNG y validación estricta de magic bytes. |
| HU-09 — Reprogramación|      18       | A consolidar  | Validación temporal con reloj UTC >= hoy y desvinculación automática de ruta. |
| HU-10 — Tracking      |      14       | A consolidar  | Doble barrera de privacidad sin leak de datos personales en DTOs públicos. |
| Transversales          |      16       | A consolidar  | Docker local, paridad Postgres/Supabase, OpenAPI y suites de test en serie. |
| **Total**              |   **118**     | A consolidar  | **Alcance funcional 100% implementado.** |

### Seguimiento de las 6 acciones del Sprint 1

1. `go test ./... -p 1`, nunca en paralelo → **CUMPLIDA** (100% de las corridas en serie, 178 tests verdes en serie).
2. Línea de integración en la estimación → **CUMPLIDA** (T-00.01 a T-00.07 presupuestadas y ejecutadas: 16 hs).
3. Documentar cada HU al cerrarla → **CUMPLIDA** (documentación técnica e informe cerrados concurrentemente).
4. Repasar CAs sobre la interfaz que nombran → **CUMPLIDA** (validado en Web y en Mobile).
5. Test de lista vacía en cada lista → **CUMPLIDA** (historial vacío, tracking sin eventos, listados).
6. Suites completas antes de cerrar → **CUMPLIDA** (293 tests activos verificados en verde).

### Conclusiones de Retrospectiva

**¿Qué salió bien?**
- La estrategia de contratos primero (`openapi.yaml` + matrices de dominio puras + migraciones SQL) eliminó el retrabajo entre los desarrolladores de frontend, móvil y backend.
- La suite de 293 pruebas automáticas otorgó confianza total para refactorizar y optimizar componentes sin temor a regresiones.
- La integración de firmas y fotos con validación estricta de magic bytes y almacenamiento directo garantizó robustez sin dependencias de servicios externos complejos.

**¿Qué podemos mejorar?**
- Prever la gestión de permisos en GitHub desde el inicio del sprint para evitar demoras en la publicación de ramas.
- Estandarizar la carga de variables de entorno en Windows PowerShell para evitar problemas de escape con caracteres especiales (`$$`).

**Acciones para el Sprint 3:**
1. Mantener la suite completa corriendo en serie antes de cada integración a la rama principal.
2. Crear un generador de datos y seeds analíticos para facilitar el desarrollo del Dashboard en tiempo real (HU-11) y Reportes (HU-13).
3. Diseñar la capa de geolocalización y mapas (HU-12) reutilizando las estructuras de coordenadas ya proyectadas en el modelo.

---

*Documento del Sprint 2 — Proyecto Movii — UTN FRSF — Ingeniería y Calidad del Software — 2026*
