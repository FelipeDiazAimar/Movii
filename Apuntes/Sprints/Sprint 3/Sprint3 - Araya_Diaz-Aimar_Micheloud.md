# Sprint 3 — Trabajo Final Integrador

## Sistema de Gestión de Envíos y Distribución — Movii

**Cátedra:** Ingeniería y Calidad del Software · UTN FRSF · 2026

**Grupo Nro 7:** Araya, Ulises · Díaz Aimar, Felipe · Micheloud, Jeremías

**Docentes:** Gandino, Diego · Saldarini, Javier Daniel

**Sprint:** 01/10/2026 – 07/11/2026

---

## 1. Objetivo del Sprint

Cerrar el producto con la **operación en vivo** (panel, flota y mapa real), los **reportes** para la gerencia, la comunicación por **WhatsApp** y la app del repartidor **instalable**, todo desplegado. El detalle de historias y criterios está en *Sprint_Backlog3*.

---

## 2. Product Backlog — estado final

| ID | Historia | SP | Sprint | Estado |
| --- | --- | :-: | --- | --- |
| HU-01 … HU-05 | Autenticación, envíos, rutas, asignación, envíos del día | 26 | 1 | ✅ |
| HU-06 … HU-10 | Estados, incidencias, firma y foto, reprogramación, tracking | 26 | 2 | ✅ |
| HU-11 | Panel de operaciones en tiempo real | 5 | 3 | ✅ |
| HU-12 | Ruta en mapa (ampliada: calles reales + GPS simulado) | 8 | 3 | ✅ |
| HU-13 | Reportes de envíos por período | 3 | 3 | ✅ |
| HU-14 | Ranking de repartidores | 3 | 3 | ✅ |
| HU-15 | Incidencias por motivo | 3 | 3 | ✅ |
| HU-16 | Login en dos pasos (código por WhatsApp) | 5 | 3 | ✅ |
| HU-17 | Avisos por WhatsApp | 5 | 3 | ✅ |
| HU-18 | Gestión de flota | 5 | 3 | ✅ |
| HU-19 | App instalable (APK + PWA) | 3 | 3 | ✅ |

Los cambios de alcance (HU-12 ampliada, altas de HU-16 a HU-19) y su justificación están en la tabla 2.1 del Sprint Backlog 3. **Actualización 11/11:** las paradas de cada ruta ahora se ordenan solas por el recorrido más corto (antes las definía el operador por orden de alta); repartir los envíos entre vehículos con franjas y capacidad sigue fuera de alcance. Las mejoras posteriores al cierre están en la sección 5.8.

---

## 3. Estimaciones

| | Valor | SP |
| --- | :-: | :-: |
| Planificado al inicio (HU-11 a HU-15) | 12 | 19 |
| Ajuste por ampliación de HU-12 | — | +3 |
| Nuevas (HU-16 a HU-19) | 16 | 18 |
| **Total del sprint** | **28** | **40** |

---

## 4. Arquitectura final

```
            ┌──────────── Vercel ─────────────┐
 Navegador  │  /      Panel web (React+Vite)  │
 Celular ───┤  /app/  PWA del repartidor      │──┐ HTTPS (REST + SSE)
            └─────────────────────────────────┘  │
 APK Android (Expo / React Native) ──────────────┤
                                                 ▼
                          ┌──────── Railway (Docker) ────────┐
                          │ API Go (chi)                     │
                          │  ├ REST /envios /rutas /reportes │
                          │  ├ SSE /operaciones/flota/stream │──► OSRM (recorridos)
                          │  ├ Simulador GPS (goroutine)     │──► Nominatim (geocodificación)
                          │  ├ Notificador (cola)            │──► WhatsApp (whatsmeow) / mail (Gmail SMTP o Resend)
                          │  └ Migraciones al arrancar       │
                          └──────────────┬───────────────────┘
                                         ▼
                              Supabase (PostgreSQL)
```

- **API Go** en capas: `handlers → services → repository`, con `platform/geo` y `platform/whatsapp` detrás de interfaces (`Geocoder`, `Router`, `Sender`) para poder testear sin red y cambiar de proveedor.
- **Tiempo real**: un hub en memoria reparte por **Server-Sent Events** las posiciones del simulador (evento `posicion`) y, desde el 11/11, cada cambio de estado de un envío o de una ruta (evento `cambio`), para que la web recargue al instante. La web usa `EventSource`; la app consulta cada 5 s (React Native no trae `EventSource`).
- **Mapas**: Leaflet + OpenStreetMap en la web y el mismo HTML de Leaflet dentro de un WebView (Android/iOS) o un iframe (PWA). No requiere API key.
- **WhatsApp**: whatsmeow (cuenta de la empresa vinculada por QR, como WhatsApp Web). La sesión se guarda en la base y sobrevive a los redeploys. Se eligió frente a la API oficial de Meta porque esta exige una cuenta Business verificada y plantillas aprobadas, inviables en el plazo del sprint; el diseño con la interfaz `Sender` permite migrar sin tocar los servicios.

---

## 5. Implementación

### 5.1 HU-11 — Centro de operaciones
- `GET /operaciones/dashboard` (métricas, rutas del día con avance, últimas incidencias) y `GET /operaciones/flota[/{id}]`.
- Página **Operaciones** con el camión como protagonista (ilustración con la patente), "Detalle de carga", carrusel de flota, mosaicos (a bordo, entregados, temperatura, velocidad en vivo), indicador de capacidad, tarjeta del chofer con la **ruta como línea de paradas**, lista de paquetes y mapa en vivo.

### 5.2 HU-12 — Mapa con calles reales
- Geocodificación al dar de alta el envío (en segundo plano) y backfill al arrancar. Respeta la política de Nominatim (1 consulta/s, User-Agent propio, caché).
- `GET /rutas/{id}/mapa`: paradas + recorrido depósito → paradas (OSRM) + vehículo. `GET /envios/{id}/trayecto`: camino desde el camión hasta un envío, distancia, tiempo y paradas previas.
- **Simulador GPS**: cada 2 s avanza cada camión con la ruta del día **en curso** por su polilínea OSRM (velocidad configurable con `SIMULADOR_FACTOR`; desde el 11/11 el valor por defecto es 1, tiempo real, para que coincida con la hora estimada), guarda la telemetría y la publica por SSE. Si el repartidor resuelve una parada, recalcula desde donde está. Desde el 11/11 frena en cada domicilio, entrega solo los envíos de demostración, espera en la puerta en los reales y vuelve al depósito al terminar (ver 5.8).
- Web: mapa de ruta, mapa en el centro de operaciones y tarjeta de seguimiento en cada envío. App: mapa de ruta y mini mapa en cada parada.

### 5.3 HU-13/14/15 — Reportes
- Reportes en JSON y CSV (en streaming, con protección contra inyección de fórmulas), ranking con efectividad y tiempo promedio de entrega, Pareto de incidencias. Página **Reportes** con pestañas.

### 5.4 HU-16/17 — WhatsApp
- **Login en dos pasos**: `POST /auth/login` valida la contraseña y, si el usuario tiene celular, en vez del token devuelve un desafío y manda por WhatsApp un código de 6 dígitos; `POST /auth/login/verificar` lo canjea por el JWT y `/auth/login/reenviar` manda otro. Código con hash HMAC (salado con el id del desafío), 5 min, 5 intentos, un solo uso, 3 códigos cada 15 min. Sin celular o con WhatsApp desvinculado se entra solo con la contraseña.
- Avisos al destinatario (en camino, entregado, no entregado con motivo, reprogramado) con link de seguimiento, y al repartidor al asignarle envíos. Cola asíncrona, registro y clave de idempotencia.
- Página **WhatsApp** (QR para vincular), columna **Celular** en usuarios, pantalla "Verificá que sos vos" en el login web y de la app, y tarjeta de avisos en el envío.

### 5.5 HU-18 — Flota
- Vehículos con capacidad y estado; asignación a la ruta del día (uno por día, no en mantenimiento); carga y ocupación calculadas de los envíos de esa ruta.

### 5.6 HU-19 — App instalable y firma
- **Firma**: el SVG del pad no tenía tamaño explícito y en la web quedaba en 300×150, por eso solo la mitad del recuadro dibujaba. Ahora se mide el pad, el gesto no lo roba el scroll y en la PWA el PNG se genera con un canvas (antes no se podía exportar).
- **PWA**: manifest, íconos, service worker, `viewport-fit=cover`, barra de estado `black-translucent` y colores de fondo/tema iguales a la app para que no se vean bordes del navegador; safe areas reales en header, pestañas y pantallas.
- **APK**: perfil `preview` de EAS Build.

### 5.7 Correcciones al reintegrar
- El segundo intento del sprint devolvía 500 en lugar de 404, fallaba con campos NULL, inventaba coordenadas a partir del orden de la parada y usaba Leaflet sin declararlo. Se reemplazó por la implementación descrita.
- "Hoy" se calculaba en UTC: después de las 21 h una ruta del día figuraba como vencida al asignarle envíos. Ahora se usa el día argentino.

### 5.8 Mejoras posteriores al cierre (10/11 y 11/11)
Detalle y justificación en la tabla 2.1 y las tareas T8 a T17 del Sprint Backlog 3. No suman SP.
- **Prueba manual completa de la web** (10/11): 37 hallazgos con capturas (`docs/superpowers/plans/2026-11-10-web-prueba-manual-*.md`); se corrigieron los graves (credenciales precargadas en el login, salida desde "acceso denegado", página 404, tablas que desbordaban en el celular).
- **Iniciar ruta** (HU-06): `POST /rutas/{id}/iniciar` pasa todos los envíos asignados a "en camino". Reemplaza "Marcar en camino" envío por envío en la web y en la app. Una ruta iniciada no admite envíos nuevos (409 `ruta_iniciada`). El estado de la ruta se deriva de sus envíos (migraciones 0014 y 0017).
- **Recorrido más corto** (HU-12): `OrdenadorRutas` calcula el orden de visita que minimiza la distancia por calles (exacto con Held-Karp hasta 11 paradas; vecino más cercano y 2-opt con más). Se recalcula al asignar y al iniciar la ruta (migración 0018).
- **Simulación de un día de trabajo** (HU-11/HU-12): el simulador entrega los envíos de demostración (con firma y foto o incidencia) y vuelve al depósito. El admin tiene un botón ▶ (`POST /admin/demo/reiniciar`) que deja el estado inicial del día: historial de 30 días, operación de hoy, pendientes y rutas de mañana, sin tocar usuarios ni datos reales. Para la presentación, la ruta del camión naranja (TRK-318) queda en el depósito, se inicia desde la app y ese camión espera la entrega manual en cada puerta.
- **Avisos** (HU-17): textos formales sin emojis y respaldo por mail (Gmail por SMTP o Resend) cuando WhatsApp no está vinculado o falla (migración 0016).
- **Interfaz**: seguimiento en vivo integrado (mapa 2D con el camión animado y la ruta en el color del vehículo, paradas en orden con la que está "Yendo ahora", caja del camión), Rutas y Vehículos rediseñadas, máscaras y límites en todos los formularios, panel lateral que se expande al pasar el cursor.
- **Equipo** (11/11): rutas y repartidores sugeridos al asignar, vehículos camioneta y auto (migración 0015), "Mis pedidos" en la app y ficha completa del envío.

---

## 6. Pruebas

| Suite | Cantidad | Resultado |
| --- | :-: | --- |
| Go (unitarias + integración contra PostgreSQL) | 297 funciones de test | ✅ en verde (`go test ./... -p 1`, 11/11) |
| Web (Vitest + Testing Library) | 210 tests | ✅ |
| Mobile (Vitest) | 65 tests (+1 salteado) | ✅ |

Cifras de la corrida del 11/11/2026, con las mejoras posteriores al cierre (al 07/11 eran 215, 71 y 51). Cobertura de la API (`-coverpkg=./...`): 66,3 % de las sentencias, 70,5 % sin contar los ejecutables `cmd/*` (el 10/11 era 71,4 %); la baja viene de los handlers nuevos sin test propio (iniciar ruta, demo, pedidos y sugerencias).

Detalle de casos y trazabilidad en *Plan_de_Pruebas_Sprint3*. La verificación manual se hizo en el sistema corriendo: centro de operaciones con camiones en movimiento, trayecto por calles al tocar un paquete, mapa en la PWA y firma de lado a lado del recuadro.

> Los tests de integración de distintos paquetes comparten la base: deben correr con `-p 1` (así está configurado el CI).

---

## 7. Cronograma y burndown

| Fecha | Hito |
| --- | --- |
| 01/10 | Presentación del Sprint Backlog |
| 22/10 | Primera implementación de HU-11 a HU-15 (rama `Sprint3`) |
| 04/11 | Mejoras de la base en `main`; se revierte el trabajo del 22/10 de `main` |
| 07/11 | Reintegración, ampliación de alcance (HU-12, HU-16 a HU-19), deploy y documentación |
| 10/11 | Prueba manual completa de la web y correcciones |
| 11/11 | Mejoras posteriores al cierre (iniciar ruta, recorrido más corto, simulación de un día, avisos por mail) e integración con las mejoras del equipo |

> Completar con las horas registradas por el equipo para graficar el burndown real (SP y horas). En SP: 19 planificados el 01/10, 40 al cierre por la ampliación; todos quemados al 07/11.

---

## 8. Definition of Done

Ver sección 7 del Sprint Backlog 3. Pendiente para dar por cerrada HU-19: la prueba en un Android y un iPhone físicos (T-19.05).

---

## 9. Retrospectiva

### Horas estimadas vs. reales
> Completar por integrante con las horas reales registradas (no se cargan estimaciones como reales).

| Integrante | Estimadas | Reales |
| --- | :-: | :-: |
| Araya, Ulises | | |
| Díaz Aimar, Felipe | | |
| Micheloud, Jeremías | | |

### Qué salió bien
- La arquitectura por capas del Sprint 1 permitió agregar flota, mapas y WhatsApp sin tocar lo existente: los servicios nuevos se enganchan con setters opcionales (`ConAvisos`, `ConMapa`, `ConGeocodificacion`) y los tests anteriores siguieron pasando.
- Abstraer los servicios externos detrás de interfaces permitió testear geocodificación, recorridos, simulador y WhatsApp sin red.

### Qué salió mal
- Dos implementaciones paralelas del mismo sprint sobre bases distintas: una terminó revertida y la otra quedó sin conectar. Costó una comparación y una reintegración.
- La documentación del sprint marcó historias como terminadas antes de que el código estuviera en `main`.
- El cálculo de fechas en UTC escondía un bug que solo aparecía de noche.

### Acciones
1. Una sola rama por sprint, integrada a `main` con PR y revisión de pares al cerrar cada historia.
2. El estado "Terminada" en los documentos solo se marca con el código en `main` y el CI en verde.
3. Toda fecha "de negocio" (rutas, día operativo) en hora argentina; UTC solo para auditoría.
