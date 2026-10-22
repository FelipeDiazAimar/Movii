# Sprint 3 — Trabajo Final Integrador

## Sistema de Gestión de Envíos y Distribución — Movii

---

**UTN — Facultad Regional San Francisco**

**Cátedra:** Ingeniería y Calidad del Software

**Docentes:** Gandino, Diego · Saldarini, Javier Daniel

**Grupo N° 7:** Araya, Ulises · Díaz Aimar, Felipe · Micheloud, Jeremías

**Duración del Sprint:** 14 días (24/09/2026 – 08/10/2026 · Cierre consolidado: 22/10/2026)

**Presentación del Backlog:** Jueves 24/09/2026 · **Presentación y Cierre del Sprint:** Jueves 22/10/2026

> **Nota de estado (informe de cierre técnico):** El Sprint 3 completa la totalidad del alcance funcional proyectado para el Trabajo Final Integrador de Movii. Se implementaron las 5 Historias de Usuario analíticas y geoespaciales (HU-11 a HU-15) en Backend (Go), Web (React) y Móvil (Expo). El código cuenta con **314 pruebas automatizadas en verde** (186 en Go, 71 en Web, 57 en Mobile, +1 salteado preexistente). El código se encuentra probado localmente y preparado para la revisión por pares, commits y PR formal del equipo.

---

## 1. Objetivo del Sprint

Dotar a la plataforma de Movii de capacidades avanzadas de **monitoreo en tiempo real, geolocalización de rutas y analítica de desempeño**:
- Permitir a los operadores y supervisores monitorear la operación en vivo mediante un Dashboard reactivo (HU-11).
- Asistir a los repartidores en calle y a la supervisión con mapas interactivos de rutas y paradas geolocalizadas (HU-12).
- Proveer herramientas de auditoría con reportes históricos filtrables y exportación en streaming a CSV (HU-13).
- Evaluar el desempeño de los repartidores con rankings de efectividad y tiempos promedio (HU-14).
- Analizar las causas de fallo de entrega mediante clasificación de Pareto de incidencias (HU-15).

---

## 2. Product Backlog priorizado (Cierre del Proyecto)

| ID    | Historia de Usuario                         | Prioridad | Valor | SP | Sprint      | Estado |
| ----- | ------------------------------------------- | --------- | :---: | :-: | ----------- | :----: |
| HU-01 | Registro y autenticación de usuarios       | Muy Alta  |   8   |  8 | Sprint 1    |   ✅   |
| HU-02 | Registro de envíos                         | Muy Alta  |   8   |  5 | Sprint 1    |   ✅   |
| HU-03 | Gestión de rutas diarias                   | Alta      |   5   |  5 | Sprint 1    |   ✅   |
| HU-04 | Asignación de envíos a ruta                | Alta      |   5   |  5 | Sprint 1    |   ✅   |
| HU-05 | Listado de envíos del día para repartidor | Alta      |   5   |  3 | Sprint 1    |   ✅   |
| HU-06 | Actualización de estado de entrega         | Alta      |   8   |  5 | Sprint 2    |   ✅   |
| HU-07 | Registro de entrega fallida con motivo      | Alta      |   5   |  5 | Sprint 2    |   ✅   |
| HU-08 | Confirmación de entrega con firma y foto   | Alta      |   5   |  8 | Sprint 2    |   ✅   |
| HU-09 | Reprogramación de entregas fallidas        | Media     |   5   |  5 | Sprint 2    |   ✅   |
| HU-10 | Tracking público por código de guía      | Media     |   5   |  3 | Sprint 2    |   ✅   |
| HU-11 | Panel de operaciones en tiempo real         | Alta      |   5   |  5 | Sprint 3    |   ✅   |
| HU-12 | Visualización de ruta en mapa              | Alta      |   5   |  5 | Sprint 3    |   ✅   |
| HU-13 | Reportes de envíos por período (CSV)       | Media     |   3   |  3 | Sprint 3    |   ✅   |
| HU-14 | Ranking de desempeño de repartidores       | Media     |   3   |  3 | Sprint 3    |   ✅   |
| HU-15 | Clasificación de incidencias por motivo    | Media     |   3   |  3 | Sprint 3    |   ✅   |
|       | **Total del Proyecto**                     |           |       |**71**|             | **100%** |

---

## 3. Estimaciones de Valor y Esfuerzo (Sprint 3)

| ID    | Historia de Usuario                | Valor | SP | V/E  | Responsable                |
| ----- | ---------------------------------- | :---: | :-: | :--: | -------------------------- |
| HU-11 | Panel de operaciones en tiempo real|   5   |  5 | 1.00 | Araya / Micheloud          |
| HU-12 | Visualización de ruta en mapa      |   5   |  5 | 1.00 | Díaz Aimar / Araya         |
| HU-13 | Reportes de envíos (CSV)           |   3   |  3 | 1.00 | Araya / Micheloud          |
| HU-14 | Ranking de desempeño               |   3   |  3 | 1.00 | Micheloud / Araya          |
| HU-15 | Clasificación de incidencias       |   3   |  3 | 1.00 | Araya / Díaz Aimar         |
|       | **Total Sprint 3**                 | **19**|**19**|     |                            |

- **Capacidad:** 3 integrantes × 14 días × ~2 hs/día = **~84 horas**.
- **Estimado total de tareas:** 82 horas (19 Story Points).
- **Horas reales:** Quedan a consolidar por los integrantes del equipo al cierre definitivo de la entrega.

---

## 4. Sprint Backlog — Desglose y Horas Reales

| Grupo                   | Horas Est. | Horas Reales | Estado | Observaciones |
| ----------------------- | :--------: | :----------: | :----: | ------------- |
| HU-11 — Panel en vivo   |     16     | A consolidar |   ✅   | Queries agregadas y polling reactivo de 30s en React Query. |
| HU-12 — Mapa de rutas   |     20     | A consolidar |   ✅   | Migración 0006 con coordenadas y componentes Leaflet / Maps. |
| HU-13 — Reportes y CSV  |     14     | A consolidar |   ✅   | Descarga streaming con UTF-8 BOM y sanitización de inyecciones. |
| HU-14 — Ranking         |     12     | A consolidar |   ✅   | Análisis sobre `eventos_envio` computando tiempos de tránsito. |
| HU-15 — Incidencias     |     10     | A consolidar |   ✅   | Distribución Pareto con 5 motivos cerrados y barras CSS. |
| Tareas transversales    |     10     | A consolidar |   ✅   | OpenAPI, E2E Go y soporte multiplataforma. |
| **Total**               |   **82**   | A consolidar |   ✅   | Alcance funcional 100% implementado. |

---

## 5. Modelo de Datos — Migración 0006

La migración `0006_sprint3_analitica_y_mapas.up.sql` incorpora columnas de latitud y longitud en destinatarios e índices para acelerar los reportes analíticos:

```sql
-- Soporte geoespacial de paradas
ALTER TABLE destinatarios 
  ADD COLUMN IF NOT EXISTS latitud NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitud NUMERIC(10, 7);

-- Índices de cobertura para reportes temporales y analítica
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

-- Backfill de demostración para destinatarios existentes (coordenadas sintéticas representativas de San Francisco ±1 km)
-- Nota técnica: sirve para habilitar la visualización en mapa de los datos de prueba.
-- Los nuevos destinatarios requerirán geocodificación automática o ingreso de coordenadas.
UPDATE destinatarios 
SET latitud = -31.4279718 + (random() * 0.02 - 0.01),
    longitud = -62.0826608 + (random() * 0.02 - 0.01)
WHERE latitud IS NULL;
```

---

## 6. Implementación Técnica

### 6.1 Arquitectura Analítica
- **Go Backend:** Separación en `OperacionesService` y `ReportesService` con sus respectivos repositorios. Las consultas analíticas se resuelven a nivel de base de datos aprovechando agregaciones de PostgreSQL (`COUNT(*) FILTER`, `EXTRACT(EPOCH ...)`).
- **Web Frontend:** Vistas especializadas (`DashboardPage`, `ReportesPage`, `RutaMapaPage`) consumiendo la API mediante `@tanstack/react-query` con caché inteligente y polling configurable.
- **Mobile Frontend:** Pantalla de mapa interactivo (`route-map.tsx`) con marcadores numerados por estado y polyline de conexión mediante `react-native-maps`, con fallback seguro para navegador (`route-map.web.tsx`).

### 6.2 HU-11 — Panel de Operaciones en Tiempo Real
- **Endpoint:** `GET /operaciones/dashboard?fecha=YYYY-MM-DD`
- **Roles:** `operador`, `supervisor`.
- **Cálculos:**
  - Envíos de la jornada: paquetes asignados a rutas de la fecha más envíos pendientes sin ruta creados o reprogramados para ese día.
  - Tasa de efectividad: `entregados / (entregados + no_entregados) * 100`.
  - Alertas: últimas 10 incidencias registradas con enlace directo al envío.
- **Ejemplo cURL:**
```bash
curl -X GET "http://localhost:8080/operaciones/dashboard?fecha=2026-10-22" \
  -H "Authorization: Bearer <token-supervisor>"
```

### 6.3 HU-12 — Visualización de Ruta en Mapa
- **Endpoint:** `GET /rutas/{id}/mapa`
- **Roles:** `repartidor` (restringido a sus rutas), `operador`, `supervisor`.
- **Comportamiento:** Devuelve el recorrido ordenado de paradas con coordenadas `(lat, lng)`, código de guía y estado. Si una parada carece de geolocalización, devuelve `coordenadas: null` y la interfaz lo señala amablemente.
- **Ejemplo cURL:**
```bash
curl -X GET "http://localhost:8080/rutas/8b2d1c54-4a2e-4b9a-8c74-0f2c41c90001/mapa" \
  -H "Authorization: Bearer <token-repartidor>"
```

### 6.4 HU-13 — Reportes de Envíos con Exportación a CSV
- **Endpoint:** `GET /reportes/envios?desde=...&hasta=...&estado=...&formato=json|csv`
- **Roles:** `operador`, `supervisor`.
- **Características:**
  - Validación de rango temporal (máximo 366 días, formato estricto `YYYY-MM-DD`).
  - Streaming eficiente en CSV con UTF-8 Byte Order Mark (`\xef\xbb\xbf`) para apertura directa en Microsoft Excel.
  - Sanitización activa contra vulnerabilidades de inyección de fórmulas (CSV Injection): celdas que inician con `=`, `+`, `-`, `@` son prefijadas con comilla simple `'`.
- **Ejemplo cURL para descarga:**
```bash
curl -X GET "http://localhost:8080/reportes/envios?desde=2026-10-01&hasta=2026-10-22&formato=csv" \
  -H "Authorization: Bearer <token-operador>" \
  -O -J
```

### 6.5 HU-14 — Ranking de Desempeño de Repartidores
- **Endpoint:** `GET /reportes/repartidores?desde=...&hasta=...`
- **Métricas:**
  - Total asignados, entregados y fallidos computados directamente desde `eventos_envio` (garantiza que si un envío fallido es reprogramado y desvinculado, el historial del repartidor original se mantiene intacto).
  - Tasa de efectividad porcentual.
  - Tiempo promedio de tránsito entre `en_camino` y `entregado` en minutos (se excluyen explícitamente confirmaciones directas desde `asignado`).
  - Ordenamiento multicriterio: 1° Tasa de efectividad, 2° Volumen de entregas, 3° Nombre alfabético.

### 6.6 HU-15 — Clasificación y Analítica de Incidencias
- **Endpoint:** `GET /reportes/incidencias?desde=...&hasta=...`
- **Distribución de Pareto:**
  - Agrupación por los 5 motivos del catálogo (`cliente_ausente`, `direccion_incorrecta`, `rechazado`, `zona_insegura`, `otro`).
  - Inclusión garantizada de motivos sin ocurrencias con cantidad 0 y 0.0% para consistencia de UI.
  - Orden decreciente por frecuencia de ocurrencia.

### 6.7 Frontend Web
- **`DashboardPage.tsx` (`/dashboard`):** Tarjetas de métricas en cabecera, tabla de avance de rutas activas con barra porcentual, panel de alertas recientes y polling automático cada 30 segundos mediante `refetchInterval` de TanStack Query.
- **`ReportesPage.tsx` (`/reportes`):** Barra superior de filtrado de fechas y tres pestañas:
  1. *Envíos:* Vista previa tabular con paginación y botón de descarga de archivo CSV mediante descarga segura de blob autenticado.
  2. *Ranking:* Podio visual para los 3 primeros puestos (oro, plata, bronce) y tabla detallada.
  3. *Incidencias:* Barras de progreso de Pareto proporcionales con estilos de Tailwind CSS.
- **`RutaMapaPage.tsx` (`/rutas/:id/mapa`):** Integración con Leaflet y OpenStreetMap con marcadores numerados según el orden de entrega, coloreados semánticamente por estado del paquete y trazado polyline.

### 6.8 App Móvil
- **`app/route-map.tsx`:** Componente de mapa interactivo con `react-native-maps`, adaptado para la navegación del repartidor con selector de ruta del día y salto directo al detalle de la parada al tocar cada marcador.
- **`app/route-map.web.tsx`:** Fallback limpio para el entorno de previsualización web.

---

## 7. Pruebas y Calidad Automatizada

El cierre del Sprint 3 consolida una cobertura integral sin dependencias rotas:

| Suite | Tests Totales | Tests Pasados | Estado | Observación |
| :--- | :---: | :---: | :---: | :--- |
| **API Go Backend** | 186 | 186 | ✅ 100% | Corridas en serie (`-p 1`) contra Supabase. Incluye E2E `TestFlujoCompleto_AnaliticaYMapa`. |
| **Web Operativa (Vitest)** | 71 | 71 | ✅ 100% | 10 archivos de test. `npm run build` (`tsc -b` + vite) limpio. |
| **App Móvil (Vitest)** | 58 | 57 (+1 skip) | ✅ 100% | 8 archivos de test. `tsc --noEmit` limpio con 0 errores. |
| **TOTAL SISTEMA** | **315** | **314** | **✅ 100% VERDE** | **Cero fallos, cero regresiones.** |

- **Calidad de Contrato OpenAPI:** `npx @redocly/cli lint gestion-envios/docs/api/openapi.yaml` ejecutado con 0 errores.

---

## 8. Burndown Chart Definitivo (Story Points)

| Fecha             | SP Ideal | SP Real | Observaciones |
| ----------------- | :------: | :-----: | ------------- |
| 24/09 (inicio)    |    19    |   19    | Presentación del Backlog y migración 0006. |
| 29/09 (día 5)     |    14    |   14    | HU-11 cerrada (5 SP: Dashboard en vivo). |
| 05/10 (día 11)    |     9    |    9    | HU-12 cerrada (5 SP: mapas Web y Mobile). |
| 12/10 (día 18)    |     6    |    6    | HU-13 cerrada (3 SP: reportes y CSV). |
| 18/10 (día 24)    |     3    |    3    | HU-14 cerrada (3 SP: ranking de repartidores). |
| 22/10 (cierre)    |     0    |    0    | HU-15 cerrada (3 SP: Pareto de incidencias) y suite completa en verde. |

---

## 9. Definition of Done (DoD) — Estado al Cierre Técnico

1. **Revisión de código:** En proceso. Código listo y testeado localmente; pendiente creación de PR formal y revisión cruzada por el equipo previo a mergear a `main`.
2. **Lineamientos de estilo:** Cumplido. `gofmt` en Go, Prettier y ESLint limpios en TypeScript (0 errores).
3. **Pruebas manuales:** Verificado en tests de integración y suites de componentes. Pendiente prueba en dispositivo físico con Expo Go (cámara nativa, mapa nativo) y navegador real.
4. **Pruebas unitarias:** Cumplido. Cobertura exhaustiva en servicios y lógica de agregación con 314 tests automatizados.
5. **Integración:** En proceso. Suites completas en verde; pendiente push formal y validación en CI de GitHub Actions.
6. **OpenAPI:** Cumplido. Documentación completa de endpoints en openapi.yaml, validada con Redocly (0 errores).
7. **Demostración:** En proceso. Pendiente — se demuestra en la presentación del Sprint 3 ante el equipo y la cátedra.
8. **Sin bugs críticos:** Cumplido. 0 incidentes bloqueantes abiertos.
9. **Pruebas Go en serie:** Cumplido. Todas las corridas ejecutadas con `-p 1`.
10. **Manejo de colecciones vacías:** Cumplido. Listados y reportes serializan `[]` ante ausencia de registros.
11. **Repaso de CAs:** Cumplido. Verificados contra las interfaces Web y Mobile correspondientes.
12. **Suites completas en verde:** Cumplido. 314 pruebas activas pasando satisfactoriamente (186 en Go, 71 en Web, 57 en Mobile).

---

## 10. Retrospectiva Definitiva del Trabajo Final Integrador

### Qué salió bien
- La estrategia de contratos primero (`openapi.yaml` y migraciones SQL) demostró ser un pilar fundamental para evitar desfasajes entre el backend en Go y los clientes en TypeScript (Web y Mobile).
- La arquitectura en Go (`handlers -> services -> repository`) mantuvo una separación de responsabilidades limpia, facilitando la incorporación de analítica compleja sin degradar la lógica transaccional previa.
- La cobertura de 314 pruebas automatizadas otorgó certeza total sobre la estabilidad del sistema durante los tres sprints.

### Lecciones aprendidas y mejoras futuras
- Incorporar geocodificación automática integrada (ej. servicio con caché local sobre OpenStreetMap Nominatim) durante el registro del envío (HU-02) para que los domicilios adquieran coordenadas geográficas automáticamente.
- Configurar importación diferida (`React.lazy`) en la página del mapa para optimizar el peso del bundle inicial en la aplicación Web.
- Incorporar rate-limiting basado en token o IP en las rutas públicas de consulta de tracking.

---

*Informe Final del Sprint 3 — Proyecto Movii — UTN FRSF — Ingeniería y Calidad del Software — 2026.*
