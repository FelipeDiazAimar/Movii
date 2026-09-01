# Sprint 1 — Trabajo Final Integrador

## Sistema de Gestión de Envíos y Distribución — Movii

---

**UTN — Facultad Regional San Francisco**

**Cátedra:** Ingeniería y Calidad del Software

**Docentes:** Gandino, Diego · Saldarini, Javier Daniel

**Grupo N° 7:** Araya, Ulises · Díaz Aimar, Felipe · Micheloud, Jeremías

**Duración del Sprint:** 30 días (04/08/2026 – 02/09/2026)

**Presentación del Backlog:** Miércoles 19/08/2026 · **Presentación del Sprint:** Miércoles 02/09/2026

---

## 1. Objetivo del Sprint

Implementar las funcionalidades prioritarias del sistema que conforman el **MVP**: registro de envíos, gestión de usuarios y autenticación, asignación de envíos a repartidores y rutas, y consulta del listado de envíos del día por parte del repartidor.

> **Meta:** Al finalizar el sprint, un operador logístico podrá registrar un envío, asignarlo a un repartidor con una ruta, y el repartidor podrá visualizar sus envíos asignados para el día.

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

**Capacidad:** 3 integrantes × 30 días × ~2 hs/día = **180 horas** · **Estimado total de tareas:** 207 horas.

> Margen ajustado. Se priorizan HU-01 y HU-02 y se evalúa en dailys si es necesario renegociar alcance.

---

## 4. Sprint Backlog — Desglose de tareas

### HU-01 — Registro y autenticación de usuarios (Micheloud)

| #       | Fase       | Tarea                                                       | Est. (hs) | Real (hs) |
| ------- | ---------- | ----------------------------------------------------------- | :-------: | :-------: |
| T-01.01 | Análisis  | Definir flujo de autenticación (registro, login, roles)    |     2     |           |
| T-01.02 | Análisis  | Especificar endpoints de la API de autenticación           |     2     |           |
| T-01.03 | Análisis  | Definir política de contraseñas y validaciones            |     1     |           |
| T-01.04 | Diseño    | Diseñar modelo de datos tabla usuarios                     |     2     |           |
| T-01.05 | Diseño    | Diseñar interfaz de login y registro de usuarios           |     5     |           |
| T-01.06 | Desarrollo | Crear migración BD + endpoints register/login/users         |    16     |           |
| T-01.07 | Desarrollo | Implementar middleware de autenticación y autorización     |     4     |           |
| T-01.08 | Desarrollo | Implementar pantallas de login y registro en frontend       |     9     |           |
| T-01.09 | Prueba     | Pruebas unitarias + integración + exploratoria             |     8     |           |
|         |            | **Subtotal HU-01**                                          |  **49**   |           |

### HU-02 — Registro de envíos (Díaz Aimar)

| #       | Fase       | Tarea                                                       | Est. (hs) | Real (hs) |
| ------- | ---------- | ----------------------------------------------------------- | :-------: | :-------: |
| T-02.01 | Análisis  | Definir campos, validaciones y formato código de guía      |     5     |           |
| T-02.02 | Diseño    | Diseñar modelo datos (envíos, remitentes, destinatarios) e interfaces |     8     |           |
| T-02.03 | Desarrollo | Crear migraciones + endpoints POST/GET /envios              |    11     |           |
| T-02.04 | Desarrollo | Implementar formulario y lista de envíos en frontend        |     9     |           |
| T-02.05 | Prueba     | Pruebas unitarias + integración + exploratoria             |     7     |           |
|         |            | **Subtotal HU-02**                                          |  **40**   |           |

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
| T-04.03 | Desarrollo | Implementar endpoints asignación/desasignación + validaciones |    12     |           |
| T-04.04 | Desarrollo | Implementar pantalla de asignación en frontend             |     7     |           |
| T-04.05 | Prueba     | Pruebas unitarias + integración + exploratoria             |     7     |           |
|         |            | **Subtotal HU-04**                                          |  **35**   |           |

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
| HU-01 — Autenticación |     49     |
| HU-02 — Envíos        |     40     |
| HU-03 — Rutas         |     30     |
| HU-04 — Asignación   |     35     |
| HU-05 — Repartidor    |     25     |
| Transversales          |     28     |
| **Total Sprint 1**     |  **207**   |

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

## 6. Cronograma y Burndown Chart

### Cronograma semanal

| Semana | Período        | Actividades principales                                              |
| :----: | --------------- | --------------------------------------------------------------------- |
|   1    | 04/08 – 10/08  | Análisis y diseño de todas las HU. Modelo de datos. Config proyectos.|
|   2    | 11/08 – 17/08  | Desarrollo HU-01 y HU-02. Migraciones BD. Inicio frontend.          |
|   —    | **19/08**      | **Presentación del Product Backlog y Sprint Backlog**                |
|   3    | 18/08 – 24/08  | Desarrollo HU-03 y HU-04. Pruebas unitarias de HU-01 y HU-02.      |
|   4    | 25/08 – 01/09  | Desarrollo HU-05. Pruebas integración y exploratorias. Documentación.|
|   —    | **02/09**      | **Presentación del Sprint 1 y Retrospectiva**                       |

### Burndown Chart

| Fecha            | SP Ideal | SP Real | Horas Ideal | Horas Real |
| ---------------- | :------: | :-----: | :---------: | :--------: |
| 04/08 (inicio)   |    26    |   26    |     207     |    207     |
| 10/08 (semana 1) |    20    |         |     159     |            |
| 17/08 (semana 2) |    13    |         |     111     |            |
| 24/08 (semana 3) |     7    |         |      63     |            |
| 01/09 (semana 4) |     1    |         |      15     |            |
| 02/09 (cierre)   |     0    |         |       0     |            |

*Columnas "Real" a completar durante la ejecución del sprint.*

---

## 7. Criterios del Sprint

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

## 8. Retrospectiva — Teórico vs. Real

*(A completar en la reunión del 02/09/2026)*

### Resumen por grupo de tareas

| Grupo                  | Estimado (hs) | Real (hs) | Diferencia | Observaciones |
| ---------------------- | :-----------: | :-------: | :--------: | ------------- |
| HU-01 — Autenticación |      49       |           |            |               |
| HU-02 — Envíos        |      40       |           |            |               |
| HU-03 — Rutas         |      30       |           |            |               |
| HU-04 — Asignación   |      35       |           |            |               |
| HU-05 — Repartidor    |      25       |           |            |               |
| Transversales          |      28       |           |            |               |
| **Total Sprint**       |   **207**     |           |            |               |

### Resumen por integrante

| Integrante           | HU asignadas            | Horas estimadas | Horas reales | Diferencia |
| -------------------- | ----------------------- | :-------------: | :----------: | :--------: |
| Micheloud, Jeremías | HU-01 + Transversales   |       58        |              |            |
| Díaz Aimar, Felipe  | HU-02, HU-04 + Transv.  |       81        |              |            |
| Araya, Ulises        | HU-03, HU-05 + Transv.  |       68        |              |            |
|                      | **Total**               |     **207**     |              |            |

### Preguntas de Retrospectiva

**¿Qué salió bien?**
-

**¿Qué podemos mejorar?**
-

**¿Qué acciones concretas tomamos para el próximo sprint?**
-

---

*Documento del Sprint 1 — Proyecto Movii — UTN FRSF — Ingeniería y Calidad del Software — 2026*
