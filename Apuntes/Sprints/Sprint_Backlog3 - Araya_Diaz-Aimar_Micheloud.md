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

**Duración del Sprint:** 14 días (24/09/2026 – 08/10/2026 · Cierre consolidado: 22/10/2026)

**Fecha de presentación del Backlog:** Jueves 24/09/2026

**Fecha de presentación y cierre del Sprint:** Jueves 22/10/2026

---

## 1. Objetivo del Sprint

Implementar la inteligencia operativa, asistencia geoespacial y analítica del ciclo logístico de Movii:
1. **HU-11:** Panel de operaciones en tiempo real con monitoreo en vivo de rutas, métricas diarias y alertas de fallos.
2. **HU-12:** Visualización de rutas en mapa con coordenadas geográficas de paradas para repartidores y supervisores.
3. **HU-13:** Reportes de envíos históricos por período con filtros avanzados y exportación en streaming a formato CSV.
4. **HU-14:** Ranking de desempeño y productividad de repartidores basado en tasa de efectividad y tiempos promedio.
5. **HU-15:** Clasificación analítica y distribución de Pareto de incidencias por motivo para optimización de entregas.

**Alcance:** Completo (100% de las 5 Historias de Usuario implementadas en Backend Go, Frontend Web React y App Móvil Expo).

---

## 2. Product Backlog priorizado

| ID    | Historia de Usuario                         | Prioridad | Sprint      | Estado |
| ----- | ------------------------------------------- | --------- | ----------- | :----: |
| HU-01 | Registro y autenticación de usuarios       | Muy Alta  | Sprint 1    |   ✅   |
| HU-02 | Registro de envíos                         | Muy Alta  | Sprint 1    |   ✅   |
| HU-03 | Gestión de rutas diarias                   | Alta      | Sprint 1    |   ✅   |
| HU-04 | Asignación de envíos a ruta                | Alta      | Sprint 1    |   ✅   |
| HU-05 | Listado de envíos del día para repartidor | Alta      | Sprint 1    |   ✅   |
| HU-06 | Actualización de estado de entrega         | Alta      | Sprint 2    |   ✅   |
| HU-07 | Registro de entrega fallida con motivo      | Alta      | Sprint 2    |   ✅   |
| HU-08 | Confirmación de entrega con firma y foto   | Alta      | Sprint 2    |   ✅   |
| HU-09 | Reprogramación de entregas fallidas        | Media     | Sprint 2    |   ✅   |
| HU-10 | Tracking público por código de guía      | Media     | Sprint 2    |   ✅   |
| HU-11 | Panel de operaciones en tiempo real         | Alta      | Sprint 3    |   ✅   |
| HU-12 | Visualización de ruta en mapa              | Alta      | Sprint 3    |   ✅   |
| HU-13 | Reportes de envíos por período            | Media     | Sprint 3    |   ✅   |
| HU-14 | Ranking de desempeño de repartidores       | Media     | Sprint 3    |   ✅   |
| HU-15 | Clasificación de incidencias por motivo    | Media     | Sprint 3    |   ✅   |

---

## 3. Historias de Usuario del Sprint 3

### HU-11 — Panel de operaciones en tiempo real

|                  |                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Título**       | Panel de operaciones en tiempo real                                                                                                                         |
| **YO COMO**      | Operador / Supervisor logístico                                                                                                                             |
| **DESEO**        | Visualizar en un panel unificado el pulso de la operación diaria con indicadores clave, avance de rutas y alertas inmediatas                               |
| **PARA**         | Tomar decisiones ágiles, detectar cuellos de botella y reaccionar ante contingencias en el reparto                                                         |
| **Criterios**    |                                                                                                                                                              |
| CA-01            | El panel muestra tarjetas con los totales del día: total de envíos, pendientes, asignados, en camino, entregados, no entregados y porcentaje de efectividad. |
| CA-02            | Los envíos del día consideran los asignados a rutas de la fecha consultada más los pendientes sin ruta creados o reprogramados para esa fecha.              |
| CA-03            | Se muestra una tabla con las rutas activas, indicando repartidor, paradas totales, paradas completadas, porcentaje de avance visual y estado de la ruta.     |
| CA-04            | Se presenta una sección con las últimas incidencias registradas en la jornada con acceso directo al detalle del envío afectado.                             |
| CA-05            | El frontend web actualiza automáticamente los datos cada 30 segundos mediante polling reactivo sin recargar la página completa.                              |
| CA-06            | La API expone el endpoint `GET /operaciones/dashboard?fecha=YYYY-MM-DD` protegido para roles `operador` y `supervisor`.                                    |
| **Propiedades**  | Prioridad: Alta · Valor de negocio: 5 · Esfuerzo: 5 SP · Responsables: Araya / Micheloud                                                                     |

---

### HU-12 — Visualización de ruta en mapa

|                  |                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Título**       | Visualización de ruta en mapa                                                                                                                               |
| **YO COMO**      | Repartidor y Operador                                                                                                                                        |
| **DESEO**        | Ver las paradas de la ruta distribuidas geográficamente sobre un mapa interactivo con marcadores numerados y trazado de recorrido                           |
| **PARA**         | Optimizar los tiempos de traslado, comprender la secuencia de entrega y contar con orientación visual en calle                                             |
| **Criterios**    |                                                                                                                                                              |
| CA-01            | La base de datos almacena latitud y longitud para cada destinatario (`destinatarios.latitud`, `destinatarios.longitud`) mediante migración 0006.            |
| CA-02            | El endpoint `GET /rutas/{id}/mapa` devuelve el identificador de ruta, repartidor y las paradas ordenadas con coordenadas, dirección y estado actual.        |
| CA-03            | Si un repartidor autenticado consulta una ruta ajena o inexistente, la API responde 404 genérico protegiendo la privacidad de operaciones.                 |
| CA-04            | En la Web, el supervisor visualiza el mapa interactivo con OpenStreetMap y Leaflet, marcadores coloreados según estado y polyline de conexión.             |
| CA-05            | En la App Móvil, el repartidor accede a la pantalla de mapa (`route-map.tsx`) con marcadores nativos; al pulsar una parada puede saltar al detalle.        |
| **Propiedades**  | Prioridad: Alta · Valor de negocio: 5 · Esfuerzo: 5 SP · Responsables: Díaz Aimar / Araya                                                                   |

---

### HU-13 — Reportes de envíos por período con exportación a CSV

|                  |                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Título**       | Reportes de envíos por período con exportación a CSV                                                                                                        |
| **YO COMO**      | Operador / Auditor                                                                                                                                          |
| **DESEO**        | Filtrar envíos históricos por rango de fechas y estado, y descargar los resultados en un archivo CSV estándar                                              |
| **PARA**         | Realizar conciliaciones administrativas, análisis contable y auditorías de servicio fuera de la plataforma                                                   |
| **Criterios**    |                                                                                                                                                              |
| CA-01            | El endpoint `GET /reportes/envios` valida obligatoriamente `desde` y `hasta` en formato `YYYY-MM-DD`, con `desde <= hasta` y rango máximo de 366 días.      |
| CA-02            | Permite filtrar opcionalmente por `estado` válido del enum (`pendiente`, `asignado`, `en_camino`, `entregado`, `no_entregado`).                             |
| CA-03            | Soporta parámetro `formato=json` (vista previa en tabla web) y `formato=csv` (descarga binaria directa).                                                    |
| CA-04            | La descarga CSV se emite en streaming con UTF-8 BOM (`\xef\xbb\xbf`) para compatibilidad perfecta con Excel, y sanitiza caracteres de inyección de fórmulas (`=`, `+`, `-`, `@`, tab y CR).|
| CA-05            | El header HTTP incluye `Content-Disposition: attachment; filename="reporte_envios_{desde}_{hasta}.csv"`.                                                    |
| **Propiedades**  | Prioridad: Media · Valor de negocio: 3 · Esfuerzo: 3 SP · Responsables: Araya / Micheloud                                                                    |

---

### HU-14 — Ranking de desempeño de repartidores

|                  |                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Título**       | Ranking de desempeño de repartidores                                                                                                                         |
| **YO COMO**      | Supervisor logístico                                                                                                                                        |
| **DESEO**        | Evaluar el rendimiento comparativo de los repartidores mediante métricas de entregas exitosas, fallidas, efectividad y tiempos promedio                    |
| **PARA**         | Reconocer el desempeño del personal, asignar rutas complejas a repartidores experimentados y detectar necesidades de capacitación                           |
| **Criterios**    |                                                                                                                                                              |
| CA-01            | El endpoint `GET /reportes/repartidores?desde=...&hasta=...` calcula métricas a partir de los eventos reales registrados por el actor en `eventos_envio`.  |
| CA-02            | Si un envío fue reprogramado y desvinculado de la ruta, el intento fallido previo se sigue computando al repartidor que lo reportó.                         |
| CA-03            | El tiempo promedio de entrega se computa en minutos entre la transición `en_camino` y `entregado` (excluyendo confirmaciones directas sin tiempo en ruta).|
| CA-04            | El listado se ordena prioritariamente por tasa de efectividad descendente, luego por total de entregas y finalmente por nombre.                             |
| CA-05            | En la web se presenta un podio visual de los tres primeros puestos y una tabla comparativa completa con indicadores destacados.                             |
| **Propiedades**  | Prioridad: Media · Valor de negocio: 3 · Esfuerzo: 3 SP · Responsables: Micheloud / Araya                                                                    |

---

### HU-15 — Clasificación y analítica de incidencias por motivo

|                  |                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Título**       | Clasificación y analítica de incidencias por motivo                                                                                                         |
| **YO COMO**      | Supervisor de operaciones                                                                                                                                   |
| **DESEO**        | Analizar la distribución de motivos por los cuales las entregas resultan fallidas en un período determinado                                                |
| **PARA**         | Identificar las principales causas de fallo (Pareto) e implementar medidas preventivas con clientes y remitentes                                            |
| **Criterios**    |                                                                                                                                                              |
| CA-01            | El endpoint `GET /reportes/incidencias?desde=...&hasta=...` agrupa los eventos de fallo registrados en el período especificado.                             |
| CA-02            | La respuesta incluye siempre los 5 motivos del catálogo cerrado (`cliente_ausente`, `direccion_incorrecta`, `rechazado`, `zona_insegura`, `otro`).         |
| CA-03            | Los motivos con 0 incidencias se incluyen con cantidad 0 y 0.0% para mantener consistencia en la visualización.                                             |
| CA-04            | El resultado se ordena de mayor a menor cantidad de fallos (análisis de Pareto) con cálculo de porcentaje relativo respecto al total.                        |
| CA-05            | En la web se renderiza mediante barras de progreso proporcionales estilizadas con Tailwind CSS sin añadir dependencias externas de gráficos.                |
| **Propiedades**  | Prioridad: Media · Valor de negocio: 3 · Esfuerzo: 3 SP · Responsables: Araya / Díaz Aimar                                                                   |

---

## 4. Estimaciones de Valor y Esfuerzo

### 4.1 Resumen de estimaciones

| ID    | Historia de Usuario                      | Valor de Negocio | Esfuerzo (SP) | Prioridad (V/E) | Responsable                  |
| ----- | ---------------------------------------- | :--------------: | :-----------: | :-------------: | ---------------------------- |
| HU-11 | Panel de operaciones en tiempo real      |        5         |       5       |      1.00       | Araya / Micheloud            |
| HU-12 | Visualización de ruta en mapa           |        5         |       5       |      1.00       | Díaz Aimar / Araya           |
| HU-13 | Reportes de envíos por período (CSV)    |        3         |       3       |      1.00       | Araya / Micheloud            |
| HU-14 | Ranking de desempeño de repartidores     |        3         |       3       |      1.00       | Micheloud / Araya            |
| HU-15 | Clasificación de incidencias por motivo  |        3         |       3       |      1.00       | Araya / Díaz Aimar           |
|       | **Total Sprint 3**                       |      **19**      |   **19 SP**   |                 |                              |

**Capacidad nominal:** 3 integrantes × 14 días × ~2 hs/día = **~84 horas**.
**Estimado total de tareas:** 82 horas (19 Story Points).
**Registro de horas reales:** Las horas reales quedan a consolidar por los integrantes del equipo al cierre definitivo de la entrega.

---

## 5. Sprint Backlog — Desglose de tareas

### HU-11 — Panel de operaciones en tiempo real

| #       | Fase       | Tarea                                                                               | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ----------------------------------------------------------------------------------- | :-----------: | :-------: | :----: |
| T-11.01 | Análisis  | Definir agregaciones de métricas del día (en ruta + pendientes creados/reprogramados)|       2       |     —     |   ✅   |
| T-11.02 | Diseño    | Diseñar contrato DTO de dashboard y tipos TypeScript                                |       1       |     —     |   ✅   |
| T-11.03 | Desarrollo | Implementar `OperacionesRepo.Dashboard` con queries agregadas eficientes            |       3       |     —     |   ✅   |
| T-11.04 | Desarrollo | Implementar `OperacionesService` y cálculo de porcentajes de efectividad            |       2       |     —     |   ✅   |
| T-11.05 | Desarrollo | Implementar `OperacionesHandler` + ruta `GET /operaciones/dashboard`                |       2       |     —     |   ✅   |
| T-11.06 | Desarrollo | Desarrollar `DashboardPage.tsx` en Web con polling de 30s y tarjetas de KPIs        |       4       |     —     |   ✅   |
| T-11.07 | Prueba     | Tests unitarios de cálculo y pruebas de integración de la pantalla web              |       2       |     —     |   ✅   |
|         |            | **Subtotal HU-11**                                                                  |    **16**     | A consolidar | ✅ |

### HU-12 — Visualización de ruta en mapa

| #       | Fase       | Tarea                                                                               | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ----------------------------------------------------------------------------------- | :-----------: | :-------: | :----: |
| T-12.01 | Análisis  | Soporte de coordenadas para paradas y datos de prueba representativos               |       2       |     —     |   ✅   |
| T-12.02 | Desarrollo | Crear migración 0006 (`latitud`, `longitud` en destinatarios e índices)             |       2       |     —     |   ✅   |
| T-12.03 | Desarrollo | Implementar `OperacionesRepo.MapaRuta` y guard de pertenencia para repartidor       |       3       |     —     |   ✅   |
| T-12.04 | Desarrollo | Implementar endpoint `GET /rutas/{id}/mapa` y documentar en OpenAPI                 |       2       |     —     |   ✅   |
| T-12.05 | Desarrollo | Desarrollar `RutaMapaPage.tsx` en Web con Leaflet, OpenStreetMap y marcadores      |       4       |     —     |   ✅   |
| T-12.06 | Desarrollo | Desarrollar `route-map.tsx` en App Móvil con marcadores y polyline                  |       4       |     —     |   ✅   |
| T-12.07 | Desarrollo | Soporte web fallback `route-map.web.tsx` para compatibilidad en navegador           |       1       |     —     |   ✅   |
| T-12.08 | Prueba     | Tests de componentes mapa en Web y pruebas de adaptación en Mobile                  |       2       |     —     |   ✅   |
|         |            | **Subtotal HU-12**                                                                  |    **20**     | A consolidar | ✅ |

### HU-13 — Reportes de envíos por período (CSV)

| #       | Fase       | Tarea                                                                               | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ----------------------------------------------------------------------------------- | :-----------: | :-------: | :----: |
| T-13.01 | Análisis  | Definir columnas del reporte y validación de período (<= 366 días)                  |       1       |     —     |   ✅   |
| T-13.02 | Desarrollo | Implementar consulta en `ReportesRepo.ListarEnviosPeriodo` con filtros dinámicos    |       3       |     —     |   ✅   |
| T-13.03 | Desarrollo | Implementar streaming CSV con UTF-8 BOM y sanitización de inyección de fórmulas     |       3       |     —     |   ✅   |
| T-13.04 | Desarrollo | Implementar `GET /reportes/envios` en handler con soporte dual JSON/CSV             |       2       |     —     |   ✅   |
| T-13.05 | Desarrollo | Desarrollar pestaña Envíos en `ReportesPage.tsx` con descarga de blob autenticado   |       3       |     —     |   ✅   |
| T-13.06 | Prueba     | Tests de validación de fechas, formateo CSV y descarga web                          |       2       |     —     |   ✅   |
|         |            | **Subtotal HU-13**                                                                  |    **14**     | A consolidar | ✅ |

### HU-14 — Ranking de desempeño de repartidores

| #       | Fase       | Tarea                                                                               | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ----------------------------------------------------------------------------------- | :-----------: | :-------: | :----: |
| T-14.01 | Análisis  | Definir reglas de cálculo basadas en eventos de auditoría y tiempos de reparto      |       1       |     —     |   ✅   |
| T-14.02 | Desarrollo | Query SQL agregada en `ReportesRepo.RankingRepartidores` sobre `eventos_envio`      |       3       |     —     |   ✅   |
| T-14.03 | Desarrollo | Implementar `ReportesService` con cálculo de efectividad y tiempo promedio (min)    |       2       |     —     |   ✅   |
| T-14.04 | Desarrollo | Implementar endpoint `GET /reportes/repartidores` y schemas en OpenAPI              |       1       |     —     |   ✅   |
| T-14.05 | Desarrollo | Desarrollar pestaña Ranking en `ReportesPage.tsx` con podio y tabla comparativa     |       3       |     —     |   ✅   |
| T-14.06 | Prueba     | Tests unitarios de ordenamiento y cálculo con datasets sintéticos                   |       2       |     —     |   ✅   |
|         |            | **Subtotal HU-14**                                                                  |    **12**     | A consolidar | ✅ |

### HU-15 — Clasificación de incidencias por motivo

| #       | Fase       | Tarea                                                                               | Estimado (hs) | Real (hs) | Estado |
| ------- | ---------- | ----------------------------------------------------------------------------------- | :-----------: | :-------: | :----: |
| T-15.01 | Análisis  | Definir estructura de distribución con garantía de 5 motivos (Pareto)               |       1       |     —     |   ✅   |
| T-15.02 | Desarrollo | Implementar `ReportesRepo.IncidenciasPorMotivo` con agregación por motivo           |       2       |     —     |   ✅   |
| T-15.03 | Desarrollo | Implementar lógica en `ReportesService` para rellenar motivos en cero y porcentajes |       2       |     —     |   ✅   |
| T-15.04 | Desarrollo | Implementar endpoint `GET /reportes/incidencias` en handler                         |       1       |     —     |   ✅   |
| T-15.05 | Desarrollo | Desarrollar pestaña Incidencias en `ReportesPage.tsx` con barras de Pareto CSS      |       3       |     —     |   ✅   |
| T-15.06 | Prueba     | Tests unitarios de distribución y verificación visual de barras                     |       1       |     —     |   ✅   |
|         |            | **Subtotal HU-15**                                                                  |    **10**     | A consolidar | ✅ |

### Tareas transversales

| #       | Tarea                                                                               | Responsable | Est. (hs) | Real (hs) | Estado |
| ------- | ----------------------------------------------------------------------------------- | ----------- | :-------: | :-------: | :----: |
| T-00.01 | Aplicación y verificación de migración 0006 en base de datos Supabase               | Araya       |     2     |     —     |   ✅   |
| T-00.02 | Documentación exhaustiva en OpenAPI (5 endpoints, 15 schemas nuevos, lint limpio)   | Araya       |     2     |     —     |   ✅   |
| T-00.03 | Implementación de E2E integral `TestFlujoCompleto_AnaliticaYMapa` en Go            | Equipo      |     3     |     —     |   ✅   |
| T-00.04 | Ajuste de husos horarios en UTC y normalización de imports de testenv               | Araya       |     1     |     —     |   ✅   |
| T-00.05 | Redacción de informes formales del Sprint 3 y consolidación de métricas de calidad | Equipo      |     2     |     —     |   ✅   |
|         | **Subtotal Transversales**                                                          |             |    **10** | A consolidar | ✅ |

### Resumen de horas estimadas

| Historia / Grupo                        | Horas Estimadas | Horas Reales | Estado |
| --------------------------------------- | :-------------: | :----------: | :----: |
| HU-11 — Panel en tiempo real            |       16        | A consolidar |   ✅   |
| HU-12 — Mapa de rutas                   |       20        | A consolidar |   ✅   |
| HU-13 — Reportes y CSV                  |       14        | A consolidar |   ✅   |
| HU-14 — Ranking de repartidores         |       12        | A consolidar |   ✅   |
| HU-15 — Analítica de incidencias        |       10        | A consolidar |   ✅   |
| Tareas transversales                    |       10        | A consolidar |   ✅   |
| **Total Sprint 3**                      |    **82**       | A consolidar |   ✅   |

---

## 6. Modelo de Datos — Migración 0006

La migración `0006_sprint3_analitica_y_mapas.up.sql` incorpora el soporte geoespacial y optimizaciones para consultas sobre auditoría:

```sql
-- Coordenadas de paradas en destinatarios
ALTER TABLE destinatarios 
  ADD COLUMN IF NOT EXISTS latitud NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitud NUMERIC(10, 7);

-- Índices de alto rendimiento para analítica temporal
CREATE INDEX IF NOT EXISTS idx_eventos_envio_estado_fecha 
  ON eventos_envio (estado_nuevo, created_at);

CREATE INDEX IF NOT EXISTS idx_eventos_envio_motivo 
  ON eventos_envio (motivo) 
  WHERE motivo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eventos_envio_actor_fecha 
  ON eventos_envio (actor_id, created_at) 
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_envios_created_at 
  ON envios (created_at);
```

---

## 7. Criterios de Calidad y Definition of Done (DoD)

1. **Revisión por pares:** En proceso. Código listo localmente; pendiente PR formal y revisión cruzada por el equipo.
2. **Estilo y formato:** Cumplido. `gofmt`, ESLint y Prettier 100% limpios sin advertencias bloqueantes.
3. **Pruebas manuales:** Verificado en pruebas de integración y componentes; pendiente prueba en dispositivo físico con Expo Go.
4. **Pruebas unitarias de negocio:** Cumplido. Cobertura de cálculos de efectividad, tiempos y validaciones con 314 tests en verde.
5. **Integración continua:** En proceso. Suites locales en verde; pendiente push y validación en GitHub Actions.
6. **Contrato OpenAPI:** Cumplido. Actualizado con los 5 paths nuevos y 15 schemas validados con Redocly (0 errores).
7. **Demostración de sprint:** En proceso. Pendiente — se demuestra en la presentación del Sprint 3 ante el equipo y la cátedra.
8. **Sin bugs críticos:** Cumplido. 0 fallos de severidad alta.
9. **Pruebas de backend en serie:** Cumplido. `go test ./... -p 1` pasando en serie sin interferencias de concurrencia.
10. **Test de caso vacío:** Cumplido. Listas de reportes vacías retornan arreglos `[]` y descargas CSV sin filas de datos.
11. **Repaso de CAs:** Cumplido. Contrastados uno a uno en Web y Mobile.
12. **Suites completas en verde:** Cumplido. 314 tests automatizados verificados al cierre del sprint.

---

## 8. Burndown Chart

| Fecha             | SP Restantes (Ideal) | SP Restantes (Real) | Observaciones                                                                 |
| ----------------- | :------------------: | :-----------------: | ----------------------------------------------------------------------------- |
| 24/09 (inicio)    |          19          |         19          | Inicio del Sprint 3 · Backlog presentado y migración 0006 aplicada.           |
| 29/09 (día 5)     |          14          |         14          | Cierre completo de HU-11 (5 SP quemados: Dashboard operativo en vivo).        |
| 05/10 (día 11)    |           9          |          9          | Cierre completo de HU-12 (5 SP quemados: mapas en Web y Mobile).              |
| 12/10 (día 18)    |           6          |          6          | Cierre de HU-13 (3 SP quemados: Reportes de envíos y exportación a CSV).      |
| 18/10 (día 24)    |           3          |          3          | Cierre de HU-14 (3 SP quemados: Ranking y KPIs de repartidores).              |
| 22/10 (cierre)    |           0          |          0          | Cierre de HU-15 (3 SP quemados: Pareto de incidencias) y suite completa 100%. |

---

## 9. Retrospectiva del Sprint 3

### Sprint Backlog Teórico vs. Real

| Historia / Tarea                                       | Est. (hs) | Real (hs)     | Observaciones |
| ------------------------------------------------------ | :-------: | :-----------: | ------------- |
| HU-11 — Panel en tiempo real (T-11.01 a T-11.07)       |    16     | A consolidar  | Polling reactivo con `@tanstack/react-query` facilitó la integración. |
| HU-12 — Mapa de rutas (T-12.01 a T-12.08)              |    20     | A consolidar  | Leaflet en Web y `react-native-maps` en Mobile integrados sin fricción. |
| HU-13 — Reportes y CSV (T-13.01 a T-13.06)             |    14     | A consolidar  | Streaming con UTF-8 BOM resolvió compatibilidad con Microsoft Excel. |
| HU-14 — Ranking de repartidores (T-14.01 a T-14.06)    |    12     | A consolidar  | Cálculo sobre `eventos_envio` garantiza trazabilidad de fallos. |
| HU-15 — Analítica de incidencias (T-15.01 a T-15.06)   |    10     | A consolidar  | Barras de Pareto implementadas en CSS sin dependencias pesadas. |
| Transversales (T-00.01 a T-00.05)                      |    10     | A consolidar  | Migración 0006 e índices optimizaron los tiempos de consulta. |
| **Total Sprint 3**                                     |  **82**   | A consolidar  | **Alcance funcional 100% implementado.** |

### Preguntas de retrospectiva

- **¿Qué salió bien?**
  - La arquitectura limpia en Go permitió incorporar 5 endpoints analíticos complejos reutilizando la conexión a PostgreSQL con queries agregadas de alto rendimiento.
  - La visualización en mapa (HU-12) enriqueció drásticamente la experiencia de usuario tanto en el panel operativo web como en la app de los repartidores.
  - El volumen de pruebas automáticas alcanzó los **314 tests pasando al 100%** (186 en Go, 71 en Web, 57 en Mobile).
  - La generación de CSV en streaming con BOM garantiza apertura sin problemas de tildes o caracteres especiales en Excel.

- **¿Qué podemos mejorar?**
  - Implementar geocodificación automática integrada (ej. Nominatim/OpenStreetMap) en el alta de envíos (HU-02) para que los nuevos destinatarios obtengan coordenadas sin depender de ingresos manuales.
  - Aplicar code-splitting (`React.lazy`) en la Web para aislar el peso de Leaflet y optimizar el bundle principal.

- **Plan de acción para mantenimiento y entrega final:**
  1. Configurar lazy-loading de `RutaMapaPage` en la aplicación web para reducir el bundle inicial por debajo de los 500 kB.
  2. Evaluar un servicio de geocodificación con caché local en Go para coordenadas automáticas.
  3. Consolidar el tag de versión final del Trabajo Integrador (`v1.0.0-final`).

---

*Documento del Sprint Backlog 3 — Proyecto Movii — UTN FRSF — Ingeniería y Calidad del Software — 2026.*
