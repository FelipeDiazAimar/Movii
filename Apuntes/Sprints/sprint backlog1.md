
# Sprint Backlog 1

## Sistema de Gestión de Envíos y Distribución — Movii

**Cátedra:** Ingeniería y Calidad del Software

**Integrantes del Grupo Nro 7:**

- Araya, Ulises
- Díaz Aimar, Felipe
- Micheloud, Jeremías

**Docentes:**

- Gandino, Diego
- Saldarini, Javier Daniel

**Duración del Sprint:** 30 días (12/08/2026 – 02/09/2026)

**Fecha de presentación del Backlog:** Miércoles 19/08/2026

**Fecha de presentación del Sprint:** Miércoles 02/09/2026

---

## 1. Objetivo del Sprint

Implementar las funcionalidades prioritarias del sistema que conforman el **MVP (Producto Mínimo Viable)**: permitir el registro de envíos, la gestión de usuarios y autenticación, la asignación de envíos a repartidores y rutas, y la consulta del listado de envíos del día por parte del repartidor. Al final del sprint, un operador logístico podrá registrar un envío en el sistema, asignarlo a un repartidor con una ruta, y el repartidor podrá visualizar sus envíos asignados para el día.

---

## 2. Product Backlog priorizado

| ID    | Historia de Usuario                         | Prioridad | Sprint      |
| ----- | ------------------------------------------- | --------- | ----------- |
| HU-01 | Registro y autenticación de usuarios       | Muy Alta  | ✅ Sprint 1 |
| HU-02 | Registro de envíos                         | Muy Alta  | ✅ Sprint 1 |
| HU-03 | Gestión de rutas diarias                   | Alta      | ✅ Sprint 1 |
| HU-04 | Asignación de envíos a ruta y repartidor  | Alta      | ✅ Sprint 1 |
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

---

## 3. Historias de Usuario seleccionadas para el Sprint 1

A continuación se presentan las fichas de cada Historia de Usuario seleccionada, con el formato estándar del equipo.

---

**HU-01**

|                  |                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Título          | Registro y autenticación de usuarios                                                                                                                                                                   |
|                  | **Descripción**                                                                                                                                                                                  |
| YO COMO          | Administrador del sistema                                                                                                                                                                               |
| DESEO            | Poder registrar usuarios con sus roles (operador logístico, repartidor, supervisor) y que cada usuario pueda iniciar sesión de forma segura                                                           |
| PARA             | Que cada perfil acceda únicamente a las funcionalidades que le corresponden                                                                                                                            |
|                  | **Criterios de Aceptación**                                                                                                                                                                      |
| CA-01            | El sistema permite crear un usuario con: nombre completo, email, contraseña y rol asignado (operador, repartidor, supervisor). El usuario se persiste en la base de datos con la contraseña hasheada. |
| CA-02            | El sistema valida que el email sea único y tenga formato válido. Se muestra un mensaje de error si el email ya existe o es inválido.                                                                 |
| CA-03            | Un usuario registrado puede iniciar sesión con email y contraseña. El sistema retorna un token JWT válido con la información del usuario y su rol.                                                  |
| CA-04            | Un usuario con credenciales incorrectas recibe un mensaje de error. El sistema responde con error 401 sin revelar si el email existe o no.                                                              |
| CA-05            | Cada endpoint protegido valida el token JWT y el rol del usuario. Solicitudes sin token o con rol incorrecto reciben error 401/403.                                                                     |
| CA-06            | El sistema permite listar los usuarios registrados (solo para supervisor/admin). Se retorna la lista con nombre, email, rol y estado activo.                                                            |
|                  | **Propiedades**                                                                                                                                                                                   |
| Prioridad        | Muy Alta                                                                                                                                                                                                |
| Estado           | Pendiente                                                                                                                                                                                               |
| Estimación      | 8 Story Points                                                                                                                                                                                          |
| Valor de negocio | 8                                                                                                                                                                                                       |
| Responsable      | Micheloud, Jeremías                                                                                                                                                                                    |

---

**HU-02**

|                  |                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Título          | Registro de envíos                                                                                                                                                                                                                                                                                                                                                                          |
|                  | **Descripción**                                                                                                                                                                                                                                                                                                                                                                       |
| YO COMO          | Operador logístico                                                                                                                                                                                                                                                                                                                                                                          |
| DESEO            | Registrar un nuevo envío ingresando los datos del remitente, destinatario, dirección de entrega y características del paquete                                                                                                                                                                                                                                                             |
| PARA             | Que el envío quede registrado en el sistema y pueda ser asignado a una ruta y repartidor                                                                                                                                                                                                                                                                                                    |
|                  | **Criterios de Aceptación**                                                                                                                                                                                                                                                                                                                                                           |
| CA-01            | El formulario de registro solicita: datos del remitente (nombre, teléfono, dirección), datos del destinatario (nombre, teléfono, dirección de entrega, localidad, código postal), y características del paquete (peso en kg, tamaño: chico/mediano/grande, tipo de contenido, indicadores de fragilidad y urgencia). Todos los campos se renderizan correctamente en la interfaz web. |
| CA-02            | El sistema genera automáticamente un código de guía único para cada envío registrado (formato: MOV-YYYYMMDD-XXXX). El código se genera y se muestra al operador al completar el registro.                                                                                                                                                                                              |
| CA-03            | El envío se crea con estado inicial "pendiente". El envío se persiste en la base de datos con estado pendiente y fecha de creación.                                                                                                                                                                                                                                                       |
| CA-04            | El sistema valida que los campos obligatorios estén completos (nombre destinatario, dirección, localidad, peso). Se muestran mensajes de error específicos para cada campo faltante.                                                                                                                                                                                                      |
| CA-05            | El operador puede ver una lista de todos los envíos registrados con filtro por estado y fecha. La lista muestra código de guía, destinatario, dirección, estado y fecha de creación.                                                                                                                                                                                                    |
| CA-06            | Solo usuarios con rol operador o supervisor pueden registrar envíos. Un usuario con rol repartidor recibe error 403 al intentar registrar un envío.                                                                                                                                                                                                                                        |
|                  | **Propiedades**                                                                                                                                                                                                                                                                                                                                                                        |
| Prioridad        | Muy Alta                                                                                                                                                                                                                                                                                                                                                                                     |
| Estado           | Pendiente                                                                                                                                                                                                                                                                                                                                                                                    |
| Estimación      | 5 Story Points                                                                                                                                                                                                                                                                                                                                                                               |
| Valor de negocio | 8                                                                                                                                                                                                                                                                                                                                                                                            |
| Responsable      | Díaz Aimar, Felipe                                                                                                                                                                                                                                                                                                                                                                          |

---

**HU-03**

|                  |                                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Título          | Gestión de rutas diarias                                                                                                                                                                           |
|                  | **Descripción**                                                                                                                                                                              |
| YO COMO          | Operador logístico                                                                                                                                                                                 |
| DESEO            | Crear y gestionar rutas de reparto diarias organizadas por zona geográfica                                                                                                                         |
| PARA             | Que los envíos puedan agruparse de forma eficiente y asignarse a repartidores                                                                                                                      |
|                  | **Criterios de Aceptación**                                                                                                                                                                  |
| CA-01            | El operador puede crear una ruta especificando: nombre de la ruta, zona/área geográfica, fecha de reparto y repartidor asignado. La ruta se persiste en la base de datos con los datos completos. |
| CA-02            | El sistema permite listar las rutas del día con su estado (planificada, en curso, completada). La vista muestra nombre de ruta, zona, repartidor asignado, cantidad de envíos y estado.           |
| CA-03            | El operador puede editar una ruta que esté en estado planificada. Los cambios se persisten correctamente y no se permiten ediciones sobre rutas en curso o completadas.                            |
| CA-04            | El operador puede ver el detalle de una ruta con la lista de envíos asociados. Se muestra la información de la ruta y el listado de envíos con su estado individual.                             |
| CA-05            | Una ruta no puede crearse sin repartidor asignado ni sin fecha. Se muestra un mensaje de error si faltan estos campos obligatorios.                                                                 |
|                  | **Propiedades**                                                                                                                                                                               |
| Prioridad        | Alta                                                                                                                                                                                                |
| Estado           | Pendiente                                                                                                                                                                                           |
| Estimación      | 5 Story Points                                                                                                                                                                                      |
| Valor de negocio | 5                                                                                                                                                                                                   |
| Responsable      | Araya, Ulises                                                                                                                                                                                       |

---

**HU-04**

|                  |                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Título          | Asignación de envíos a ruta y repartidor                                                                                                                                  |
|                  | **Descripción**                                                                                                                                                      |
| YO COMO          | Operador logístico                                                                                                                                                         |
| DESEO            | Asignar uno o varios envíos pendientes a una ruta de reparto existente                                                                                                     |
| PARA             | Que cada envío quede vinculado a un repartidor y a un recorrido del día                                                                                                   |
|                  | **Criterios de Aceptación**                                                                                                                                          |
| CA-01            | El operador puede seleccionar envíos con estado pendiente y asignarlos a una ruta existente. Los envíos quedan vinculados a la ruta seleccionada en la base de datos.     |
| CA-02            | Al asignar un envío a una ruta, su estado cambia automáticamente de pendiente a asignado. El estado se actualiza en la base de datos y se refleja en la lista de envíos. |
| CA-03            | El sistema muestra la lista de envíos pendientes (sin ruta asignada) para facilitar la selección. Solo se muestran envíos con estado pendiente que no tengan ruta.       |
| CA-04            | El operador puede desasignar un envío de una ruta, siempre que la ruta esté en estado planificada. El envío vuelve a estado pendiente y se desvincula de la ruta.        |
| CA-05            | No se permite asignar un envío a una ruta cuya fecha de reparto ya pasó. El sistema valida la fecha y muestra un error descriptivo.                                       |
| CA-06            | El sistema muestra la cantidad total de envíos asignados a cada ruta y el peso total acumulado. La información se visualiza en la vista de detalle de la ruta.            |
|                  | **Propiedades**                                                                                                                                                       |
| Prioridad        | Alta                                                                                                                                                                        |
| Estado           | Pendiente                                                                                                                                                                   |
| Estimación      | 5 Story Points                                                                                                                                                              |
| Valor de negocio | 5                                                                                                                                                                           |
| Responsable      | Díaz Aimar, Felipe                                                                                                                                                         |

---

**HU-05**

|                  |                                                                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Título          | Listado de envíos del día para repartidor                                                                                                                                                     |
|                  | **Descripción**                                                                                                                                                                          |
| YO COMO          | Repartidor                                                                                                                                                                                      |
| DESEO            | Ver el listado de envíos que tengo asignados para el día actual con la información relevante de cada uno                                                                                     |
| PARA             | Poder planificar mi recorrido y realizar las entregas                                                                                                                                           |
|                  | **Criterios de Aceptación**                                                                                                                                                              |
| CA-01            | El repartidor ve únicamente los envíos asignados a sus rutas del día. Solo se muestran envíos vinculados a rutas con la fecha de hoy y el repartidor logueado.                              |
| CA-02            | Cada envío muestra: nombre del destinatario, dirección de entrega, código de guía, peso del paquete y estado actual. Todos los datos se renderizan correctamente en cada tarjeta de envío. |
| CA-03            | Los envíos se agrupan por ruta si el repartidor tiene más de una ruta asignada en el día. Se visualiza un separador o encabezado por cada ruta.                                              |
| CA-04            | El repartidor puede filtrar los envíos por estado (asignado, en camino, entregado, no entregado). El filtro funciona correctamente y la lista se actualiza en tiempo real.                     |
| CA-05            | La vista muestra un resumen del día: total de envíos, entregados, pendientes y no entregados. Los contadores se actualizan conforme se modifican los estados.                                 |
| CA-06            | La vista está optimizada para dispositivos móviles. La interfaz se adapta correctamente a pantallas de 390×844 px (mobile-first).                                                            |
|                  | **Propiedades**                                                                                                                                                                           |
| Prioridad        | Alta                                                                                                                                                                                            |
| Estado           | Pendiente                                                                                                                                                                                       |
| Estimación      | 3 Story Points                                                                                                                                                                                  |
| Valor de negocio | 5                                                                                                                                                                                               |
| Responsable      | Araya, Ulises                                                                                                                                                                                   |

---

## 4. Estimaciones de Valor y Esfuerzo

### 4.1 Escala de Valor de Negocio

| Valor | Descripción                                                   |
| ----- | -------------------------------------------------------------- |
| 1     | Bajo — Funcionalidad de soporte o complementaria              |
| 2     | Medio-Bajo — Útil pero no esencial para la operación diaria |
| 3     | Medio — Aporta valor operativo claro                          |
| 5     | Alto — Habilita funcionalidades centrales del sistema         |
| 8     | Muy Alto — Sin esta funcionalidad el sistema no puede operar  |

### 4.2 Escala de Esfuerzo (Story Points — Fibonacci)

| Puntos | Descripción                                                                    |
| ------ | ------------------------------------------------------------------------------- |
| 1      | Trivial — Cambio puntual, sin complejidad                                      |
| 2      | Pequeño — Implementación directa, sin incertidumbre                          |
| 3      | Moderado — Requiere diseño y varias tareas coordinadas                        |
| 5      | Significativo — Funcionalidad completa con múltiples componentes              |
| 8      | Complejo — Requiere investigación, integración de capas y pruebas extensivas |
| 13     | Muy Complejo — Alta incertidumbre, múltiples integraciones                    |

### 4.3 Resumen de estimaciones

| ID    | Historia de Usuario                         | Valor de Negocio |  Esfuerzo (SP)  | Prioridad (V/E) | Responsable          |
| ----- | ------------------------------------------- | :--------------: | :-------------: | :-------------: | -------------------- |
| HU-01 | Registro y autenticación de usuarios       |        8        |        8        |      1.00      | Micheloud, Jeremías |
| HU-02 | Registro de envíos                         |        8        |        5        |      1.60      | Díaz Aimar, Felipe  |
| HU-03 | Gestión de rutas diarias                   |        5        |        5        |      1.00      | Araya, Ulises        |
| HU-04 | Asignación de envíos a ruta y repartidor  |        5        |        5        |      1.00      | Díaz Aimar, Felipe  |
| HU-05 | Listado de envíos del día para repartidor |        5        |        3        |      1.67      | Araya, Ulises        |
|       | **Total Sprint 1**                    |   **31**   | **26 SP** |                |                      |

**Velocidad estimada del equipo:** 26 Story Points por sprint (30 días).

**Capacidad del equipo:** 3 integrantes × 30 días × ~2 hs/día = ~180 horas disponibles.

---

## 5. Sprint Backlog — Desglose de tareas

### HU-01 — Registro y autenticación de usuarios

| #       | Fase       | Tarea                                                                              | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ---------------------------------------------------------------------------------- | :-----------: | :-------: | :----: |
| T-01.01 | Análisis  | Definir flujo de autenticación (registro, login, validación de rol)              |       2       |          |   ⬜   |
| T-01.02 | Análisis  | Especificar endpoints de la API: POST /auth/register, POST /auth/login, GET /users |       2       |          |   ⬜   |
| T-01.03 | Análisis  | Definir política de contraseñas y reglas de validación de datos                 |       1       |          |   ⬜   |
| T-01.04 | Diseño    | Diseñar modelo de datos de la tabla usuarios                                      |       2       |          |   ⬜   |
| T-01.05 | Diseño    | Diseñar interfaz de pantalla de login (web y móvil)                              |       3       |          |   ⬜   |
| T-01.06 | Diseño    | Diseñar interfaz de pantalla de registro de usuarios (panel admin)                |       2       |          |   ⬜   |
| T-01.07 | Desarrollo | Crear migración de base de datos para tabla usuarios                              |       2       |          |   ⬜   |
| T-01.08 | Desarrollo | Implementar endpoint POST /auth/register (backend Go)                              |       4       |          |   ⬜   |
| T-01.09 | Desarrollo | Implementar endpoint POST /auth/login con generación de JWT                       |       4       |          |   ⬜   |
| T-01.10 | Desarrollo | Implementar middleware de autenticación y autorización por rol                   |       4       |          |   ⬜   |
| T-01.11 | Desarrollo | Implementar endpoint GET /users (listado de usuarios)                              |       2       |          |   ⬜   |
| T-01.12 | Desarrollo | Implementar pantalla de login en frontend web                                      |       4       |          |   ⬜   |
| T-01.13 | Desarrollo | Implementar gestión de sesión y almacenamiento de token                          |       2       |          |   ⬜   |
| T-01.14 | Desarrollo | Implementar pantalla de registro de usuarios (panel admin)                         |       3       |          |   ⬜   |
| T-01.15 | Prueba     | Escribir pruebas unitarias para registro y login (backend)                         |       3       |          |   ⬜   |
| T-01.16 | Prueba     | Escribir pruebas de integración para endpoints de autenticación                  |       3       |          |   ⬜   |
| T-01.17 | Prueba     | Prueba exploratoria del flujo completo de registro → login → acceso              |       2       |          |   ⬜   |
|         |            | **Subtotal HU-01**                                                           | **43** |          |        |

### HU-02 — Registro de envíos

| #       | Fase       | Tarea                                                                    | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ------------------------------------------------------------------------ | :-----------: | :-------: | :----: |
| T-02.01 | Análisis  | Definir campos del formulario de registro y reglas de validación        |       2       |          |   ⬜   |
| T-02.02 | Análisis  | Especificar endpoints: POST /envios, GET /envios, GET /envios/:id        |       2       |          |   ⬜   |
| T-02.03 | Análisis  | Definir formato y lógica de generación del código de guía            |       1       |          |   ⬜   |
| T-02.04 | Diseño    | Diseñar modelo de datos de las tablas envios, remitentes, destinatarios |       3       |          |   ⬜   |
| T-02.05 | Diseño    | Diseñar interfaz del formulario de registro de envío                   |       3       |          |   ⬜   |
| T-02.06 | Diseño    | Diseñar interfaz de la lista de envíos con filtros                     |       2       |          |   ⬜   |
| T-02.07 | Desarrollo | Crear migraciones de base de datos para tablas de envíos                |       2       |          |   ⬜   |
| T-02.08 | Desarrollo | Implementar endpoint POST /envios con generación de código de guía    |       4       |          |   ⬜   |
| T-02.09 | Desarrollo | Implementar endpoint GET /envios con filtros por estado y fecha          |       3       |          |   ⬜   |
| T-02.10 | Desarrollo | Implementar endpoint GET /envios/:id (detalle del envío)                |       2       |          |   ⬜   |
| T-02.11 | Desarrollo | Implementar formulario de registro de envío en frontend web             |       5       |          |   ⬜   |
| T-02.12 | Desarrollo | Implementar vista de lista de envíos con filtros en frontend web        |       4       |          |   ⬜   |
| T-02.13 | Prueba     | Escribir pruebas unitarias para la lógica de registro de envíos        |       3       |          |   ⬜   |
| T-02.14 | Prueba     | Escribir pruebas de integración para endpoints de envíos               |       2       |          |   ⬜   |
| T-02.15 | Prueba     | Prueba exploratoria del flujo de registro y listado de envíos           |       2       |          |   ⬜   |
|         |            | **Subtotal HU-02**                                                 | **38** |          |        |

### HU-03 — Gestión de rutas diarias

| #       | Fase       | Tarea                                                                          | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ------------------------------------------------------------------------------ | :-----------: | :-------: | :----: |
| T-03.01 | Análisis  | Definir campos y estados posibles de una ruta                                  |       1       |          |   ⬜   |
| T-03.02 | Análisis  | Especificar endpoints: POST /rutas, GET /rutas, GET /rutas/:id, PUT /rutas/:id |       2       |          |   ⬜   |
| T-03.03 | Diseño    | Diseñar modelo de datos de la tabla rutas                                     |       2       |          |   ⬜   |
| T-03.04 | Diseño    | Diseñar interfaz de creación de ruta y lista de rutas del día               |       3       |          |   ⬜   |
| T-03.05 | Desarrollo | Crear migración de base de datos para tabla rutas                             |       1       |          |   ⬜   |
| T-03.06 | Desarrollo | Implementar endpoint POST /rutas                                               |       3       |          |   ⬜   |
| T-03.07 | Desarrollo | Implementar endpoint GET /rutas con filtro por fecha                           |       3       |          |   ⬜   |
| T-03.08 | Desarrollo | Implementar endpoint GET /rutas/:id (detalle con envíos)                      |       2       |          |   ⬜   |
| T-03.09 | Desarrollo | Implementar endpoint PUT /rutas/:id (edición)                                 |       2       |          |   ⬜   |
| T-03.10 | Desarrollo | Implementar pantalla de gestión de rutas en frontend web                      |       5       |          |   ⬜   |
| T-03.11 | Prueba     | Escribir pruebas unitarias para lógica de rutas                               |       2       |          |   ⬜   |
| T-03.12 | Prueba     | Escribir pruebas de integración para endpoints de rutas                       |       2       |          |   ⬜   |
| T-03.13 | Prueba     | Prueba exploratoria del flujo de creación y edición de rutas                 |       2       |          |   ⬜   |
|         |            | **Subtotal HU-03**                                                       | **30** |          |        |

### HU-04 — Asignación de envíos a ruta y repartidor

| #       | Fase       | Tarea                                                                            | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | -------------------------------------------------------------------------------- | :-----------: | :-------: | :----: |
| T-04.01 | Análisis  | Definir reglas de negocio de asignación y desasignación                        |       2       |          |   ⬜   |
| T-04.02 | Análisis  | Especificar endpoints: POST /rutas/:id/envios, DELETE /rutas/:id/envios/:envioId |       2       |          |   ⬜   |
| T-04.03 | Diseño    | Diseñar interfaz de pantalla de asignación (envíos pendientes + ruta destino) |       3       |          |   ⬜   |
| T-04.04 | Diseño    | Diseñar flujo de selección múltiple y confirmación de asignación            |       2       |          |   ⬜   |
| T-04.05 | Desarrollo | Implementar endpoint POST /rutas/:id/envios (asignación individual y masiva)    |       4       |          |   ⬜   |
| T-04.06 | Desarrollo | Implementar lógica de cambio de estado automático (pendiente → asignado)      |       2       |          |   ⬜   |
| T-04.07 | Desarrollo | Implementar endpoint DELETE /rutas/:id/envios/:envioId (desasignación)          |       2       |          |   ⬜   |
| T-04.08 | Desarrollo | Implementar validaciones: fecha no vencida, estado de ruta planificada           |       2       |          |   ⬜   |
| T-04.09 | Desarrollo | Implementar pantalla de asignación en frontend web                              |       5       |          |   ⬜   |
| T-04.10 | Desarrollo | Implementar indicador de peso total y cantidad de envíos por ruta               |       2       |          |   ⬜   |
| T-04.11 | Prueba     | Escribir pruebas unitarias para lógica de asignación                           |       3       |          |   ⬜   |
| T-04.12 | Prueba     | Escribir pruebas de integración para endpoints de asignación                   |       2       |          |   ⬜   |
| T-04.13 | Prueba     | Prueba exploratoria del flujo completo de asignación y desasignación           |       2       |          |   ⬜   |
|         |            | **Subtotal HU-04**                                                         | **33** |          |        |

### HU-05 — Listado de envíos del día para repartidor

| #       | Fase       | Tarea                                                                          | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ------------------------------------------------------------------------------ | :-----------: | :-------: | :----: |
| T-05.01 | Análisis  | Definir datos que se muestran por envío y reglas de filtrado                  |       1       |          |   ⬜   |
| T-05.02 | Análisis  | Especificar endpoint: GET /repartidor/envios-del-dia                           |       1       |          |   ⬜   |
| T-05.03 | Diseño    | Diseñar interfaz de la vista principal del repartidor (tarjetas de envío)    |       3       |          |   ⬜   |
| T-05.04 | Diseño    | Diseñar componente de resumen del día (contadores)                           |       2       |          |   ⬜   |
| T-05.05 | Desarrollo | Implementar endpoint GET /repartidor/envios-del-dia con filtro por rol y fecha |       3       |          |   ⬜   |
| T-05.06 | Desarrollo | Implementar agrupación de envíos por ruta en el endpoint                     |       2       |          |   ⬜   |
| T-05.07 | Desarrollo | Implementar vista principal del repartidor en app móvil (React Native)        |       5       |          |   ⬜   |
| T-05.08 | Desarrollo | Implementar componente de resumen del día                                     |       2       |          |   ⬜   |
| T-05.09 | Desarrollo | Implementar filtros por estado en la vista del repartidor                      |       2       |          |   ⬜   |
| T-05.10 | Prueba     | Escribir pruebas unitarias para el endpoint del repartidor                     |       2       |          |   ⬜   |
| T-05.11 | Prueba     | Prueba exploratoria de la vista del repartidor en dispositivo móvil           |       2       |          |   ⬜   |
|         |            | **Subtotal HU-05**                                                       | **25** |          |        |

### Tareas transversales del Sprint

| #       | Fase       | Tarea                                                                          | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ------------------------------------------------------------------------------ | :-----------: | :-------: | :----: |
| T-00.01 | Diseño    | Diseñar y crear modelo de datos completo (todas las tablas del sprint)        |       4       |          |   ⬜   |
| T-00.02 | Desarrollo | Configurar estructura base del proyecto Go (rutas, middleware, conexión a DB) |       4       |          |   ⬜   |
| T-00.03 | Desarrollo | Configurar Supabase: crear proyecto, configurar conexión desde Go             |       3       |          |   ⬜   |
| T-00.04 | Desarrollo | Configurar proyecto React Native con Expo (pantalla base y navegación)        |       3       |          |   ⬜   |
| T-00.05 | Desarrollo | Configurar proyecto web (TypeScript, componentes base, cliente HTTP)           |       3       |          |   ⬜   |
| T-00.06 | Desarrollo | Configurar pipeline CI/CD en GitHub Actions (lint + tests)                     |       2       |          |   ⬜   |
| T-00.07 | Desarrollo | Documentar endpoints del Sprint 1 en Swagger/OpenAPI                           |       3       |          |   ⬜   |
| T-00.08 | Prueba     | Ejecutar prueba de integración end-to-end del flujo completo del sprint       |       3       |          |   ⬜   |
| T-00.09 | Prueba     | Revisión de código cruzada entre integrantes (pull requests)                 |       3       |          |   ⬜   |
|         |            | **Subtotal Transversales**                                               | **28** |          |        |

### Resumen de horas estimadas

| Historia / Grupo                   | Horas Estimadas |
| ---------------------------------- | :-------------: |
| HU-01 — Registro y autenticación |       43       |
| HU-02 — Registro de envíos       |       38       |
| HU-03 — Gestión de rutas diarias |       30       |
| HU-04 — Asignación de envíos    |       33       |
| HU-05 — Listado del repartidor    |       25       |
| Tareas transversales               |       28       |
| **Total Sprint 1**           |  **197**  |

**Capacidad disponible:** 3 integrantes × 30 días × 2 hs/día = **180 horas**

**Nota:** El margen es ajustado. Se priorizarán las HU de mayor valor (HU-01 y HU-02) y se evaluará en el daily si es necesario renegociar alcance.

---

## 6. Modelo de Datos

### Tabla usuarios

| Campo         | Tipo                                         | Restricciones     | Descripción                         |
| ------------- | -------------------------------------------- | ----------------- | ------------------------------------ |
| id            | UUID                                         | PK, auto-generado | Identificador único del usuario     |
| nombre        | VARCHAR(100)                                 | NOT NULL          | Nombre completo del usuario          |
| email         | VARCHAR(150)                                 | NOT NULL, UNIQUE  | Email del usuario (usado como login) |
| password_hash | VARCHAR(255)                                 | NOT NULL          | Contraseña hasheada con bcrypt      |
| rol           | ENUM('operador', 'repartidor', 'supervisor') | NOT NULL          | Rol del usuario en el sistema        |
| activo        | BOOLEAN                                      | DEFAULT true      | Indica si el usuario está activo    |
| created_at    | TIMESTAMP                                    | DEFAULT NOW()     | Fecha de creación del registro      |
| updated_at    | TIMESTAMP                                    | DEFAULT NOW()     | Fecha de última actualización      |

### Tabla envios

| Campo           | Tipo                                                                    | Restricciones                    | Descripción                            |
| --------------- | ----------------------------------------------------------------------- | -------------------------------- | --------------------------------------- |
| id              | UUID                                                                    | PK, auto-generado                | Identificador único del envío         |
| codigo_guia     | VARCHAR(20)                                                             | NOT NULL, UNIQUE                 | Código de guía (MOV-YYYYMMDD-XXXX)    |
| estado          | ENUM('pendiente', 'asignado', 'en_camino', 'entregado', 'no_entregado') | NOT NULL, DEFAULT 'pendiente'    | Estado actual del envío                |
| peso            | DECIMAL(6,2)                                                            | NOT NULL                         | Peso del paquete en kilogramos          |
| tamano          | ENUM('chico', 'mediano', 'grande')                                      | NOT NULL                         | Tamaño del paquete                     |
| tipo_contenido  | VARCHAR(100)                                                            |                                  | Descripción del tipo de contenido      |
| fragil          | BOOLEAN                                                                 | DEFAULT false                    | Indica si el paquete es frágil         |
| urgente         | BOOLEAN                                                                 | DEFAULT false                    | Indica si el envío es urgente          |
| remitente_id    | UUID                                                                    | FK → remitentes.id, NOT NULL    | Referencia al remitente                 |
| destinatario_id | UUID                                                                    | FK → destinatarios.id, NOT NULL | Referencia al destinatario              |
| ruta_id         | UUID                                                                    | FK → rutas.id, NULLABLE         | Ruta asignada (null si no fue asignado) |
| created_at      | TIMESTAMP                                                               | DEFAULT NOW()                    | Fecha de registro del envío            |
| updated_at      | TIMESTAMP                                                               | DEFAULT NOW()                    | Fecha de última actualización         |

### Tabla remitentes

| Campo      | Tipo         | Restricciones     | Descripción             |
| ---------- | ------------ | ----------------- | ------------------------ |
| id         | UUID         | PK, auto-generado | Identificador único     |
| nombre     | VARCHAR(100) | NOT NULL          | Nombre del remitente     |
| telefono   | VARCHAR(20)  |                   | Teléfono de contacto    |
| direccion  | VARCHAR(255) |                   | Dirección del remitente |
| created_at | TIMESTAMP    | DEFAULT NOW()     | Fecha de creación       |

### Tabla destinatarios

| Campo         | Tipo         | Restricciones     | Descripción                      |
| ------------- | ------------ | ----------------- | --------------------------------- |
| id            | UUID         | PK, auto-generado | Identificador único              |
| nombre        | VARCHAR(100) | NOT NULL          | Nombre del destinatario           |
| telefono      | VARCHAR(20)  |                   | Teléfono de contacto             |
| calle         | VARCHAR(200) | NOT NULL          | Calle de la dirección de entrega |
| numero        | VARCHAR(10)  | NOT NULL          | Número de la dirección          |
| piso_depto    | VARCHAR(20)  |                   | Piso y/o departamento (opcional)  |
| localidad     | VARCHAR(100) | NOT NULL          | Localidad de entrega              |
| codigo_postal | VARCHAR(10)  | NOT NULL          | Código postal                    |
| created_at    | TIMESTAMP    | DEFAULT NOW()     | Fecha de creación                |

### Tabla rutas

| Campo         | Tipo                                          | Restricciones                   | Descripción                    |
| ------------- | --------------------------------------------- | ------------------------------- | ------------------------------- |
| id            | UUID                                          | PK, auto-generado               | Identificador único de la ruta |
| nombre        | VARCHAR(100)                                  | NOT NULL                        | Nombre descriptivo de la ruta   |
| zona          | VARCHAR(100)                                  | NOT NULL                        | Zona geográfica de la ruta     |
| fecha         | DATE                                          | NOT NULL                        | Fecha de reparto planificada    |
| estado        | ENUM('planificada', 'en_curso', 'completada') | NOT NULL, DEFAULT 'planificada' | Estado de la ruta               |
| repartidor_id | UUID                                          | FK → usuarios.id, NOT NULL     | Repartidor asignado a la ruta   |
| created_at    | TIMESTAMP                                     | DEFAULT NOW()                   | Fecha de creación              |
| updated_at    | TIMESTAMP                                     | DEFAULT NOW()                   | Fecha de última actualización |

### Relaciones principales

| Relación                                  | Tipo | Descripción                                                                     |
| ------------------------------------------ | ---- | -------------------------------------------------------------------------------- |
| rutas.repartidor_id → usuarios.id         | N:1  | Cada ruta tiene un repartidor asignado. Un repartidor puede tener varias rutas.  |
| envios.ruta_id → rutas.id                 | N:1  | Cada envío puede estar asignado a una ruta. Una ruta tiene muchos envíos.      |
| envios.remitente_id → remitentes.id       | N:1  | Cada envío tiene un remitente. Un remitente puede tener varios envíos.         |
| envios.destinatario_id → destinatarios.id | N:1  | Cada envío tiene un destinatario. Un destinatario puede recibir varios envíos. |

---

## 7. Criterios generales del Sprint

### 7.1 Definition of Done (DoD)

Una tarea o historia se considera terminada cuando cumple todos los criterios siguientes:

1. El código fue revisado mediante pull request por al menos un compañero.
2. El código sigue los lineamientos de estilo definidos (ESLint + Prettier / gofmt).
3. La funcionalidad fue probada manualmente con casos positivos y negativos.
4. Se escribieron pruebas unitarias para la lógica de negocio (cobertura mínima 70%).
5. El código fue integrado en la rama develop sin conflictos y el CI pasa sin errores.
6. La documentación de la API fue actualizada en Swagger si el cambio afecta endpoints.
7. La historia fue demostrada y aprobada por el equipo en la revisión de sprint.
8. No hay bugs de severidad alta o crítica pendientes.

### 7.2 Convenciones del equipo

- **Ramas:** feature/HU-XX-descripcion-breve (ej: feature/HU-02-registro-envios)
- **Commits:** mensajes en español, prefijo con ID de tarea (ej: T-02.08: implementar endpoint POST /envios)
- **Pull Requests:** descripción del cambio + checklist de DoD + screenshots si aplica
- **Daily Standup:** comunicación asíncrona por Discord, 3 preguntas clásicas

---

## 8. Burndown Chart (plantilla)

| Fecha            | SP Restantes (Ideal) | SP Restantes (Real) | Observaciones     |
| ---------------- | :------------------: | :-----------------: | ----------------- |
| 12/08 (inicio)   |          26          |         26         | Inicio del Sprint |
| 18/08 (semana 1) |          20          |                    |                   |
| 25/08 (semana 2) |          13          |                    |                   |
| 01/09 (semana 3) |          7          |                    |                   |
| 02/09 (cierre)   |          0          |                    |                   |

---

## 9. Retrospectiva (plantilla para completar al cierre)

### Sprint Backlog Teórico vs. Real

| ID      | Tarea                           | Estimado (hs) | Real (hs) | Diferencia | Observaciones |
| ------- | ------------------------------- | :-----------: | :-------: | :--------: | ------------- |
| T-01.01 | Definir flujo de autenticación |       2       |          |            |               |
| ...     | ...                             |      ...      |    ...    |    ...    | ...           |

Esta tabla se completará con todas las tareas durante la reunión de retrospectiva, comparando los tiempos estimados con los tiempos reales de trabajo.

### Preguntas de retrospectiva

- **¿Qué salió bien?**
- **¿Qué podemos mejorar?**
- **¿Qué acciones concretas tomamos para el próximo sprint?**

---

*Documento generado para el Sprint 1 del proyecto Movii — Sistema de Gestión de Envíos y Distribución.*

*UTN - Facultad Regional San Francisco — Ingeniería y Calidad del Software — 2026.*
