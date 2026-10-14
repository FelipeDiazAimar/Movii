# Sprint 1 — Trabajo Final Integrador

## Sistema de Gestión de Envíos y Distribución — Movii

---

**UTN — Facultad Regional San Francisco**

**Cátedra:** Ingeniería y Calidad del Software

**Docentes:** Gandino, Diego · Saldarini, Javier Daniel

**Grupo N° 7:** Araya, Ulises · Díaz Aimar, Felipe · Micheloud, Jeremías

**Duración del Sprint:** 30 días (04/08/2026 – 02/09/2026)

**Presentación del Backlog:** Miércoles 19/08/2026 · **Presentación del Sprint:** Miércoles 09/09/2026 (reprogramada; fecha original 02/09/2026)

---

## 1. Objetivo del Sprint

Implementar las funcionalidades prioritarias del sistema que conforman el **MVP**: registro de envíos, gestión de usuarios y autenticación, asignación de envíos a repartidores y rutas, y consulta del listado de envíos del día por parte del repartidor.

> **Meta:** Al finalizar el sprint, un operador logístico podrá registrar un envío, asignarlo a un repartidor con una ruta, y el repartidor podrá visualizar sus envíos asignados para el día.

**Reparto por interfaz:** HU-01 a HU-04 se implementan en la **aplicación web** (panel del operador logístico / supervisor). HU-05 se implementa en la **app móvil nativa** del repartidor. Ambas interfaces consumen la misma API y comparten la base de datos Supabase. El detalle del stack de cada parte está en el documento *Trabajo Integrador Sprint 0* (parte web) y en la sección de tareas transversales de este documento (parte móvil).

---

## 2. Product Backlog priorizado

| ID    | Historia de Usuario                         | Prioridad | Valor | SP | Sprint      |
| ----- | ------------------------------------------- | --------- | :---: | :-: | ----------- |
| HU-01 | Registro y autenticación de usuarios       | Muy Alta  |   8   |  8 | ✅ Sprint 1 |
| HU-02 | Registro de envíos                         | Muy Alta  |   8   |  5 | ✅ Sprint 1 |
| HU-03 | Gestión de rutas diarias                   | Alta      |   5   |  5 | ✅ Sprint 1 |
| HU-04 | Asignación de envíos a ruta y repartidor  | Alta      |   5   |  5 | ✅ Sprint 1 |
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

Las fichas completas de cada Historia de Usuario (descripción, criterios de aceptación y propiedades) se encuentran detalladas en el documento **Sprint Backlog 1**.

### 2.1 Modificaciones al Product Backlog durante el Sprint 1

*(A completar en la retrospectiva.)*

Durante la ejecución del Sprint 1 **no se modificó el alcance ni la priorización del Product Backlog**: las 15 HU y su asignación a sprints se mantienen como se presentaron el 19/08. Si durante el sprint surgen cambios (HU nuevas, re-priorización, división de una HU, ajuste de criterios de aceptación), se listan aquí con fecha y motivo.

| Fecha | Cambio | HU afectada(s) | Motivo |
| ----- | ------ | -------------- | ------ |
| —     | Sin modificaciones registradas a la fecha | — | — |

---

## 3. Estimaciones de Valor y Esfuerzo

**Escalas utilizadas:**

- **Valor de Negocio:** 1 (soporte) · 2 (útil) · 3 (operativo) · 5 (central) · 8 (imprescindible).
- **Esfuerzo (SP — Fibonacci):** 1 (trivial) · 2 (directo) · 3 (moderado) · 5 (significativo) · 8 (complejo) · 13 (muy complejo).

| ID    | Historia de Usuario                 | Valor | SP | V/E  | Responsable          |
| ----- | ----------------------------------- | :---: | :-: | :--: | -------------------- |
| HU-01 | Registro y autenticación           |   8   |  8 | 1.00 | Micheloud, Jeremías |
| HU-02 | Registro de envíos                 |   8   |  5 | 1.60 | Díaz Aimar, Felipe  |
| HU-03 | Gestión de rutas diarias           |   5   |  5 | 1.00 | Araya, Ulises        |
| HU-04 | Asignación de envíos              |   5   |  5 | 1.00 | Díaz Aimar, Felipe  |
| HU-05 | Listado del repartidor              |   5   |  3 | 1.67 | Araya, Ulises        |
|       | **Total**                           |**31** |**26**|     |                      |

**Capacidad:** 3 integrantes × 30 días × ~2 hs/día = **180 horas** · **Estimado total de tareas:** 197 horas (según el desglose tarea por tarea del Sprint Backlog 1).

> Margen ajustado. Se priorizan HU-01 y HU-02 y se evalúa en dailys si es necesario renegociar alcance.

---

## 4. Sprint Backlog — Desglose de tareas

> Vista resumida. El desglose canónico tarea por tarea (con fases análisis / diseño / desarrollo / prueba y columnas Estimado y Real) está en el documento **Sprint Backlog 1**. Los subtotales de ambos documentos coinciden.

### HU-01 — Registro y autenticación de usuarios (Micheloud)

| #       | Fase       | Tarea                                                       | Est. (hs) | Real (hs) |
| ------- | ---------- | ----------------------------------------------------------- | :-------: | :-------: |
| T-01.01 | Análisis  | Definir flujo de autenticación (registro, login, roles)    |     2     |           |
| T-01.02 | Análisis  | Especificar endpoints de la API de autenticación           |     2     |           |
| T-01.03 | Análisis  | Definir política de contraseñas y validaciones            |     1     |           |
| T-01.04 | Diseño    | Diseñar modelo de datos tabla usuarios                     |     2     |           |
| T-01.05 | Diseño    | Diseñar interfaz de login y registro de usuarios           |     5     |           |
| T-01.06 | Desarrollo | Crear migración BD + endpoints register/login/users         |    12     |           |
| T-01.07 | Desarrollo | Implementar middleware de autenticación y autorización     |     4     |           |
| T-01.08 | Desarrollo | Implementar pantallas de login y registro en frontend       |     7     |           |
| T-01.09 | Prueba     | Pruebas unitarias + integración + exploratoria             |     8     |           |
|         |            | **Subtotal HU-01**                                          |  **43**   |           |

### HU-02 — Registro de envíos (Díaz Aimar)

| #       | Fase       | Tarea                                                       | Est. (hs) | Real (hs) |
| ------- | ---------- | ----------------------------------------------------------- | :-------: | :-------: |
| T-02.01 | Análisis  | Definir campos, validaciones y formato código de guía      |     5     |           |
| T-02.02 | Diseño    | Diseñar modelo datos (envíos, remitentes, destinatarios) e interfaces |     8     |           |
| T-02.03 | Desarrollo | Crear migraciones + endpoints POST/GET /envios              |    11     |           |
| T-02.04 | Desarrollo | Implementar formulario y lista de envíos en frontend        |     7     |           |
| T-02.05 | Prueba     | Pruebas unitarias + integración + exploratoria             |     7     |           |
|         |            | **Subtotal HU-02**                                          |  **38**   |           |

### HU-03 — Gestión de rutas diarias (Araya)

| #       | Fase       | Tarea                                                       | Est. (hs) | Real (hs) |
| ------- | ---------- | ----------------------------------------------------------- | :-------: | :-------: |
| T-03.01 | Análisis  | Definir campos, estados y endpoints de rutas                |     3     |           |
| T-03.02 | Diseño    | Diseñar modelo datos tabla rutas e interfaz                |     5     |           |
| T-03.03 | Desarrollo | Crear migración + endpoints POST/GET/PUT /rutas            |    11     |           |
| T-03.04 | Desarrollo | Implementar pantalla gestión de rutas en frontend          |     5     |           |
| T-03.05 | Prueba     | Pruebas unitarias + integración + exploratoria             |     6     |           |
|         |            | **Subtotal HU-03**                                          |  **30**   |           |

### HU-04 — Asignación de envíos a ruta (Díaz Aimar)

| #       | Fase       | Tarea                                                       | Est. (hs) | Real (hs) |
| ------- | ---------- | ----------------------------------------------------------- | :-------: | :-------: |
| T-04.01 | Análisis  | Definir reglas de negocio y endpoints de asignación        |     4     |           |
| T-04.02 | Diseño    | Diseñar interfaz de asignación y flujo de selección      |     5     |           |
| T-04.03 | Desarrollo | Implementar endpoints asignación/desasignación + validaciones |    10     |           |
| T-04.04 | Desarrollo | Implementar pantalla de asignación en frontend             |     7     |           |
| T-04.05 | Prueba     | Pruebas unitarias + integración + exploratoria             |     7     |           |
|         |            | **Subtotal HU-04**                                          |  **33**   |           |

### HU-05 — Listado del repartidor (Araya)

| #       | Fase       | Tarea                                                       | Est. (hs) | Real (hs) |
| ------- | ---------- | ----------------------------------------------------------- | :-------: | :-------: |
| T-05.01 | Análisis  | Definir datos, filtrado y endpoint del repartidor           |     2     |           |
| T-05.02 | Diseño    | Diseñar interfaz vista repartidor y resumen del día        |     5     |           |
| T-05.03 | Desarrollo | Implementar endpoint + agrupación por ruta                 |     5     |           |
| T-05.04 | Desarrollo | Implementar vista en app móvil + filtros + resumen         |     9     |           |
| T-05.05 | Prueba     | Pruebas unitarias + exploratoria en dispositivo móvil      |     4     |           |
|         |            | **Subtotal HU-05**                                          |  **25**   |           |

### Tareas transversales

| #       | Tarea                                                                | Responsable | Est. (hs) | Real (hs) |
| ------- | -------------------------------------------------------------------- | ----------- | :-------: | :-------: |
| T-00.01 | Diseñar modelo de datos completo del sprint                         | Equipo      |     4     |           |
| T-00.02 | Configurar proyecto Go (rutas, middleware, conexión BD)             | Micheloud   |     4     |           |
| T-00.03 | Configurar Supabase (proyecto + conexión desde Go)                 | Micheloud   |     3     |           |
| T-00.04 | Configurar React Native con Expo (pantalla base, navegación)       | Araya       |     3     |           |
| T-00.05 | Configurar proyecto web (TypeScript, componentes base, cliente HTTP) | Díaz Aimar |     3     |           |
| T-00.06 | Configurar CI/CD en GitHub Actions (lint + tests)                    | Micheloud   |     2     |           |
| T-00.07 | Documentar endpoints en Swagger/OpenAPI                              | Equipo      |     3     |           |
| T-00.08 | Prueba de integración E2E del flujo completo + code review         | Equipo      |     6     |           |
|         | **Subtotal Transversales**                                           |             |  **28**   |           |

### Resumen de horas

| Grupo                  | Horas Est. |
| ---------------------- | :--------: |
| HU-01 — Autenticación |     43     |
| HU-02 — Envíos        |     38     |
| HU-03 — Rutas         |     30     |
| HU-04 — Asignación   |     33     |
| HU-05 — Repartidor    |     25     |
| Transversales          |     28     |
| **Total Sprint 1**     |  **197**   |

---

## 5. Modelo de Datos

El modelo de datos cubre las necesidades de almacenamiento de las 5 HU del sprint. Se compone de 5 tablas:

**`usuarios`** — id (UUID, PK), nombre, email (UNIQUE), password_hash, rol (operador/repartidor/supervisor), activo, created_at, updated_at.

**`envios`** — id (UUID, PK), codigo_guia (UNIQUE, formato MOV-YYYYMMDD-XXXX), estado (pendiente/asignado/en_camino/entregado/no_entregado), peso, tamano (chico/mediano/grande), tipo_contenido, fragil, urgente, remitente_id (FK), destinatario_id (FK), ruta_id (FK, nullable), created_at, updated_at.

**`remitentes`** — id (UUID, PK), nombre, telefono, direccion, created_at.

**`destinatarios`** — id (UUID, PK), nombre, telefono, calle, numero, piso_depto, localidad, codigo_postal, created_at.

**`rutas`** — id (UUID, PK), nombre, zona, fecha, estado (planificada/en_curso/completada), repartidor_id (FK → usuarios), created_at, updated_at.

**Relaciones:**

```
  usuarios ◄──(1:N)── rutas ◄──(1:N)── envios ──(N:1)──► remitentes
                                           │
                                           └──(N:1)──► destinatarios
```

---

## 6. Implementación

Las 5 HU del sprint están implementadas y funcionando de punta a punta contra una base Supabase real (no es un mock). A continuación se detalla cómo se resolvió cada una, con evidencia tomada del sistema corriendo en este momento.

### 6.1 Arquitectura entregada

- **API REST en Go** (`gestion-envios/services/api`): router `chi`, acceso a datos con `pgx` (sin ORM), capas `handlers → services → repository`. Base de datos PostgreSQL gestionada por Supabase.
- **App móvil nativa** (`gestion-envios/apps/mobile`, Expo + React Native): vista del repartidor, reconectada a la API real (login y "Mi ruta de hoy" con datos reales; el resto de las pantallas del prototipo — confirmar entrega, incidencias, reprogramar — corresponden a HU de Sprint 2/3 y siguen como maqueta).
- Autenticación por JWT propio (HS256) con roles (`operador`, `repartidor`, `supervisor`) validados en cada endpoint protegido.

### 6.2 HU-01 — Registro y autenticación de usuarios

Endpoints: `POST /auth/register`, `POST /auth/login`, `GET /users` (solo `supervisor`).

```
$ curl -X POST localhost:8080/auth/login -d '{"email":"supervisor@movii.demo","password":"Movii2026!"}'
→ 200 { "token": "eyJhbGciOi..." }

$ curl localhost:8080/users -H "Authorization: Bearer <token-supervisor>"
→ 200 [ {"id":"...","nombre":"Ana Supervisora","email":"supervisor@movii.demo","rol":"supervisor","activo":true}, ... ]

$ curl localhost:8080/users -H "Authorization: Bearer <token-repartidor>"
→ 403 {"error":{"code":"rol_no_autorizado","message":"no tenés permisos para esta acción"}}
```

Commits: `4111098`, `daaaeb4`, `678f80c`, `ed418bc`, `974963d`, `82642bf`, `724190a`, `62172e6`, `fbf402b`.

### 6.3 HU-02 — Registro de envíos

`POST /envios` crea remitente, destinatario y envío en una única transacción, y genera el código de guía único (`MOV-YYYYMMDD-XXXX`, con reintento automático ante colisión).

```
$ curl -X POST localhost:8080/envios -H "Authorization: Bearer <token-supervisor>" -d '{
    "remitente": {"nombre": "Depósito Central"},
    "destinatario": {"nombre": "Cliente Doc Test", "calle": "Mitre", "numero": "250", "localidad": "San Francisco", "codigo_postal": "X2400"},
    "paquete": {"peso": 3.5, "tamano": "mediano", "tipo_contenido": "Ropa"}
  }'
→ 201 {"codigo_guia":"MOV-20260907-0001","estado":"pendiente","id":"f2ab3067-...","peso":3.5,"tamano":"mediano"}
```

Commits: `23fc0e4`, `8bdd93e`, `986cdb9`, `567e56a`, `3f25367`, `f1953bc`.

### 6.4 HU-03 — Gestión de rutas diarias

`POST /rutas` crea una ruta en estado `planificada`; solo se puede editar (`PUT`) mientras esté en ese estado.

```
$ curl -X POST localhost:8080/rutas -H "Authorization: Bearer <token-supervisor>" -d '{
    "nombre": "Ruta Documentacion", "zona": "Centro", "fecha": "2026-09-07",
    "repartidor_id": "33333333-3333-3333-3333-333333333333"
  }'
→ 201 {"id":"801eacb2-...","nombre":"Ruta Documentacion","zona":"Centro","fecha":"2026-09-07","estado":"planificada", ...}
```

Commits: `c452bc5`, `9fbd852`, `341ccb8`, `f1953bc`.

### 6.5 HU-04 — Asignación de envíos a ruta y repartidor

`POST /rutas/{id}/envios` asigna envíos pendientes (valida que la fecha de la ruta no haya vencido); `DELETE /rutas/{id}/envios/{envioId}` desasigna. El detalle de la ruta muestra el peso total y la cantidad de envíos.

```
$ curl -X POST localhost:8080/rutas/801eacb2-.../envios -H "Authorization: Bearer <token-supervisor>" -d '{"envio_ids":["f2ab3067-..."]}'
→ 200 {"asignados":1}

$ curl localhost:8080/rutas/801eacb2-... -H "Authorization: Bearer <token-supervisor>"
→ 200 {"id":"801eacb2-...", ..., "envios":[{"codigo_guia":"MOV-20260907-0001","estado":"asignado", ...}], "peso_total":3.5, "cantidad_envios":1}
```

Commits: `9fbd852`, `341ccb8`, `f1953bc`.

### 6.6 HU-05 — Listado de envíos del día para repartidor

`GET /repartidor/envios-del-dia` identifica al repartidor por el JWT (nunca por un parámetro de la URL, para que uno no pueda pedir los envíos de otro), agrupa por ruta y devuelve el resumen del día.

```
$ curl localhost:8080/repartidor/envios-del-dia -H "Authorization: Bearer <token-repartidor>"
→ 200 {
    "fecha": "2026-09-07",
    "rutas": [{"ruta_id":"801eacb2-...","ruta_nombre":"Ruta Documentacion","envios":[{"codigo_guia":"MOV-20260907-0001","estado":"asignado", ...}]}],
    "total": 1, "pendientes": 0, "asignados": 1, "en_camino": 0, "entregados": 0, "no_entregados": 0
  }

$ curl localhost:8080/repartidor/envios-del-dia -H "Authorization: Bearer <token-operador>"
→ 403 (un operador no puede pedir la vista del repartidor)
```

**App móvil:** la pantalla de login pide email y contraseña reales contra `POST /auth/login`; "Mi ruta de hoy" consume este endpoint y muestra los envíos reales del repartidor logueado (`repartidor@movii.demo`) con pull-to-refresh. Se probó en un iPhone físico vía Expo Go, en la misma red WiFi que la API. La pantalla cubre los criterios de aceptación de la HU así:

| CA | Cómo se resuelve en la app |
| -- | -------------------------- |
| CA-01 | El listado sale del JWT del repartidor logueado: la pantalla nunca manda un id de repartidor. |
| CA-02 | Cada tarjeta muestra destinatario, dirección + localidad, código de guía completo, peso y el badge de estado. |
| CA-03 | Una sección por ruta (`SectionList`), con encabezado y cantidad de envíos cuando el repartidor tiene más de una ruta en el día. |
| CA-04 | Chips de filtro por estado (Todos / Asignados / En camino / Entregados / No entregados) que filtran la lista al instante. |
| CA-05 | Tarjeta de resumen con total, entregados, pendientes y no entregados, más el porcentaje de avance del día. Los contadores describen el día completo y no cambian al aplicar un filtro. |
| CA-06 | Layout mobile-first heredado del prototipo (probado en iPhone, 390×844). |

Commits: `5c75dfb`, `926a7b9`, `618c883`, `ed4ef1e`, `7828f31` (API); `8b02191`, `1980931`, `5b79da1`, `ac9d5a9`, `6278548` (móvil).

### 6.7 Testing

Los tests de la API corren contra una base PostgreSQL (Supabase) real (no hay mocks de base de datos): repositorios, servicios de negocio y handlers, más un test end-to-end por cada bloque de HU que ejercita el flujo completo por HTTP (login → operación → verificación). Se ejecutan con `go test ./... -p 1` (la ejecución en serie evita que dos paquetes toquen la base al mismo tiempo).

| Suite | Tests | Resultado |
| ----- | :---: | --------- |
| API (Go, `services/api`) | 82 | 82 pasan · 0 fallan · 0 se saltean |
| App móvil (vitest, `apps/mobile`) | 19 | 19 pasan (queda 1 salteado: un test de la plantilla del prototipo que no aplica al proyecto) |
| **Total** | **101** | |

Además de los tests automatizados se corrió una batería de pruebas manuales por HTTP sobre la API en funcionamiento, criterio de aceptación por criterio de aceptación (ver 6.8).

Durante la implementación se encontraron y corrigieron **6 bugs reales** gracias a este testing: un import circular en el router, un cast de enum faltante en el alta de usuarios, un timing oracle en el login (la respuesta tardaba distinto según si el email existía o no), un hash de contraseña del seed que no correspondía a la contraseña de la demo, un bug de huso horario en la validación de "fecha vencida" de las rutas, y un test de migraciones que rompía datos de otros paquetes al compartir la misma base.

Ambas suites corren en CI (GitHub Actions): `api-ci.yml` para la API y `mobile-ci.yml` (chequeo de tipos + tests) para la app móvil.

### 6.8 Revisión de cierre del sprint

Antes de dar el sprint por cerrado se volvieron a probar las cinco HU de punta a punta —las cuatro que ya estaban testeadas (HU-01 a HU-04) y la última en terminarse (HU-05)—: se corrieron las dos suites completas y se ejercitó cada criterio de aceptación por HTTP contra la API levantada. La revisión encontró **8 defectos** que no habían aparecido antes. Todos quedaron corregidos y cubiertos con tests de regresión.

| # | HU | Defecto | Corrección |
| - | -- | ------- | ---------- |
| 1 | HU-05 | `GET /repartidor/envios-del-dia` devolvía `"rutas": null` cuando el repartidor no tenía envíos asignados para el día. La app móvil recorre esa lista directamente y rompía: en lugar del estado vacío mostraba "No se pudo cargar la ruta del día", como si fuera un problema de conexión. Es el caso de un repartidor que arranca el día sin asignaciones, o sea el más común a primera hora. | El agrupador devuelve siempre un slice inicializado, así el JSON dice `"rutas": []`. Se aplicó lo mismo a los listados de envíos y de rutas, y el cliente móvil normaliza `null` por las dudas. |
| 2 | HU-04 | La asignación de envíos a una ruta no era atómica: al mandar un lote que mezclaba un envío pendiente con otro ya asignado, la API respondía 409 "uno o más envíos no están pendientes" pero el envío pendiente **quedaba asignado igual**. El operador leía que no se había asignado nada mientras la base decía lo contrario. | El `UPDATE` pasó a correr dentro de una transacción con rollback: la asignación es todo o nada. Además se descartan los ids repetidos y la respuesta informa cuántos envíos se asignaron realmente, en vez de cuántos se pidieron. |
| 3 | HU-05 | La app móvil no agrupaba visualmente por ruta (CA-03): mostraba una lista plana y en el encabezado solo el nombre de la primera ruta. Un repartidor con dos rutas no podía ver dónde terminaba una y empezaba la otra. | La pantalla pasó a `SectionList` con un encabezado por ruta (nombre + cantidad de envíos) cuando hay más de una. |
| 4 | HU-05 | La app móvil no tenía el filtro por estado (CA-04). El endpoint ya aceptaba `?estado=`, pero la interfaz no lo ofrecía. | Se agregaron chips de filtro por estado sobre la lista. El filtro usa el estado real de la API (`asignado`) y no el estado visual del prototipo, que colapsa `asignado` en `pendiente`. |
| 5 | HU-05 | El resumen del día (CA-05) estaba incompleto: no mostraba los no entregados, y el contador rotulado "por visitar" en realidad mostraba el total de envíos. | El resumen muestra total, entregados, pendientes y no entregados. Se calcula sobre el día completo, así que no se mueve al aplicar un filtro. |
| 6 | HU-02 | CA-05 pide que el listado de envíos muestre la fecha de creación, y la respuesta de `GET /envios` no la incluía. | Se agregó `fecha_creacion` al listado y al detalle del envío. |
| 7 | HU-05 | El test `TestRepartidorService_EnviosDelDia` dejaba una fila huérfana en `rutas` en cada corrida: registraba dos `t.Cleanup` separados y, como corren en orden inverso al de registro, intentaba borrar la ruta antes que el envío que la referenciaba; el `DELETE` fallaba por la foreign key y el error se descartaba. Es la fuente de los "datos que hubo que limpiar a mano" que menciona la retrospectiva. | Un único `Cleanup` con el orden de borrado correcto. Verificado: dos corridas completas de la suite ya no dejan filas nuevas. |
| 8 | HU-01 | Dos huecos en la validación del token: el parser aceptaba cualquier algoritmo que el propio token declarara, en vez de exigir HS256 (el único con el que la API firma); y `Login` no miraba el campo `activo`, así que un usuario dado de baja podía seguir entrando. | Se fija HS256 en la validación y se rechaza el login de usuarios inactivos, con el mismo error genérico de siempre para no revelar qué cuentas existen. |

También se unificó el huso horario del código de guía: se calculaba con la hora local de la máquina mientras el resto del sistema usa UTC, así que cerca de la medianoche un envío podía quedar fechado un día distinto al que la API considera "hoy".

---

## 7. Cronograma y Burndown Chart

### Cronograma semanal

| Semana | Período        | Actividades principales                                              |
| :----: | --------------- | --------------------------------------------------------------------- |
|   1    | 04/08 – 10/08  | Análisis y diseño de todas las HU. Modelo de datos. Config proyectos.|
|   2    | 11/08 – 17/08  | Desarrollo HU-01 y HU-02. Migraciones BD. Inicio frontend.          |
|   —    | **19/08**      | **Presentación del Product Backlog y Sprint Backlog**                |
|   3    | 18/08 – 24/08  | Desarrollo HU-03 y HU-04. Pruebas unitarias de HU-01 y HU-02.      |
|   4    | 25/08 – 01/09  | Desarrollo HU-05. Pruebas integración y exploratorias. Documentación.|
|   —    | **09/09**      | **Presentación del Sprint 1 y Retrospectiva** (reprogramada desde 02/09)  |

### Burndown Chart

| Fecha            | SP Ideal | SP Real | Horas Ideal | Horas Real |
| ---------------- | :------: | :-----: | :---------: | :--------: |
| 04/08 (inicio)   |    26    |   26    |     197     |    197     |
| 10/08 (semana 1) |    20    |   21    |     158     |    172     |
| 17/08 (semana 2) |    13    |   15    |     118     |    134     |
| 24/08 (semana 3) |     7    |   10    |      79     |     98     |
| 01/09 (semana 4) |     1    |    3    |      39     |     42     |
| 02/09 (cierre)   |     0    |    0    |       0     |      0     |

*Nota: las columnas "Real" son una estimación reconstruida al cierre del sprint (no se registraron horas día por día durante la ejecución) — ver el detalle y las causas del desvío en la sección 9.*

---

## 8. Criterios del Sprint

### Definition of Done (DoD)

1. Código revisado por al menos un compañero vía pull request.
2. Código sigue lineamientos de estilo (ESLint + Prettier / gofmt).
3. Funcionalidad probada manualmente con casos positivos y negativos.
4. Pruebas unitarias para lógica de negocio (cobertura mínima 70%).
5. Integrado en rama `develop` sin conflictos; CI pasa sin errores.
6. Documentación de API actualizada en Swagger si afecta endpoints.
7. Historia demostrada y aprobada por el equipo en revisión de sprint.
8. Sin bugs de severidad alta o crítica pendientes.

### Convenciones del equipo

- **Ramas:** `feature/HU-XX-descripcion-breve`
- **Commits:** en español, prefijo con ID de tarea (ej: `T-02.03: implementar POST /envios`)
- **Pull Requests:** descripción + checklist de DoD + screenshots si aplica
- **Daily Standup:** comunicación asíncrona por Discord (3 preguntas clásicas)
- **Bugs:** issues en GitHub con etiqueta `bug` y severidad. Alta/crítica bloquea sprint.

---

## 9. Retrospectiva — Teórico vs. Real

*Nota metodológica: el equipo no llevó una planilla de horas día por día durante la ejecución del sprint. Los números "Real" de esta sección son una reconstrucción hecha al cierre, a partir del trabajo efectivamente terminado (commits, tests y funcionalidad verificada) y no una medición cronometrada — se dejan aquí para cumplir con el ejercicio de comparar lo estimado contra lo real y para que la conversación de retrospectiva tenga una base concreta, no como un registro exacto minuto a minuto.*

### Resumen por grupo de tareas

| Grupo                  | Estimado (hs) | Real (hs) | Diferencia | Observaciones |
| ---------------------- | :-----------: | :-------: | :--------: | ------------- |
| HU-01 — Autenticación |      43       |    49     |    +6      | El cast de enum, el timing oracle del login y el bug de import circular del router salieron durante el testeo y llevaron tiempo extra de diagnóstico. |
| HU-02 — Envíos        |      38       |    36     |    -2      | La transacción de alta (remitente + destinatario + envío) resultó más directa de lo estimado una vez definido el patrón de `Querier`. |
| HU-03 — Rutas         |      30       |    33     |    +3      | Sin sorpresas grandes; algo más de tiempo en el detalle de ruta con envíos y totales. |
| HU-04 — Asignación   |      33       |    40     |    +7      | El bug de huso horario en "fecha vencida" (UTC vs. hora local) costó una sesión de debugging completa. |
| HU-05 — Repartidor    |      25       |    31     |    +6      | La estimación original no contemplaba reconectar la app móvil real ni el upgrade de Expo SDK 54→57 que hizo falta para probar en un iPhone. |
| Transversales          |      28       |    35     |    +7      | Se subestimó el trabajo de "pegar" las piezas: mover el prototipo al monorepo, configurar el workspace de pnpm, y reparar un script de arranque roto en Windows. |
| **Total Sprint**       |   **197**     | **224**   |   **+27**  | ~14% por encima de lo estimado, explicado casi todo por bugs reales encontrados con testing (no por errores de estimación de las HU en sí). |

### Resumen por integrante

| Integrante           | HU asignadas            | Horas estimadas | Horas reales | Diferencia |
| -------------------- | ----------------------- | :-------------: | :----------: | :--------: |
| Micheloud, Jeremías | HU-01 + Transversales   |       52        |      60      |     +8     |
| Díaz Aimar, Felipe  | HU-02, HU-04 + Transv.  |       77        |      84      |     +7     |
| Araya, Ulises        | HU-03, HU-05 + Transv.  |       68        |      80      |    +12     |
|                      | **Total**               |     **197**     |   **224**    |    **+27** |

### Preguntas de Retrospectiva

**¿Qué salió bien?**
- Testear contra la base Supabase real (nada de mocks de base de datos) hizo que aparecieran bugs que un mock nunca hubiera mostrado: un cast de enum, un timing oracle en el login, un bug de huso horario en "fecha vencida". Encontrarlos ahora, con tests automatizados, salió mucho más barato que encontrarlos en producción.
- La API terminó cubriendo las 5 HU del sprint de punta a punta, verificada con requests reales (no solo "en teoría") y con la app corriendo en un teléfono físico.
- Reusar el diseño visual del prototipo (en vez de rehacerlo) permitió no perder tiempo en pantallas nuevas y enfocar el esfuerzo en conectar datos reales.
- Volver a testear las cinco HU al cierre, en vez de confiar en que las ya cerradas seguían bien, sacó a la luz 8 defectos más (ver 6.8), entre ellos dos serios: la app se rompía con un repartidor sin envíos asignados, y una asignación fallida podía dejar envíos asignados igual.

**¿Qué podemos mejorar?**
- La estimación inicial no contempló el trabajo de integración (reconectar el móvil, actualizar el SDK de Expo, mover el proyecto al monorepo) como una tarea propia — quedó "escondido" dentro de HU-05 y de las transversales, y por eso ahí es donde más se desvió.
- Al no tener una base de datos aislada por desarrollador, corrimos el mismo test suite completo dos veces en paralelo sin querer y eso dejó datos corruptos en Supabase que hubo que limpiar a mano.
- La documentación de "cómo se implementó cada HU" se armó recién al final del sprint, no a medida que se cerraba cada una — cuesta más reconstruir el detalle después que documentarlo en el momento.
- Los tests cubrían bien el camino feliz y muy poco los casos vacíos. El bug más grave del sprint (la pantalla del repartidor rompiéndose cuando no hay envíos) vivía justo ahí: en el día sin datos, que nadie había probado.
- Se dio por cumplida una HU sin recorrer sus criterios de aceptación uno por uno. En HU-05, tres de los seis criterios (agrupar por ruta, filtrar por estado y el resumen del día) estaban resueltos en la API pero no en la pantalla, que es donde el criterio los pide.
- La documentación del sprint describía la app con más funcionalidad de la que tenía ("agrupados por ruta" cuando la lista era plana). Describir a partir del código y no de la intención.

**¿Qué acciones concretas tomamos para el próximo sprint?**
- Agregar al Definition of Done: correr `go test ./... -p 1` (nunca en paralelo con otra corrida) antes de dar por cerrada una tarea que toca la base compartida.
- Sumar una línea explícita de "integración y despliegue" en la tabla de estimación de cada sprint, en vez de darla por incluida en el desarrollo de cada HU.
- Completar la sección de Implementación de a una HU por vez, apenas queda terminada y verificada, no todas juntas al final.
- Sumar al Definition of Done un repaso explícito de los criterios de aceptación de la HU sobre la interfaz que el criterio nombra (si el CA dice "la vista muestra", no alcanza con que el endpoint lo devuelva).
- Escribir, para cada endpoint que devuelve una lista, un test con la lista vacía además del test con datos.
- Correr las dos suites completas (API y móvil) antes de cerrar el sprint, no solo la de la parte que se tocó al final.

---

*Documento del Sprint 1 — Proyecto Movii — UTN FRSF — Ingeniería y Calidad del Software — 2026*
