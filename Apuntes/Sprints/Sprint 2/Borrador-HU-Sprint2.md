# Borrador — Historias de Usuario Sprint 2 (Movii)

> **BORRADOR para validación de Ulises — no es entregable.**
> Al validar se vuelca al documento *Sprint Backlog 2* con horas estimado/real.
> Formato: el mismo de las fichas del Sprint Backlog 1.
> Deadline autoimpuesto del sprint: **24/09/2026**.

## Ajuste previo por corrección del profe (presentación Sprint 1)

El profe corrigió: **el envío se asigna a una ruta, no a un repartidor**
(el repartidor llega vía `rutas.repartidor_id`). Verificación: el código ya
lo hace bien (`envios.ruta_id`, `POST /rutas/{id}/envios`). Lo que hay que
alinear es el wording, de acá en más y en la sección "Modificaciones al
Product Backlog" del Sprint 2:

- HU-04 pasa a titularse **"Asignación de envíos a ruta"** (antes "...a ruta
  y repartidor"). Sin cambio de alcance ni de SP.
- HU-02 (PARA) y HU-03 (PARA): "...asignado a una ruta" en vez de
  "...a una ruta y repartidor / a repartidores".
- En la web, la pantalla de asignación habla de "asignar a ruta" (el
  repartidor se muestra como dato de la ruta, no como destino).

## Matriz de transiciones de estado (vale para HU-06/07/08/09)

```
pendiente --(HU-04 asignar)--> asignado --(HU-06)--> en_camino --(HU-08)--> entregado (terminal)
                                   |                      |
                                   +------(HU-07)--------> no_entregado --(HU-09)--> pendiente
en_camino --(HU-06 volver)--> asignado
```

Reglas: a `entregado` solo se llega por HU-08 (con evidencia); a
`no_entregado` solo por HU-07 (con motivo); de `no_entregado` solo se sale
por HU-09 (reprogramación). `entregado` es terminal. Cada transición válida
registra un evento en el historial del envío (fecha UTC, actor, anterior →
nuevo, motivo si aplica). La tabla de eventos se crea en la migración del
sprint (la lee HU-10).

---

**HU-06**

|              |                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Título       | Actualización de estado de entrega                                                                                      |
|              | **Descripción**                                                                                                         |
| YO COMO      | Repartidor                                                                                                               |
| DESEO        | Actualizar el estado de cada entrega a medida que avanzo en mi ruta (en camino, volver a asignado)                      |
| PARA         | Que el sistema refleje el avance real del reparto y el operador tenga visibilidad                                        |
|              | **Criterios de Aceptación**                                                                                             |
| CA-01        | El repartidor puede pasar un envío propio de `asignado` a `en_camino` y de `en_camino` a `asignado`. Ambas transiciones quedan registradas. |
| CA-02        | El cambio directo a `entregado` o a `no_entregado` por este flujo se rechaza con error claro que indica usar la confirmación (HU-08) o la incidencia (HU-07). No se modifica nada. |
| CA-03        | El repartidor solo puede cambiar envíos de sus rutas (cualquiera de ellas, identificado por JWT). Un envío ajeno o inexistente responde 404 genérico, igual que HU-05. |
| CA-04        | Operador y supervisor pueden cambiar el estado de cualquier envío no final, con las mismas transiciones válidas (correcciones y gestión telefónica). |
| CA-05        | Cada cambio válido agrega un evento al historial del envío (fecha UTC, actor, estado anterior y nuevo).                  |
| CA-06        | En la app móvil, la tarjeta del envío ofrece la acción que corresponde a su estado (ej. "Iniciar" si está asignado). *(Felipe)* |
| CA-07        | En la web, el operador/supervisor cambia el estado desde el detalle del envío y ve su historial. *(Ulises)*              |
|              | **Propiedades**                                                                                                         |
| Prioridad    | Alta                                                                                                                     |
| Estado       | Pendiente                                                                                                                |
| Estimación   | 5 Story Points                                                                                                           |
| Valor de negocio | 8                                                                                                                     |
| Responsable  | Araya, Ulises (API + web) / Díaz Aimar, Felipe (móvil)                                                                  |

---

**HU-07**

|              |                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Título       | Registro de entrega fallida con motivo                                                                                  |
|              | **Descripción**                                                                                                         |
| YO COMO      | Repartidor                                                                                                               |
| DESEO        | Registrar una entrega fallida indicando el motivo y un comentario                                                        |
| PARA         | Que la incidencia quede trazada y el envío pueda reprogramarse después                                                  |
|              | **Criterios de Aceptación**                                                                                             |
| CA-01        | El motivo es obligatorio y de lista cerrada: cliente ausente, dirección incorrecta, rechazado por destinatario, zona insegura, otro. |
| CA-02        | El comentario es libre; obligatorio solo si el motivo es "otro".                                                         |
| CA-03        | La foto es opcional y reutiliza el mecanismo de evidencia de HU-08. *(A validar: ¿la dejamos opcional por alcance?)*      |
| CA-04        | Al registrar, el envío pasa a `no_entregado` y se agrega el evento con motivo y comentario.                              |
| CA-05        | Solo sobre envíos `asignados` o `en_camino` del repartidor (propios, de cualquiera de sus rutas) o cualquier envío no final (operador/supervisor). |
| CA-06        | Solo repartidor (propios) y operador/supervisor. Cualquier otro caso → 403/404 según corresponda.                        |
| CA-07        | En la app móvil, pantalla de incidencia sobre la maqueta existente. *(Felipe)*                                           |
| CA-08        | En la web, el operador/supervisor registra la incidencia desde el detalle del envío. *(Ulises)*                          |
|              | **Propiedades**                                                                                                         |
| Prioridad    | Alta                                                                                                                     |
| Estado       | Pendiente                                                                                                                |
| Estimación   | 5 Story Points                                                                                                           |
| Valor de negocio | 5                                                                                                                     |
| Responsable  | Araya, Ulises (API + web) / Díaz Aimar, Felipe (móvil)                                                                  |

---

**HU-08**

|              |                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Título       | Confirmación de entrega con firma y foto                                                                                |
|              | **Descripción**                                                                                                         |
| YO COMO      | Repartidor                                                                                                               |
| DESEO        | Confirmar la entrega registrando quién recibió, su firma digital y una foto del paquete                                  |
| PARA         | Que quede evidencia auditable de cada entrega y se cierren reclamos                                                     |
|              | **Criterios de Aceptación**                                                                                             |
| CA-01        | Se registra nombre del receptor y relación obligatorios (destinatario, familiar, vecino, encargado).                     |
| CA-02        | La firma digital es obligatoria.                                                                                         |
| CA-03        | La foto del paquete es obligatoria. *(A validar: es lo que dice el alcance; si aprieta el tiempo, candidata a recorte — ver notas)* |
| CA-04        | Al confirmar, el envío pasa a `entregado` y se guarda la evidencia (receptor, firma, foto, fecha) asociada al envío más el evento. |
| CA-05        | Se puede confirmar desde `en_camino` o desde `asignado`; si estaba `asignado`, el historial registra el paso por `en_camino`. *(A validar)* |
| CA-06        | Solo repartidor (envíos propios, de cualquiera de sus rutas) y operador/supervisor (correcciones).                                           |
| CA-07        | En la app móvil, pantalla de confirmación sobre la maqueta existente (usa el `signature-pad` del prototipo). *(Felipe)*  |
| CA-08        | En la web, la evidencia (receptor, firma, foto) queda visible en el detalle del envío. *(Ulises)*                        |
|              | **Propiedades**                                                                                                         |
| Prioridad    | Alta                                                                                                                     |
| Estado       | Pendiente                                                                                                                |
| Estimación   | 8 Story Points                                                                                                           |
| Valor de negocio | 5                                                                                                                     |
| Responsable  | Araya, Ulises (API + web) / Díaz Aimar, Felipe (móvil)                                                                  |

---

**HU-09**

|              |                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Título       | Reprogramación de entregas fallidas                                                                                     |
|              | **Descripción**                                                                                                         |
| YO COMO      | Operador logístico                                                                                                       |
| DESEO        | Reprogramar un envío fallido eligiendo nueva fecha y franja horaria                                                      |
| PARA         | Que el envío vuelva al circuito de reparto en lugar de quedar olvidado                                                   |
|              | **Criterios de Aceptación**                                                                                             |
| CA-01        | Solo se puede reprogramar un envío en estado `no_entregado`. Otro estado → error claro sin cambios.                      |
| CA-02        | La nueva fecha es obligatoria y no puede ser pasada (≥ hoy).                                                             |
| CA-03        | La franja horaria es obligatoria (mañana / tarde / noche). *(A validar: ¿la incluimos? Está en el prototipo.)*            |
| CA-04        | Al reprogramar, el envío vuelve a `pendiente` para su nueva fecha y se registra el evento (fecha anterior → nueva, motivo original visible). |
| CA-05        | El envío reprogramado aparece como pendiente en los listados de su nueva fecha.                                          |
| CA-06        | **Notificación al cliente (email/WhatsApp): fuera de alcance.** Se deja registrado como decisión (el alcance base lo excluye). |
| CA-07        | Operador/supervisor en la web y repartidor en la app móvil, mismo endpoint. *(Ulises web+API, Felipe móvil)*             |
|              | **Propiedades**                                                                                                         |
| Prioridad    | Media                                                                                                                    |
| Estado       | Pendiente                                                                                                                |
| Estimación   | 5 Story Points                                                                                                           |
| Valor de negocio | 5                                                                                                                     |
| Responsable  | Araya, Ulises (API + web) / Díaz Aimar, Felipe (móvil)                                                                  |

---

**HU-10**

|              |                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Título       | Tracking público por código de guía                                                                                    |
|              | **Descripción**                                                                                                         |
| YO COMO      | Cliente final                                                                                                            |
| DESEO        | Consultar el estado de mi envío con el código de guía, sin iniciar sesión                                               |
| PARA         | Saber dónde está mi paquete sin llamar a la empresa                                                                     |
|              | **Criterios de Aceptación**                                                                                             |
| CA-01        | Consulta pública sin login por código de guía exacto (`GET /tracking/{codigo}`).                                         |
| CA-02        | Muestra: código de guía, estado actual, localidad de entrega e historial de eventos (fecha + evento/motivo).             |
| CA-03        | **Nunca** expone: teléfonos, emails, dirección exacta (calle/número), nombre del repartidor ni datos internos. *(A validar el recorte exacto)* |
| CA-04        | Código inexistente → 404 genérico, sin revelar información.                                                              |
| CA-05        | En la web, página pública `/tracking` con buscador y línea de tiempo con los colores semánticos del sistema. *(Ulises)*  |
| CA-06        | Los estados se muestran con el mismo lenguaje visual de la app (verde/azul/amarillo/rojo). *(Ulises)*                    |
|              | **Propiedades**                                                                                                         |
| Prioridad    | Media                                                                                                                    |
| Estado       | Pendiente                                                                                                                |
| Estimación   | 3 Story Points                                                                                                           |
| Valor de negocio | 5                                                                                                                     |
| Responsable  | Araya, Ulises (API + web)                                                                                                |

---

## Notas de alcance para el Sprint 2 (14 días, 10/09 → 24/09)

- Orden por dependencias: HU-06 (transiciones + tabla de eventos) → HU-07 → HU-09 → HU-08 → HU-10 (lee los eventos).
- Alcance Sprint 2: COMPLETO, sin recortes (decisión 10/09). Las 5 HU se implementan.
- Diseño API cerrado 10/09: migraciones 0003 (eventos) + 0004 (evidencias/reprogramación), `openapi.yaml` con los 7 endpoints nuevos + detalle extendido, plan de implementación HU-06/07 listo.
- El móvil (Felipe) consume los endpoints de HU-06/07/08/09: el contrato (endpoints + DTOs en `openapi.yaml`) debe cerrarse antes de que él arranque.
- Puntos marcados *(A validar)* son decisiones de Ulises (algunas con Felipe si tocan el móvil).
