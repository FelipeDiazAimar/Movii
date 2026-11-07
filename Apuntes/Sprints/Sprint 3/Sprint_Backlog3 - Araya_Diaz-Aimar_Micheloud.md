# Sprint Backlog 3

## Sistema de Gestión de Envíos y Distribución — Movii

**Cátedra:** Ingeniería y Calidad del Software

**Integrantes del Grupo Nro 7:**

- Araya, Ulises
- Díaz Aimar, Felipe
- Micheloud, Jeremías

**Docentes:**

- Gandino, Diego
- Saldarini, Javier Daniel

**Duración del Sprint:** 01/10/2026 – 07/11/2026

**Fecha de presentación del Backlog:** Jueves 01/10/2026

**Fecha de entrega final del Sprint:** 07/11/2026

---

## 1. Objetivo del Sprint

Cerrar el producto: dar al supervisor la **visión de la operación en vivo** y a la gerencia los **reportes** para decidir, y dejar la app del repartidor **instalable** en los teléfonos.

Al terminar el Sprint 3:

1. El supervisor tiene un **Centro de operaciones** con los KPIs del día, la flota alrededor del camión (carga, chofer, ruta como línea de paradas, paquetes a bordo) y un **mapa real** donde los camiones se mueven en vivo.
2. Tocando un paquete o una parada se traza el **camino por las calles** desde el camión hasta ese destino, con distancia y tiempo estimado.
3. El repartidor ve su ruta en un **mapa real** dentro de la app, con el recorrido por calles y su camión.
4. La gerencia consulta y exporta **reportes por período**, el **ranking de repartidores** y el **Pareto de incidencias**.
5. El login es en **dos pasos**: después de la contraseña se pide un **código de 6 dígitos que llega por WhatsApp**, y el sistema **avisa por WhatsApp** al destinatario (con su link de seguimiento) y al repartidor (cuando se le asigna una ruta).
6. La app del repartidor se instala como **APK en Android** y como **PWA en iPhone**, y el sistema queda **desplegado** (Vercel + Railway + Supabase).

---

## 2. Product Backlog priorizado completo

| ID    | Historia de Usuario                              | Prioridad | Valor | SP | Sprint   | Estado       |
| ----- | ------------------------------------------------ | --------- | :---: | :-: | -------- | ------------ |
| HU-01 | Registro y autenticación de usuarios             | Muy Alta  |   8   |  8 | Sprint 1 | ✅ Terminada |
| HU-02 | Registro de envíos                               | Muy Alta  |   8   |  5 | Sprint 1 | ✅ Terminada |
| HU-03 | Gestión de rutas diarias                         | Alta      |   5   |  5 | Sprint 1 | ✅ Terminada |
| HU-04 | Asignación de envíos a ruta                      | Alta      |   5   |  5 | Sprint 1 | ✅ Terminada |
| HU-05 | Listado de envíos del día para repartidor        | Alta      |   5   |  3 | Sprint 1 | ✅ Terminada |
| HU-06 | Actualización de estado de entrega               | Alta      |   8   |  5 | Sprint 2 | ✅ Terminada |
| HU-07 | Registro de entrega fallida con motivo           | Alta      |   5   |  5 | Sprint 2 | ✅ Terminada |
| HU-08 | Confirmación de entrega con firma y foto         | Alta      |   5   |  8 | Sprint 2 | ✅ Terminada (corrección de firma en Sprint 3) |
| HU-09 | Reprogramación de entregas fallidas              | Media     |   5   |  5 | Sprint 2 | ✅ Terminada |
| HU-10 | Tracking público por código de guía              | Media     |   5   |  3 | Sprint 2 | ✅ Terminada |
| HU-11 | Panel de operaciones en tiempo real              | Media     |   3   |  5 | Sprint 3 | ✅ Terminada |
| HU-12 | Visualización de ruta en mapa                    | Media     |   3   |  5 → 8 | Sprint 3 | ✅ Terminada |
| HU-13 | Reportes de envíos por período                   | Baja      |   2   |  3 | Sprint 3 | ✅ Terminada |
| HU-14 | Ranking de desempeño de repartidores             | Baja      |   2   |  3 | Sprint 3 | ✅ Terminada |
| HU-15 | Clasificación de incidencias por motivo          | Baja      |   2   |  3 | Sprint 3 | ✅ Terminada |
| HU-16 | Verificación en dos pasos con código por WhatsApp | Media     |   3   |  5 | Sprint 3 | ✅ Terminada |
| HU-17 | Avisos por WhatsApp a destinatarios y repartidores | Media   |   5   |  5 | Sprint 3 | ✅ Terminada |
| HU-18 | Gestión de flota de vehículos                    | Media     |   3   |  5 | Sprint 3 | ✅ Terminada |
| HU-19 | App del repartidor instalable (APK y PWA)        | Alta      |   5   |  3 | Sprint 3 | ✅ Terminada |

### 2.1 Cambios al Product Backlog durante el Sprint 3

| Fecha | Cambio | Motivo |
| --- | --- | --- |
| 22/10 | Primera implementación de HU-11 a HU-15 (rama `Sprint3`). | Avance del sprint. |
| 04/11 | Se revierte esa implementación de `main` y se guarda en la rama `Sprint3`. | Había quedado sobre una base anterior a las mejoras del 04/11 (pestaña Repartidores, asignación envío–ruta–repartidor, panel del repartidor servido en `/app`). |
| 07/11 | Se reintegran HU-11 a HU-15 sobre `main`: analítica y reportes de la rama `Sprint3` + vista de flota del segundo intento. Se comparan ambas versiones corriendo en local antes de decidir. | Quedarse con lo mejor de las dos sin perder lo del 04/11. |
| 07/11 | **HU-12 ampliada** (5 → 8 SP): mapa real con recorrido **por calles** (OSRM), geocodificación de direcciones (Nominatim) y camiones en vivo con **GPS simulado**. | Pedido del Product Owner. No es optimización de rutas (sigue fuera de alcance): el orden de las paradas lo define el operador y el mapa solo dibuja el camino. |
| 07/11 | **Alta HU-16** (login en dos pasos: código de 6 dígitos por WhatsApp) y **HU-17** (avisos por WhatsApp). | Pedido del Product Owner. HU-17 retoma la notificación al cliente que se había excluido en HU-09 CA-06 (10/09). |
| 07/11 | **Alta HU-18** (flota). | La vista del camión con su carga (referencia FleetTrack) necesita vehículos con capacidad y asignación a la ruta del día. |
| 07/11 | **Alta HU-19** (APK + PWA). | La app solo se probaba en Expo Go; hace falta poder instalarla. |

---

## 3. Historias de Usuario del Sprint 3

### HU-11 — Panel de operaciones en tiempo real

| Campo | Detalle |
| :--- | :--- |
| **Título** | Centro de operaciones con la flota en vivo |
| **YO COMO** | Supervisor / operador logístico |
| **DESEO** | ver en un solo lugar las métricas del día, cada camión con su carga y su posición en vivo |
| **PARA** | anticipar desvíos y coordinar la operación sin llamar a cada repartidor |
| **CA-01** | La cabecera muestra 4 KPIs reales: vehículos en servicio, en mantenimiento, efectividad del día (entregados / resueltos) y envíos en tránsito. |
| **CA-02** | El camión seleccionado es el protagonista: patente, tipo y modelo, estado, ruta del día y paquetes a bordo. |
| **CA-03** | Un indicador radial muestra la ocupación (% de capacidad) con la carga actual y la máxima en kg. |
| **CA-04** | La tarjeta del chofer muestra nombre, zona, hora de la última señal y la ruta como **línea de paradas** (depósito → última entrega) con el avance. |
| **CA-05** | Debajo hay un carrusel con toda la flota para cambiar de camión, y la lista de paquetes del camión (urgente/frágil, estado). |
| **CA-06** | El mapa se actualiza **en vivo** (SSE) sin recargar; el panel indica "En vivo" / "Conectando…". |
| **CA-07** | Se listan las rutas del día con su avance y las últimas incidencias con su motivo. |
| **Prioridad / SP / Valor** | Media / 5 / 3 |

### HU-12 — Visualización de ruta en mapa (ampliada)

| Campo | Detalle |
| :--- | :--- |
| **YO COMO** | Supervisor y repartidor |
| **DESEO** | ver la ruta sobre un mapa real con las paradas, el camino por las calles y dónde está el camión |
| **PARA** | saber cuánto falta para cada entrega y orientarme en la calle |
| **CA-01** | Las direcciones de los envíos se ubican en el mapa automáticamente al darlos de alta (OpenStreetMap/Nominatim). Si la dirección exacta no aparece se usa la calle; si tampoco, la localidad, y se marca como aproximada. |
| **CA-02** | El mapa de la ruta muestra las paradas numeradas según el orden de reparto y coloreadas por estado (azul asignado, naranja en camino, verde entregado, rojo no entregado), el depósito y el recorrido por calles (OSRM). |
| **CA-03** | El camión de la ruta aparece en el mapa y se desplaza en vivo con su rumbo. En la demo la posición la genera un **simulador GPS** que lo mueve por las calles mientras la ruta tenga entregas pendientes. |
| **CA-04** | Al tocar una parada o un paquete se resalta el **camino por las calles desde el camión hasta ese destino**, con distancia, tiempo estimado y cuántas entregas hay antes. |
| **CA-05** | El detalle del envío (web) incluye una tarjeta de seguimiento en vivo con el destino, el camión y el camino restante. |
| **CA-06** | En la app, el repartidor ve el mapa real de su ruta y, en cada parada, el camino desde su camión hasta esa dirección. Un repartidor no puede ver rutas ajenas (404). |
| **CA-07** | Si el servicio de recorridos no responde, el mapa igual se dibuja (línea recta entre puntos). |
| **Prioridad / SP / Valor** | Media / 8 / 3 |

### HU-13 — Reportes de envíos por período

| Campo | Detalle |
| :--- | :--- |
| **YO COMO** | Supervisor |
| **DESEO** | filtrar los envíos por período y estado y exportarlos |
| **PARA** | analizar la operación fuera del sistema |
| **CA-01** | Filtro desde/hasta (obligatorio, máximo 366 días) y estado opcional; período inválido → error claro. |
| **CA-02** | Tabla con código, alta, remitente, destinatario, dirección, estado, última actualización y motivo del último fallo. |
| **CA-03** | Exportación a **CSV** con los mismos filtros; las celdas que empiezan con `= + - @` se escapan para evitar inyección de fórmulas. |
| **Prioridad / SP / Valor** | Baja / 3 / 2 |

### HU-14 — Ranking de desempeño de repartidores

| Campo | Detalle |
| :--- | :--- |
| **YO COMO** | Supervisor |
| **DESEO** | ver un ranking de repartidores por período |
| **PARA** | reconocer el buen desempeño y detectar problemas |
| **CA-01** | Por repartidor: asignados, entregados, fallidos, tasa de efectividad y minutos promedio entre "en camino" y "entregado". |
| **CA-02** | Ordenado por efectividad y luego por entregados; muestra la posición. |
| **Prioridad / SP / Valor** | Baja / 3 / 2 |

### HU-15 — Clasificación de incidencias por motivo

| Campo | Detalle |
| :--- | :--- |
| **YO COMO** | Supervisor |
| **DESEO** | ver las incidencias del período agrupadas por motivo |
| **PARA** | atacar las causas más frecuentes |
| **CA-01** | Pareto con los 5 motivos de HU-07 siempre presentes, cantidad y porcentaje, de mayor a menor. |
| **Prioridad / SP / Valor** | Baja / 3 / 2 |

### HU-16 — Verificación en dos pasos con código por WhatsApp (nueva)

| Campo | Detalle |
| :--- | :--- |
| **YO COMO** | Usuario del sistema (operador, supervisor o repartidor) |
| **DESEO** | que después de mi contraseña la app me pida un código de 6 dígitos que me llega por WhatsApp |
| **PARA** | que nadie pueda entrar a mi cuenta solo con mi contraseña |
| **CA-01** | En el login (web y app) ingreso email y contraseña; si tengo celular cargado, la app no me deja entrar todavía: muestra "Verificá que sos vos" con mi número enmascarado (+54 9 3564 ••••45). |
| **CA-02** | Me llega por WhatsApp un código de 6 dígitos; al ingresarlo entro. |
| **CA-03** | El código vence a los 5 minutos, admite 5 intentos, sirve una sola vez y queda atado a ese inicio de sesión; se guarda solo su hash. |
| **CA-04** | Puedo pedir que me lo reenvíen (cada 30 s en la pantalla); como máximo 3 códigos cada 15 minutos. El reenvío invalida el código anterior. |
| **CA-05** | Con contraseña incorrecta no se manda ningún código. |
| **CA-06** | Si no tengo celular cargado, o si la cuenta de WhatsApp de la empresa está desvinculada o no puede entregar el mensaje, entro solo con la contraseña (nadie queda afuera, incluido el supervisor que tiene que volver a vincularla). |
| **CA-07** | El supervisor carga el celular de cada usuario (se normaliza: acepta 0, 15, +54, etc.) y vincula la cuenta de WhatsApp de la empresa escaneando un QR. |
| **Prioridad / SP / Valor** | Media / 5 / 3 |

### HU-17 — Avisos por WhatsApp (nueva)

| Campo | Detalle |
| :--- | :--- |
| **YO COMO** | Destinatario de un envío / repartidor |
| **DESEO** | recibir un WhatsApp cuando cambia el estado de mi envío / cuando me asignan una ruta |
| **PARA** | saber cuándo llega sin tener que consultar / planificar mi día |
| **CA-01** | El destinatario recibe un aviso cuando su envío sale a reparto, se entrega, no se puede entregar (con el motivo) o se reprograma (con fecha y franja). Todos incluyen el link de seguimiento público (HU-10). |
| **CA-02** | El repartidor recibe un aviso cuando se le asignan envíos, con la ruta, la fecha, la cantidad de envíos y el vehículo. |
| **CA-03** | Un fallo de WhatsApp nunca bloquea ni revierte la operación (los avisos van por una cola). |
| **CA-04** | Cada aviso queda registrado (enviado, fallido u omitido por falta de teléfono) y no se manda dos veces el mismo; el operador los ve en el detalle del envío. |
| **Prioridad / SP / Valor** | Media / 5 / 5 |

### HU-18 — Gestión de flota de vehículos (nueva)

| Campo | Detalle |
| :--- | :--- |
| **YO COMO** | Operador / supervisor |
| **DESEO** | registrar los vehículos y asignar uno a cada ruta del día |
| **PARA** | saber qué camión lleva cada carga y cuánta capacidad le queda |
| **CA-01** | Alta y edición de vehículos: patente (validada y única), modelo, tipo, capacidad en kg y m³, estado (en servicio, en base, mantenimiento). |
| **CA-02** | Desde la ruta se elige el vehículo; uno en mantenimiento o ya ocupado ese día no se puede asignar. |
| **CA-03** | La flota muestra para cada vehículo su ruta del día, chofer, paquetes y carga (% de ocupación). |
| **Prioridad / SP / Valor** | Media / 5 / 3 |

### HU-19 — App del repartidor instalable (nueva)

| Campo | Detalle |
| :--- | :--- |
| **YO COMO** | Repartidor |
| **DESEO** | instalar la app en mi teléfono |
| **PARA** | usarla todo el día como cualquier app, sin Expo Go |
| **CA-01** | Android: se genera un **APK** con EAS Build instalable desde un link. |
| **CA-02** | iPhone: la app es una **PWA** que se agrega a inicio y abre a pantalla completa, sin barras del navegador; la barra de estado y el fondo se funden con la app y se respetan el notch y la barra de inicio. |
| **CA-03** | La firma digital funciona en **todo el ancho** del recuadro y se exporta también desde la PWA. |
| **Prioridad / SP / Valor** | Alta / 3 / 5 |

---

## 4. Estimaciones de Valor y Esfuerzo

| HU | Valor | SP | V/E |
| --- | :-: | :-: | :-: |
| HU-19 | 5 | 3 | 1,67 |
| HU-17 | 5 | 5 | 1,00 |
| HU-11 | 3 | 5 | 0,60 |
| HU-16 | 3 | 5 | 0,60 |
| HU-18 | 3 | 5 | 0,60 |
| HU-13 | 2 | 3 | 0,67 |
| HU-14 | 2 | 3 | 0,67 |
| HU-15 | 2 | 3 | 0,67 |
| HU-12 | 3 | 8 | 0,38 |
| **Total** | **28** | **40** | |

Lo planificado al inicio (HU-11 a HU-15, con HU-12 en 5 SP) sumaba **19 SP**. Con la ampliación de HU-12 (+3) y las historias nuevas HU-16 a HU-19 (+18) el sprint cierra con **40 SP**.

---

## 5. Sprint Backlog — Desglose de tareas

> **Horas reales:** completar la columna "Real" con lo registrado por cada integrante antes de la entrega (no se cargan valores estimados como reales).

### HU-11 — Panel de operaciones

| ID | Tarea | Fase | Est. (h) | Real (h) | Estado |
| --- | --- | --- | :-: | :-: | :-: |
| T-11.01 | Consultas de métricas del día, rutas activas e incidencias (`OperacionesRepo`) | Desarrollo | 4 | | ✅ |
| T-11.02 | Endpoint `GET /operaciones/dashboard` con validación de fecha (día argentino) | Desarrollo | 2 | | ✅ |
| T-11.03 | Diseño de la vista "camión protagonista" (referencia FleetTrack) | Diseño | 3 | | ✅ |
| T-11.04 | Página Centro de operaciones: KPIs, camión, carrusel, gauge, chofer y línea de paradas | Desarrollo | 8 | | ✅ |
| T-11.05 | Stream SSE de posiciones y hook `useFlotaEnVivo` | Desarrollo | 4 | | ✅ |
| T-11.06 | Tests del servicio y del flujo E2E de analítica | Testing | 3 | | ✅ |

### HU-12 — Mapa (ampliada)

| ID | Tarea | Fase | Est. (h) | Real (h) | Estado |
| --- | --- | --- | :-: | :-: | :-: |
| T-12.01 | Migración 0006 (coordenadas de destinatarios) y 0007 (`geo_fuente`) | Desarrollo | 1 | | ✅ |
| T-12.02 | Paquete `geo`: Nominatim (1 consulta/s, caché, User-Agent propio) y OSRM con respaldo en línea recta | Desarrollo | 5 | | ✅ |
| T-12.03 | Geocodificación al alta del envío y backfill al arrancar (abreviaturas, calle sin altura, localidad) | Desarrollo | 3 | | ✅ |
| T-12.04 | `GET /rutas/{id}/mapa` con recorrido y vehículo; `GET /envios/{id}/trayecto` | Desarrollo | 4 | | ✅ |
| T-12.05 | Simulador GPS (avance sobre la polilínea, rumbo, recálculo al resolver paradas) | Desarrollo | 4 | | ✅ |
| T-12.06 | Componente `MapaMovii` (Leaflet): paradas, recorrido, trayecto, camión animado | Desarrollo | 5 | | ✅ |
| T-12.07 | Mapa de ruta web, tarjeta de seguimiento en el envío | Desarrollo | 3 | | ✅ |
| T-12.08 | Mapa en la app (Leaflet en WebView/iframe), mapa de ruta y de parada con datos reales | Desarrollo | 6 | | ✅ |
| T-12.09 | Tests: geo (haversine, rumbo, interpolación, proveedores con servidor falso), simulador, flujo E2E | Testing | 4 | | ✅ |

### HU-13 / HU-14 / HU-15 — Reportes

| ID | Tarea | Fase | Est. (h) | Real (h) | Estado |
| --- | --- | --- | :-: | :-: | :-: |
| T-13.01 | `ReportesRepo`: envíos (streaming), ranking, Pareto | Desarrollo | 5 | | ✅ |
| T-13.02 | Endpoints `/reportes/envios` (JSON/CSV), `/reportes/repartidores`, `/reportes/incidencias` | Desarrollo | 3 | | ✅ |
| T-13.03 | Página Reportes con pestañas, filtros y descarga CSV | Desarrollo | 5 | | ✅ |
| T-13.04 | Tests de validación de período, CSV y página | Testing | 3 | | ✅ |

### HU-16 / HU-17 — WhatsApp

| ID | Tarea | Fase | Est. (h) | Real (h) | Estado |
| --- | --- | --- | :-: | :-: | :-: |
| T-16.01 | Análisis: API oficial de Meta vs. whatsmeow (cuenta vinculada por QR) | Análisis | 2 | | ✅ |
| T-16.02 | Migración 0008 (teléfono de usuario, códigos OTP, registro de avisos) | Desarrollo | 1 | | ✅ |
| T-16.03 | Cliente WhatsApp (sesión en Postgres, QR, reconexión, resolución del número) | Desarrollo | 5 | | ✅ |
| T-16.04 | Segundo paso del login: desafío, código con hash HMAC, vencimiento, intentos, reenvío y límite; endpoints `/auth/login/verificar` y `/auth/login/reenviar` | Desarrollo | 4 | | ✅ |
| T-16.05 | Normalización de teléfonos argentinos | Desarrollo | 1 | | ✅ |
| T-16.06 | Pantalla del código en el login web y de la app; celular en usuarios; página de vinculación | Desarrollo | 5 | | ✅ |
| T-17.01 | Notificador con cola e idempotencia; ganchos en estados, reprogramación y asignación | Desarrollo | 4 | | ✅ |
| T-17.02 | Tarjeta "Avisos por WhatsApp" en el detalle del envío | Desarrollo | 1 | | ✅ |
| T-16.07 | Tests de OTP, mensajes, notificador y teléfonos | Testing | 3 | | ✅ |

### HU-18 — Flota

| ID | Tarea | Fase | Est. (h) | Real (h) | Estado |
| --- | --- | --- | :-: | :-: | :-: |
| T-18.01 | Migración 0007 (`vehiculos`, `rutas.vehiculo_id` único por día) | Desarrollo | 1 | | ✅ |
| T-18.02 | `FlotaRepo`/`FlotaService`: flota del día, detalle, alta, edición, asignación | Desarrollo | 5 | | ✅ |
| T-18.03 | Página Vehículos y selector de vehículo en la ruta | Desarrollo | 4 | | ✅ |
| T-18.04 | Test E2E de flota y trayecto | Testing | 2 | | ✅ |

### HU-19 — App instalable

| ID | Tarea | Fase | Est. (h) | Real (h) | Estado |
| --- | --- | --- | :-: | :-: | :-: |
| T-19.01 | Corrección de la firma (tamaño explícito del SVG, toques, scroll, PNG en web) | Desarrollo | 3 | | ✅ |
| T-19.02 | PWA: manifest, íconos, service worker, `viewport-fit=cover`, colores de barras | Desarrollo | 3 | | ✅ |
| T-19.03 | Safe areas reales en header, pestañas y pantallas | Desarrollo | 2 | | ✅ |
| T-19.04 | `eas.json` (perfil APK) y configuración Android | Desarrollo | 1 | | ✅ |
| T-19.05 | Prueba en Android (APK) y iPhone (PWA) físicos | Testing | 2 | | ⬜ pendiente del equipo |

### Transversales

| ID | Tarea | Fase | Est. (h) | Real (h) | Estado |
| --- | --- | --- | :-: | :-: | :-: |
| T-00.01 | Comparar las dos implementaciones del sprint corriendo en local y decidir la base | Análisis | 2 | | ✅ |
| T-00.02 | Reintegración sobre `main` y corrección de bugs del segundo intento (404 que daban 500, campos NULL, coordenadas inventadas, dependencia no declarada) | Desarrollo | 4 | | ✅ |
| T-00.03 | Corrección del "hoy" en UTC (rutas de hoy figuraban vencidas después de las 21 h) | Desarrollo | 1 | | ✅ |
| T-00.04 | Comando `cmd/demo` (rutas de hoy con direcciones reales y camiones) | Desarrollo | 2 | | ✅ |
| T-00.05 | Deploy: migraciones al arrancar, `vercel.json`, build combinado, guía de deploy, CI | Desarrollo | 4 | | ✅ |
| T-00.06 | OpenAPI: endpoints y esquemas del Sprint 3 | Documentación | 2 | | ✅ |
| T-00.07 | Documentación del sprint y plan de pruebas | Documentación | 4 | | ✅ |

---

## 6. Modelo de datos — Extensión Sprint 3

| Migración | Cambios |
| --- | --- |
| `0006_sprint3_analitica_y_mapas` | `destinatarios.latitud`, `destinatarios.longitud`; índices para las agregaciones de reportes. |
| `0007_flota_y_geo` | Tabla `vehiculos` (patente única, modelo, tipo, capacidades, estado, telemetría: latitud, longitud, velocidad, rumbo, temperatura, `posicion_at`); `rutas.vehiculo_id` con índice único `(vehiculo_id, fecha)`; `destinatarios.geo_fuente` (`nominatim` / `aproximada` / `demo`); 3 vehículos de demo. |
| `0008_whatsapp` | `usuarios.telefono` (único); `codigos_otp` (hash, intentos, vencimiento, usado); `notificaciones_whatsapp` (clave única de idempotencia, tipo, estado, error). |

Además, whatsmeow crea sus tablas `whatsmeow_*` (sesión del dispositivo vinculado) en la misma base.

```
usuarios 1 ─── * rutas * ─── 0..1 vehiculos
                  │
                  1
                  │
                  * envios * ─── 1 destinatarios (lat, lng, geo_fuente)
                       │
                       * notificaciones_whatsapp
usuarios 1 ─── * codigos_otp
```

---

## 7. Definition of Done

- Código en `main` con revisión de pares, compilando (`go build`, `tsc`, `vite build`, `expo export`).
- Tests unitarios y de integración en verde (`go test ./... -p 1`, `npm test` en web y mobile) y CI de GitHub Actions en verde.
- Endpoints documentados en `docs/api/openapi.yaml`.
- Criterios de aceptación verificados en el sistema corriendo (web, PWA y API).
- Migraciones con su `down`.
- Sin credenciales en el repositorio (`.env` fuera de git; `.env.example` actualizado).
