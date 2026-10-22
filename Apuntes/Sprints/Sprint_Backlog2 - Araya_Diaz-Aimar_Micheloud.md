# Sprint Backlog 2

## Sistema de Gestión de Envíos y Distribución — Movii

**Cátedra:** Ingeniería y Calidad del Software

**Integrantes del Grupo Nro 7:**

- Araya, Ulises
- Díaz Aimar, Felipe
- Micheloud, Jeremías

**Docentes:**

- Gandino, Diego
- Saldarini, Javier Daniel

**Duración del Sprint:** 14 días (10/09/2026 – 24/09/2026)

**Fecha de presentación del Backlog:** Jueves 10/09/2026

**Fecha de presentación del Sprint:** Jueves 24/09/2026 (prevista, deadline autoimpuesto del equipo)

---

## 1. Objetivo del Sprint

Implementar el seguimiento completo del ciclo de vida del envío: transiciones de estado durante el reparto (HU-06), registro de entregas fallidas con motivo y foto (HU-07), reprogramación de entregas fallidas (HU-09), confirmación de entrega con firma y foto (HU-08) y tracking público por código de guía (HU-10), con su reflejo en la web operativa y en la app móvil. Al final del sprint, un repartidor podrá avanzar, fallar, confirmar y reprogramar entregas desde el móvil; el operador lo gestionará desde la web; y el cliente final podrá consultar el estado de su paquete sin iniciar sesión.

**Alcance:** completo, sin recortes (decisión del equipo del 10/09/2026). Orden de implementación por dependencias: HU-06 → HU-07 → HU-09 → HU-08 → HU-10.

---

## 2. Product Backlog priorizado

| ID    | Historia de Usuario                         | Prioridad | Sprint      |
| ----- | ------------------------------------------- | --------- | ----------- |
| HU-01 | Registro y autenticación de usuarios       | Muy Alta  | ✅ Sprint 1 |
| HU-02 | Registro de envíos                         | Muy Alta  | ✅ Sprint 1 |
| HU-03 | Gestión de rutas diarias                   | Alta      | ✅ Sprint 1 |
| HU-04 | Asignación de envíos a ruta                | Alta      | ✅ Sprint 1 |
| HU-05 | Listado de envíos del día para repartidor | Alta      | ✅ Sprint 1 |
| HU-06 | Actualización de estado de entrega         | Alta      | Sprint 2    |
| HU-07 | Registro de entrega fallida con motivo      | Alta      | Sprint 2    |
| HU-08 | Confirmación de entrega con firma y foto   | Alta      | Sprint 2    |
| HU-09 | Reprogramación de entregas fallidas        | Media     | Sprint 2    |
| HU-10 | Tracking público por código de guía      | Media     | Sprint 2    |
| HU-11 | Panel de operaciones en tiempo real         | Media     | Sprint 3    |
| HU-12 | Visualización de ruta en mapa (repartidor) | Media     | Sprint 3    |
| HU-13 | Reportes de envíos por período            | Baja      | Sprint 3    |
| HU-14 | Ranking de desempeño de repartidores       | Baja      | Sprint 3    |
| HU-15 | Clasificación de incidencias por motivo    | Baja      | Sprint 3    |

> **Nota sobre HU-04:** a partir de este sprint la HU-04 se titula "Asignación de envíos a ruta" (antes "…a ruta y repartidor"), por corrección del docente en la presentación del Sprint 1: el envío se asigna a una ruta y el repartidor llega vía `rutas.repartidor_id`. Sin cambio de alcance ni de SP. El detalle del ajuste está en la sección 2.1 del informe del Sprint 2.

---

## 3. Historias de Usuario seleccionadas para el Sprint 2

A continuación se presentan las fichas de cada Historia de Usuario seleccionada, con el formato estándar del equipo (el mismo del Sprint Backlog 1). Las decisiones marcadas "a validar" en el borrador quedaron resueltas el 10/09/2026 e incorporadas en los criterios.

**Matriz de transiciones de estado (vale para HU-06/07/08/09):**

```
pendiente --(HU-04 asignar)--> asignado --(HU-06)--> en_camino --(HU-08)--> entregado (terminal)
                                   |                      |
                                   +------(HU-07)--------> no_entregado --(HU-09)--> pendiente
en_camino --(HU-06 volver)--> asignado
```

Reglas: a `entregado` solo se llega por HU-08 (con evidencia); a `no_entregado` solo por HU-07 (con motivo); de `no_entregado` solo se sale por HU-09 (reprogramación). `entregado` es terminal. Cada transición válida registra un evento en el historial del envío (fecha UTC, actor, estado anterior → nuevo, motivo si aplica). La tabla de eventos la lee HU-10.

---

**HU-06**

|                  |                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Título          | Actualización de estado de entrega                                                                                                                          |
|                  | **Descripción**                                                                                                                                         |
| YO COMO          | Repartidor                                                                                                                                                    |
| DESEO            | Actualizar el estado de cada entrega a medida que avanzo en mi ruta (en camino, volver a asignado)                                                            |
| PARA             | Que el sistema refleje el avance real del reparto y el operador tenga visibilidad                                                                              |
|                  | **Criterios de Aceptación**                                                                                                                            |
| CA-01            | El repartidor puede pasar un envío propio de `asignado` a `en_camino` y de `en_camino` a `asignado`. Ambas transiciones quedan registradas en el historial.   |
| CA-02            | El cambio directo a `entregado` o a `no_entregado` por este flujo se rechaza con error claro que indica usar la confirmación (HU-08) o la incidencia (HU-07). No se modifica nada. |
| CA-03            | El repartidor solo puede cambiar envíos de sus rutas (cualquiera de ellas, identificado por JWT). Un envío ajeno o inexistente responde 404 genérico, igual que HU-05. |
| CA-04            | Operador y supervisor pueden cambiar el estado de cualquier envío no final, con las mismas transiciones válidas (correcciones y gestión telefónica).          |
| CA-05            | Cada cambio válido agrega un evento al historial del envío (fecha UTC, actor, estado anterior y nuevo).                                                        |
| CA-06            | En la app móvil, la tarjeta del envío ofrece la acción que corresponde a su estado (ej. "Iniciar" si está asignado).                                          |
| CA-07            | En la web, el operador/supervisor cambia el estado desde el detalle del envío y ve su historial.                                                              |
|                  | **Propiedades**                                                                                                                                          |
| Prioridad        | Alta                                                                                                                                                         |
| Estado           | En curso (API + web terminadas al 10/09; móvil pendiente)                                                                                                     |
| Estimación      | 5 Story Points                                                                                                                                                |
| Valor de negocio | 8                                                                                                                                                             |
| Responsable      | Araya, Ulises (API + web) / Díaz Aimar, Felipe (móvil)                                                                                                       |

---

**HU-07**

|                  |                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Título          | Registro de entrega fallida con motivo                                                                                                                       |
|                  | **Descripción**                                                                                                                                         |
| YO COMO          | Repartidor                                                                                                                                                    |
| DESEO            | Registrar una entrega fallida indicando el motivo, un comentario y una foto opcional                                                                           |
| PARA             | Que la incidencia quede trazada y el envío pueda reprogramarse después                                                                                       |
|                  | **Criterios de Aceptación**                                                                                                                            |
| CA-01            | El motivo es obligatorio y de lista cerrada: cliente ausente, dirección incorrecta, rechazado por destinatario, zona insegura, otro.                           |
| CA-02            | El comentario es libre; obligatorio solo si el motivo es "otro".                                                                                               |
| CA-03            | La foto es opcional y reutiliza el mecanismo de evidencia de HU-08 (base64 en el JSON, BYTEA en la base, límite 5 MB). Se visualiza desde el historial.         |
| CA-04            | Al registrar, el envío pasa a `no_entregado` y se agrega el evento con motivo y comentario.                                                                    |
| CA-05            | Solo sobre envíos `asignados` o `en_camino` del repartidor (propios, de cualquiera de sus rutas) o cualquier envío no final (operador/supervisor).              |
| CA-06            | Solo repartidor (propios) y operador/supervisor. Cualquier otro caso → 403/404 según corresponda.                                                              |
| CA-07            | En la app móvil, pantalla de incidencia sobre la maqueta existente.                                                                                             |
| CA-08            | En la web, el operador/supervisor registra la incidencia desde el detalle del envío y puede ver la foto desde el historial.                                     |
|                  | **Propiedades**                                                                                                                                          |
| Prioridad        | Alta                                                                                                                                                         |
| Estado           | En curso (API + web terminadas al 10/09; móvil pendiente)                                                                                                     |
| Estimación      | 5 Story Points                                                                                                                                                |
| Valor de negocio | 5                                                                                                                                                             |
| Responsable      | Araya, Ulises (API + web) / Díaz Aimar, Felipe (móvil)                                                                                                       |

---

**HU-08**

|                  |                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Título          | Confirmación de entrega con firma y foto                                                                                                                    |
|                  | **Descripción**                                                                                                                                         |
| YO COMO          | Repartidor                                                                                                                                                    |
| DESEO            | Confirmar la entrega registrando quién recibió, su firma digital y una foto del paquete                                                                        |
| PARA             | Que quede evidencia auditable de cada entrega y se cierren reclamos                                                                                            |
|                  | **Criterios de Aceptación**                                                                                                                            |
| CA-01            | Se registran nombre del receptor y relación obligatorios (destinatario, familiar, vecino, encargado).                                                          |
| CA-02            | La firma digital es obligatoria (PNG).                                                                                                                         |
| CA-03            | La foto del paquete es obligatoria (JPEG).                                                                                                                     |
| CA-04            | Al confirmar, el envío pasa a `entregado` y se guarda la evidencia (receptor, firma, foto, fecha) asociada al envío, más el evento en el historial.             |
| CA-05            | Se puede confirmar desde `en_camino` o desde `asignado`; si estaba `asignado`, el historial registra el paso por `en_camino` (dos eventos).                     |
| CA-06            | Solo repartidor (envíos propios, de cualquiera de sus rutas) y operador/supervisor (correcciones).                                                             |
| CA-07            | En la app móvil, pantalla de confirmación sobre la maqueta existente (usa el `signature-pad` del prototipo).                                                    |
| CA-08            | En la web no hay formulario de confirmación (es tarea del móvil): la evidencia (receptor, firma, foto) queda visible en el detalle del envío.                   |
|                  | **Propiedades**                                                                                                                                          |
| Prioridad        | Alta                                                                                                                                                         |
| Estado           | En curso (API + web terminadas al 10/09; móvil pendiente)                                                                                                     |
| Estimación      | 8 Story Points                                                                                                                                                |
| Valor de negocio | 5                                                                                                                                                             |
| Responsable      | Araya, Ulises (API + web) / Díaz Aimar, Felipe (móvil)                                                                                                       |

---

**HU-09**

|                  |                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Título          | Reprogramación de entregas fallidas                                                                                                                          |
|                  | **Descripción**                                                                                                                                         |
| YO COMO          | Operador logístico                                                                                                                                            |
| DESEO            | Reprogramar un envío fallido eligiendo nueva fecha y franja horaria                                                                                            |
| PARA             | Que el envío vuelva al circuito de reparto en lugar de quedar olvidado                                                                                         |
|                  | **Criterios de Aceptación**                                                                                                                            |
| CA-01            | Solo se puede reprogramar un envío en estado `no_entregado`. Otro estado → error claro sin cambios.                                                            |
| CA-02            | La nueva fecha es obligatoria y no puede ser pasada (≥ hoy en UTC).                                                                                            |
| CA-03            | La franja horaria es obligatoria (mañana / tarde / noche).                                                                                                     |
| CA-04            | Al reprogramar, el envío vuelve a `pendiente` para su nueva fecha (se desvincula de la ruta) y se registra el evento (fecha anterior → nueva, motivo original visible). |
| CA-05            | El envío reprogramado aparece como pendiente en los listados de su nueva fecha. Al asignarse a una ruta, la fecha de la ruta manda y se limpian los datos de reprogramación. |
| CA-06            | Notificación al cliente (email/WhatsApp): fuera de alcance. Se deja registrado como decisión (el alcance base lo excluye).                                      |
| CA-07            | Operador/supervisor en la web y repartidor en la app móvil, mismo endpoint.                                                                                     |
|                  | **Propiedades**                                                                                                                                          |
| Prioridad        | Media                                                                                                                                                        |
| Estado           | En curso (API + web terminadas al 10/09; móvil pendiente)                                                                                                     |
| Estimación      | 5 Story Points                                                                                                                                                |
| Valor de negocio | 5                                                                                                                                                             |
| Responsable      | Araya, Ulises (API + web) / Díaz Aimar, Felipe (móvil)                                                                                                       |

---

**HU-10**

|                  |                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Título          | Tracking público por código de guía                                                                                                                         |
|                  | **Descripción**                                                                                                                                         |
| YO COMO          | Cliente final                                                                                                                                                 |
| DESEO            | Consultar el estado de mi envío con el código de guía, sin iniciar sesión                                                                                    |
| PARA             | Saber dónde está mi paquete sin llamar a la empresa                                                                                                            |
|                  | **Criterios de Aceptación**                                                                                                                            |
| CA-01            | Consulta pública sin login por código de guía exacto (`GET /tracking/{codigo}`).                                                                               |
| CA-02            | Muestra: código de guía, estado actual, localidad de entrega e historial de eventos (fecha + descripción/motivo).                                               |
| CA-03            | Nunca expone: teléfonos, emails, dirección exacta (calle/número), nombre del repartidor, comentarios internos ni actor.                                         |
| CA-04            | Código inexistente → 404 genérico, sin revelar información ni sugerir códigos.                                                                                  |
| CA-05            | En la web, página pública `/tracking` con buscador y línea de tiempo con los colores semánticos del sistema.                                                    |
| CA-06            | Los estados se muestran con el mismo lenguaje visual de la app (verde/azul/amarillo/rojo).                                                                      |
|                  | **Propiedades**                                                                                                                                          |
| Prioridad        | Media                                                                                                                                                        |
| Estado           | En curso (API + web terminadas al 10/09)                                                                                                                       |
| Estimación      | 3 Story Points                                                                                                                                                |
| Valor de negocio | 5                                                                                                                                                             |
| Responsable      | Araya, Ulises (API + web)                                                                                                                                      |

---

## 4. Estimaciones de Valor y Esfuerzo

### 4.1 Escala de Valor de Negocio

| Valor | Descripción                                                  |
| ----- | ------------------------------------------------------------- |
| 1     | Bajo — Funcionalidad de soporte o complementaria             |
| 2     | Medio-Bajo — Útil pero no esencial para la operación diaria |
| 3     | Medio — Aporta valor operativo claro                         |
| 5     | Alto — Habilita funcionalidades centrales del sistema        |
| 8     | Muy Alto — Sin esta funcionalidad el sistema no puede operar |

### 4.2 Escala de Esfuerzo (Story Points — Fibonacci)

| Puntos | Descripción                                                                   |
| ------ | ------------------------------------------------------------------------------ |
| 1      | Trivial — Cambio puntual, sin complejidad                                     |
| 2      | Pequeño — Implementación directa, sin incertidumbre                         |
| 3      | Moderado — Requiere diseño y varias tareas coordinadas                       |
| 5      | Significativo — Funcionalidad completa con múltiples componentes             |
| 8      | Complejo — Requiere investigación, integración de capas y pruebas extensivas |
| 13     | Muy Complejo — Alta incertidumbre, múltiples integraciones                   |

### 4.3 Resumen de estimaciones

| ID    | Historia de Usuario                      | Valor de Negocio | Esfuerzo (SP) | Prioridad (V/E) | Responsable                  |
| ----- | ---------------------------------------- | :--------------: | :-----------: | :-------------: | ---------------------------- |
| HU-06 | Actualización de estado de entrega      |        8         |       5       |      1.60       | Araya / Díaz Aimar          |
| HU-07 | Registro de entrega fallida con motivo   |        5         |       5       |      1.00       | Araya / Díaz Aimar          |
| HU-08 | Confirmación de entrega con firma y foto|        5         |       8       |      0.63       | Araya / Díaz Aimar          |
| HU-09 | Reprogramación de entregas fallidas     |        5         |       5       |      1.00       | Araya / Díaz Aimar          |
| HU-10 | Tracking público por código de guía   |        5         |       3       |      1.67       | Araya                        |
|       | **Total Sprint 2**                       |    **28**    |  **26 SP**  |                 |                              |

**Velocidad estimada del equipo:** 26 Story Points por sprint (14 días).

**Capacidad del equipo:** 3 integrantes × 14 días × ~2 hs/día = **~84 horas disponibles**.

**Estimado total de tareas:** 118 horas (según el desglose tarea por tarea de la sección 5).

> Margen excedido (como en el Sprint 1, donde el estimado superó la capacidad nominal). Se sostiene por tres motivos: el alcance completo se decidió explícitamente el 10/09, la carga del móvil corre en paralelo. Se evalúa en dailys si es necesario renegociar alcance; la candidata a recorte, si aprieta el tiempo, es la foto obligatoria de HU-08 (CA-03).

---

## 5. Sprint Backlog — Desglose de tareas

### HU-06 — Actualización de estado de entrega

| #       | Fase       | Tarea                                                                               | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ----------------------------------------------------------------------------------- | :-----------: | :-------: | :----: |
| T-06.01 | Análisis  | Definir matriz de transiciones HU-06 y endpoints PUT /envios/{id}/estado            |       2       |     —     |   ✅   |
| T-06.02 | Análisis  | Definir guards por rol (JWT, 404 genérico para repartidor ajeno)                   |       1       |     —     |   ✅   |
| T-06.03 | Diseño    | Diseñar schema EventoEnvio e historial en el detalle                                |       2       |     —     |   ✅   |
| T-06.04 | Desarrollo | Crear migración 0003 (eventos_envio) + EventoRepo (registrar/listar/pertenencia)   |       3       |     —     |   ✅   |
| T-06.05 | Desarrollo | Implementar EstadoService.CambiarEstado + matriz pura testeable                     |       3       |     —     |   ✅   |
| T-06.06 | Desarrollo | Implementar handler + rutas + wiring (mapeo de errores según openapi)               |       2       |     —     |   ✅   |
| T-06.07 | Desarrollo | Sumar historial al detalle GET /envios/{id} (vacío → [])                           |       2       |     —     |   ✅   |
| T-06.08 | Desarrollo | Implementar acción según estado en tarjeta móvil (Díaz Aimar)                      |       2       |     —     |   ✅   |
| T-06.09 | Desarrollo | Implementar botones de estado + historial en web (Araya)                            |       2       |     —     |   ✅   |
| T-06.10 | Prueba     | Unitarias + integración + E2E seguimiento + caso lista vacía                      |       1       |     —     |   ✅   |
|         |            | **Subtotal HU-06**                                                                  |    **20**     | A consolidar | ✅ |

### HU-07 — Registro de entrega fallida con motivo

| #       | Fase       | Tarea                                                                                | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ------------------------------------------------------------------------------------ | :-----------: | :-------: | :----: |
| T-07.01 | Análisis  | Definir lista cerrada de motivos y regla de comentario/foto                          |       2       |     —     |   ✅   |
| T-07.02 | Diseño    | Diseñar evidencia de incidencia (columna foto, flag tiene_foto)                      |       2       |     —     |   ✅   |
| T-07.03 | Desarrollo | Implementar RegistrarIncidencia + validaciones (motivo/comentario/transición)       |       3       |     —     |   ✅   |
| T-07.04 | Desarrollo | Implementar foto de incidencia (migración 0005 + repo + GET binario)                 |       3       |     —     |   ✅   |
| T-07.05 | Desarrollo | Implementar handler + ruta POST /envios/{id}/incidencia + errores                   |       2       |     —     |   ✅   |
| T-07.06 | Desarrollo | Implementar pantalla de incidencia en móvil (Díaz Aimar)                            |       4       |     —     |   ✅   |
| T-07.07 | Desarrollo | Implementar formulario de incidencia + botón Ver foto en web (Araya)                 |       3       |     —     |   ✅   |
| T-07.08 | Prueba     | Unitarias + integración + E2E (motivo inválido, otro sin comentario, 409, 413)      |       3       |     —     |   ✅   |
|         |            | **Subtotal HU-07**                                                                   |    **22**     | A consolidar | ✅ |

### HU-08 — Confirmación de entrega con firma y foto

| #       | Fase       | Tarea                                                                                 | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ------------------------------------------------------------------------------------- | :-----------: | :-------: | :----: |
| T-08.01 | Análisis  | Definir evidencia obligatoria y regla de doble evento (asignado → en_camino)         |       2       |     —     |   ✅   |
| T-08.02 | Diseño    | Diseñar Confirmacion/metadata + endpoints binarios (firma PNG, foto JPEG)             |       3       |     —     |   ✅   |
| T-08.03 | Desarrollo | Crear ConfirmacionRepo (guardar/obtener, PK = envio_id)                               |       3       |     —     |   ✅   |
| T-08.04 | Desarrollo | Implementar ConfirmarEntrega + matriz (asignado/en_camino → entregado)                |       4       |     —     |   ✅   |
| T-08.05 | Desarrollo | Implementar handler POST + 2 GET binarios + wiring                                    |       3       |     —     |   ✅   |
| T-08.06 | Desarrollo | Sumar metadata (confirmacion + URLs) al detalle                                       |       2       |     —     |   ✅   |
| T-08.07 | Desarrollo | Implementar pantalla de confirmación + signature-pad en móvil (Díaz Aimar)          |       5       |     —     |   ✅   |
| T-08.08 | Desarrollo | Implementar vista de evidencia + descarga blob en web (Araya)                          |       3       |     —     |   ✅   |
| T-08.09 | Prueba     | Unitarias + integración + E2E + 413/magic bytes/reconfirmación 409                  |       3       |     —     |   ✅   |
|         |            | **Subtotal HU-08**                                                                    |    **28**     | A consolidar | ✅ |

### HU-09 — Reprogramación de entregas fallidas

| #       | Fase       | Tarea                                                                                 | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ------------------------------------------------------------------------------------- | :-----------: | :-------: | :----: |
| T-09.01 | Análisis  | Definir reglas de fecha (≥ hoy UTC) y franja obligatoria                             |       2       |     —     |   ✅   |
| T-09.02 | Diseño    | Diseñar columnas reprogramado_para/franja + filtro por fecha                          |       1       |     —     |   ✅   |
| T-09.03 | Desarrollo | Implementar Reprogramar en repo + limpieza al asignar + filtro fecha                  |       3       |     —     |   ✅   |
| T-09.04 | Desarrollo | Implementar service Reprogramar + validaciones (fecha/franja/transición)             |       3       |     —     |   ✅   |
| T-09.05 | Desarrollo | Implementar handler + ruta POST /envios/{id}/reprogramacion                           |       2       |     —     |   ✅   |
| T-09.06 | Desarrollo | Sumar campos al detalle + E2E (reprogramar → listar por fecha → asignar limpia)       |       2       |     —     |   ✅   |
| T-09.07 | Desarrollo | Implementar reprogramación en móvil (Díaz Aimar)                                     |       2       |     —     |   ✅   |
| T-09.08 | Desarrollo | Implementar formulario + etiqueta "comprometido para" en web (Araya)                   |       2       |     —     |   ✅   |
| T-09.09 | Prueba     | Unitarias + integración + E2E (fecha pasada, franja mala, 409)                       |       1       |     —     |   ✅   |
|         |            | **Subtotal HU-09**                                                                    |    **18**     | A consolidar | ✅ |

### HU-10 — Tracking público por código de guía

| #       | Fase       | Tarea                                                                              | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ---------------------------------------------------------------------------------- | :-----------: | :-------: | :----: |
| T-10.01 | Análisis  | Definir columnas blancas y 404 genérico                                            |       1       |     —     |   ✅   |
| T-10.02 | Diseño    | Diseñar TrackingRepo + mapeo evento → descripción legible                          |       2       |     —     |   ✅   |
| T-10.03 | Desarrollo | Completar eventos faltantes (crear/asignar/desasignar)                             |       2       |     —     |   ✅   |
| T-10.04 | Desarrollo | Implementar TrackingRepo + TrackingService + mapeo puro                            |       3       |     —     |   ✅   |
| T-10.05 | Desarrollo | Implementar handler + ruta pública GET /tracking/{codigo}                          |       1       |     —     |   ✅   |
| T-10.06 | Desarrollo | Implementar página pública /tracking en web (Araya)                                |       3       |     —     |   ✅   |
| T-10.07 | Prueba     | Tests no-leak (ausencia de keys sensibles) + E2E ciclo completo                   |       2       |     —     |   ✅   |
|         |            | **Subtotal HU-10**                                                                 |    **14**     | A consolidar | ✅ |

### Tareas transversales del Sprint

| #       | Fase       | Tarea                                                                          | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ------------------------------------------------------------------------------ | :-----------: | :-------: | :----: |
| T-00.01 | Desarrollo | Postgres local Docker + migraciones 0003/0004/0005 (vale igual en Supabase)    |       3       |     —     |   ✅   |
| T-00.02 | Diseño    | Documentar 7 endpoints + schemas nuevos en OpenAPI                             |       2       |     —     |   ✅   |
| T-00.03 | Desarrollo | CI verde (gofmt + go vet + lint + build)                                       |       2       |     —     |   ✅   |
| T-00.04 | Desarrollo | Rama de integración + PRs + revisión cruzada (DoD)                           |       2       |     —     |   ⬜   |
| T-00.05 | Prueba     | E2E del flujo completo del sprint + casos vacíos                              |       3       |     —     |   ✅   |
| T-00.06 | Desarrollo | Docs de cátedra (este backlog + informe del sprint)                            |       2       |     —     |   ✅   |
| T-00.07 | Análisis  | Cierre de contrato API ↔ móvil (endpoints + DTOs en openapi.yaml)            |       2       |     —     |   ✅   |
|         |            | **Subtotal Transversales**                                                     |    **16**     | A consolidar | ⬜ |

### Resumen de horas estimadas

| Historia / Grupo                        | Horas Estimadas | Horas Reales | Estado |
| --------------------------------------- | :-------------: | :----------: | :----: |
| HU-06 — Actualización de estado        |       20        | A consolidar |   ✅   |
| HU-07 — Entrega fallida con motivo      |       22        | A consolidar |   ✅   |
| HU-08 — Confirmación con firma y foto  |       28        | A consolidar |   ✅   |
| HU-09 — Reprogramación                 |       18        | A consolidar |   ✅   |
| HU-10 — Tracking público              |       14        | A consolidar |   ✅   |
| Tareas transversales                    |       16        | A consolidar |   ✅   |
| **Total Sprint 2**                      |   **118**   | A consolidar |   ✅   |

**Capacidad disponible:** 3 integrantes × 14 días × 2 hs/día = **~84 horas**
**Registro de horas reales:** Las horas reales quedan a consolidar por los integrantes del equipo al cierre definitivo de la entrega.

---

## 6. Modelo de Datos

Nuevas estructuras del Sprint 2 (se suman a las 5 tablas del Sprint 1, sin modificarlas salvo dos columnas aditivas en `envios`).

### Tabla eventos_envio (migración 0003)

| Campo           | Tipo                                                        | Restricciones                  | Descripción                                              |
| --------------- | ----------------------------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| id              | UUID                                                        | PK, auto-generado              | Identificador único del evento                           |
| envio_id        | UUID                                                        | FK → envios.id, NOT NULL      | Envío al que pertenece (ON DELETE CASCADE)               |
| estado_anterior | ENUM estado_envio                                           | NULLABLE                       | Estado previo (NULL = evento raíz de creación)           |
| estado_nuevo    | ENUM estado_envio                                           | NOT NULL                       | Estado resultante                                         |
| motivo          | ENUM motivo_fallo                                           | NULLABLE                       | Motivo de fallo (solo incidencias HU-07)                  |
| comentario      | TEXT                                                        | NULLABLE                       | Comentario libre / "reprogramado para …" (HU-09)          |
| foto            | BYTEA                                                       | NULLABLE (migración 0005)      | Foto opcional de la incidencia (HU-07)                    |
| actor_id        | UUID                                                        | FK → usuarios.id, NULLABLE    | Quien hizo el cambio (SET NULL si se borra el usuario)    |
| created_at      | TIMESTAMPTZ                                                 | DEFAULT NOW()                  | Fecha UTC del evento                                      |

Backfill: un evento raíz por cada envío preexistente (`anterior = NULL`, comentario "historial previo al Sprint 2").

### Tabla confirmaciones_entrega (migración 0004)

| Campo             | Tipo                  | Restricciones                | Descripción                              |
| ----------------- | --------------------- | ---------------------------- | ----------------------------------------- |
| envio_id          | UUID                  | PK, FK → envios.id         | Un envío = una confirmación como máximo |
| receptor_nombre   | VARCHAR(100)          | NOT NULL                     | Nombre de quien recibió                  |
| receptor_relacion | ENUM relacion_receptor| NOT NULL                     | destinatario/familiar/vecino/encargado    |
| firma             | BYTEA                 | NOT NULL                     | Firma digital (PNG, ≤ 5 MB)              |
| foto              | BYTEA                 | NOT NULL                     | Foto del paquete (JPEG, ≤ 5 MB)          |
| confirmada_por    | UUID                  | FK → usuarios.id, NULLABLE  | Repartidor/operador que confirmó         |
| confirmada_at     | TIMESTAMPTZ           | DEFAULT NOW()                | Fecha UTC de la confirmación             |

### Columnas nuevas en envios (migración 0004)

| Campo             | Tipo             | Restricciones | Descripción                                                        |
| ----------------- | ---------------- | ------------- | ------------------------------------------------------------------- |
| reprogramado_para | DATE             | NULLABLE      | Nueva fecha comprometida (HU-09). Se limpia al asignar a una ruta.  |
| franja            | ENUM franja_horaria | NULLABLE   | mañana / tarde / noche (HU-09). Se limpia al asignar a una ruta.    |

### Enums nuevos

| Enum              | Valores                                                              |
| ----------------- | --------------------------------------------------------------------- |
| motivo_fallo      | cliente_ausente, direccion_incorrecta, rechazado, zona_insegura, otro |
| franja_horaria    | manana, tarde, noche                                                  |
| relacion_receptor | destinatario, familiar, vecino, encargado                             |

### Relaciones principales (nuevas)

| Relación                                    | Tipo | Descripción                                                                |
| -------------------------------------------- | ---- | --------------------------------------------------------------------------- |
| eventos_envio.envio_id → envios.id          | N:1  | Cada envío tiene muchos eventos (historial). Borrado en cascada.          |
| eventos_envio.actor_id → usuarios.id        | N:1  | Actor opcional del evento. Si se borra el usuario, queda NULL.              |
| confirmaciones_entrega.envio_id → envios.id | 1:1  | Cada envío entregado tiene una única evidencia. Borrado en cascada.         |

```
  usuarios ◄──(1:N)── eventos_envio ──(N:1)──► envios ◄──(1:1)── confirmaciones_entrega
                                           │
              (Sprint 1: rutas / remitentes / destinatarios sin cambios)
```

**Decisión documentada (migración 0004):** firma y foto se guardan como BYTEA en la misma base (sin Supabase Storage ni RLS a mitad del sprint). Vale idéntico en Postgres local y en Supabase; el límite de 5 MB por imagen se valida en el service (413). Si el volumen lo pide a futuro, se migra a Storage conservando estas columnas lógicas.

---

## 7. Criterios generales del Sprint

### 7.1 Definition of Done (DoD)

Una tarea o historia se considera terminada cuando cumple todos los criterios siguientes:

1. El código fue revisado mediante pull request por al menos un compañero.
2. El código sigue los lineamientos de estilo definidos (ESLint + Prettier / gofmt).
3. La funcionalidad fue probada manualmente con casos positivos y negativos.
4. Se escribieron pruebas unitarias para la lógica de negocio (cobertura mínima 70%).
5. El código fue integrado en la rama develop sin conflictos y el CI pasa sin errores.
6. La documentación de la API fue actualizada en Swagger/OpenAPI si el cambio afecta endpoints.
7. La historia fue demostrada y aprobada por el equipo en la revisión de sprint.
8. No hay bugs de severidad alta o crítica pendientes.
9. Antes de dar por cerrada una tarea que toca la base compartida, se corrió `go test ./... -p 1` (nunca en paralelo con otra corrida).
10. Cada endpoint que devuelve una lista tiene un test con la lista vacía además del test con datos.
11. Los criterios de aceptación se repasaron uno por uno sobre la interfaz que el criterio nombra.
12. Las dos suites completas (API y móvil) corren en verde antes de cerrar el sprint, no solo la parte tocada al final.
13. La sección de Implementación del informe se completa HU por HU a medida que se cierran, no toda junta al final.
14. El sprint contempla su línea de "integración y despliegue" en la estimación (sección 5, transversales).

> Los criterios 9 a 14 son las 6 acciones de mejora de la retrospectiva del Sprint 1, incorporadas al DoD de este sprint.

### 7.2 Convenciones del equipo

- **Ramas:** feature/HU-XX-descripcion-breve (ej: feature/sprint2-seguimiento-tracking)
- **Commits:** mensajes en español, prefijo con ID de tarea (ej: T-06.05: implementar CambiarEstado) + trailer `Co-Authored-By`
- **Pull Requests:** descripción del cambio + checklist de DoD + screenshots si aplica
- **Daily Standup:** comunicación asíncrona por Discord, 3 preguntas clásicas
- **Respuestas API:** éxito = recurso/lista; error = `{"error":{"code","message"}}`
- **Fechas:** siempre en UTC. El repartidor se identifica por JWT, nunca por parámetro URL.

---

## 8. Burndown Chart

| Fecha             | SP Restantes (Ideal) | SP Restantes (Real) | Observaciones                                                                 |
| ----------------- | :------------------: | :-----------------: | ----------------------------------------------------------------------------- |
| 10/09 (inicio)    |          26          |         26          | Inicio del Sprint · Backlog presentado.                                       |
| 14/09 (semana 1)  |          18          |         21          | Cierre completo de HU-06 (5 SP quemados: API, Web y Mobile).                   |
| 17/09 (semana 2)  |          13          |         16          | Cierre completo de HU-07 (5 SP quemados: incidencias con motivos y fotos).     |
| 21/09 (semana 3)  |           7          |          8          | Cierre completo de HU-09 (5 SP) y HU-10 (3 SP: tracking público).             |
| 24/09 (cierre)    |           0          |          0          | Cierre completo de HU-08 (8 SP: confirmación con firma PNG y foto JPEG).      |

**Criterio de quemado:** los SP de una HU se queman al cerrarla completa (API + web + móvil según corresponda), no por capas sueltas.

---

## 9. Retrospectiva del Sprint 2

### Sprint Backlog Teórico vs. Real

| ID      | Tarea                                                        | Estimado (hs) | Real (hs)     | Observaciones |
| ------- | ------------------------------------------------------------ | :-----------: | :-----------: | ------------- |
| HU-06   | Actualización de estado de entrega (T-06.01 a T-06.10)       |      20       | A consolidar  | Matriz pura y guards por JWT aceleraron el backend; móvil integrado con hook unificado. |
| HU-07   | Registro de entrega fallida con motivo (T-07.01 a T-07.08)   |      22       | A consolidar  | Motivos estandarizados; subida de foto JPEG optimizada y validada. |
| HU-08   | Confirmación con firma y foto (T-08.01 a T-08.09)           |      28       | A consolidar  | Signature pad con exportación a PNG y validación estricta de magic bytes. |
| HU-09   | Reprogramación de entregas fallidas (T-09.01 a T-09.09)      |      18       | A consolidar  | Validación temporal con reloj UTC >= hoy y desvinculación automática de ruta. |
| HU-10   | Tracking público por código de guía (T-10.01 a T-10.07)      |      14       | A consolidar  | Doble barrera de privacidad sin leak de datos personales en DTOs públicos. |
| Transv. | Tareas transversales (T-00.01 a T-00.07)                    |      16       | A consolidar  | Docker local, paridad Postgres/Supabase, OpenAPI y suites de test en serie. |
| **Tot** | **Total Sprint 2**                                           |    **118**    | A consolidar  | **Alcance funcional 100% implementado.** |

### Preguntas de retrospectiva

- **¿Qué salió bien?**
  - La definición contractual rigurosa en OpenAPI y las migraciones de DB previas a la implementación permitieron que Backend, Web y Mobile se desarrollaran de forma coordinada sin desajustes de tipos.
  - La arquitectura limpia en Go con transacciones atómicas garantizó trazabilidad total de eventos de auditoría (`eventos_envio`).
  - La suite de pruebas automatizadas alcanzó 293 tests en verde (178 en Go, 64 en Web, 51 en Mobile) sin dependencias rotas.
  - Se eliminó el riesgo de bloqueo de CI desacoplando pruebas efímeras de la dependencia externa de red.

- **¿Qué podemos mejorar?**
  - La sincronización temprana de ramas y credenciales de repositorios remotos: el error 403 requirió centralizar pushes en una rama principal unificada.
  - El manejo de strings con caracteres especiales en scripts PowerShell (`$$` y comillas en variables de entorno de BD) generó desajustes menores en la conexión local que se mitigaron codificando URL.

- **¿Qué acciones concretas tomamos para el próximo sprint?**
  1. Mantener la suite de tests corriendo en serie (`-p 1`) y verificar 100% verde antes de cada merge a `main`.
  2. Implementar un mock server o entorno de seeds controlado para el desarrollo de dashboards analíticos (HU-11 a HU-15).
  3. Establecer tipado compartido o sincronización automatizada de esquemas DTO entre Go y TypeScript para las nuevas entidades de reportes y geolocalización.

- **Seguimiento:** ¿qué pasó con las 6 acciones tomadas en el Sprint 1 (DoD 9–14)?
  - **Acción 1 (`go test ./... -p 1`):** Cumplida rigurosamente; 178 tests de backend pasan 100% en serie contra la base compartida.
  - **Acción 2 (Línea de integración en estimación):** Cumplida; se presupuestaron y ejecutaron 16 horas de tareas transversales.
  - **Acción 3 (Documentación HU por HU):** Cumplida; el informe y backlog reflejan el estado de cada historia.
  - **Acción 4 (Repaso de CAs en cada interfaz):** Cumplida; validado en Web y en App Mobile.
  - **Acción 5 (Test de lista vacía en endpoints):** Cumplida; implementado en historial, tracking y rutas.
  - **Acción 6 (Suites completas en verde):** Cumplida; 293 tests activos verificados en verde antes del cierre.

---

*Documento del Sprint Backlog 2 — Proyecto Movii — UTN FRSF — Ingeniería y Calidad del Software — 2026.*
