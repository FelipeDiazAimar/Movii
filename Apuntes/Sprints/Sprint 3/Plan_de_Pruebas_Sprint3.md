# Plan de Pruebas de Software — Sprint 3

## Sistema de Gestión de Envíos y Distribución — Movii

**UTN — Facultad Regional San Francisco** · Ingeniería y Calidad del Software · 2026
**Docentes:** Gandino, Diego · Saldarini, Javier Daniel
**Grupo N° 7:** Araya, Ulises · Díaz Aimar, Felipe · Micheloud, Jeremías
**Versión:** 2.1 · **Fecha:** 11/11/2026

### Control de versiones

| Versión | Fecha | Descripción |
| :-: | :-: | --- |
| 1.0 | 06/11/2026 | Plan inicial con CP-01 a CP-25 sobre la implementación de la rama `Sprint3`. |
| 2.0 | 07/11/2026 | Reescrito sobre la implementación integrada en `main`: cada caso remite a un test automatizado existente o a una verificación manual en el sistema corriendo. Se agregan HU-16 a HU-19. |
| 2.1 | 11/11/2026 | Se agregan CP-42 a CP-53 para las mejoras posteriores al cierre (iniciar ruta, estado de ruta derivado, recorrido más corto, simulador con entregas, avisos por mail, estado inicial de demostración) y la prueba manual completa de la web del 10/11. Se actualizan las cifras. |

---

## 1. Objetivo

Verificar que las historias del Sprint 3 (HU-11 a HU-19) cumplen sus criterios de aceptación y que no se rompió lo construido en los Sprints 1 y 2 (regresión). Formato basado en IEEE 829 / ISTQB, según la Unidad 5.

## 2. Alcance

**Dentro:** API (servicios, repositorios, handlers, flujos E2E contra PostgreSQL), panel web, app del repartidor (PWA y lógica compartida), integración con servicios externos mediante dobles de prueba.

**Fuera:** disponibilidad de los servicios públicos de OpenStreetMap (Nominatim/OSRM) y de WhatsApp (se prueban con servidores falsos y `Sender` falso; la prueba real es manual), rendimiento y carga, pruebas en tiendas de aplicaciones.

## 3. Estrategia

| Nivel | Herramienta | Qué cubre |
| --- | --- | --- |
| Unitario | `go test`, Vitest | Reglas de negocio puras: OTP, teléfonos, simulador, geometría, mensajes, validaciones de período. |
| Integración de componentes | `httptest` + servidores falsos | Clientes Nominatim/OSRM, handlers. |
| Integración / E2E de API | `go test ./tests` contra PostgreSQL | Flujos completos con router real: analítica y mapa, flota y trayecto, regresión de Sprints 1–2. |
| Componentes UI | Vitest + Testing Library | Páginas de reportes y mapa de ruta con API simulada. |
| Sistema (manual) | Navegador / teléfono | Centro de operaciones en vivo, mapa en la PWA, firma, WhatsApp real, instalación APK/PWA. |

Técnicas: particiones de equivalencia y valores límite (vencimiento a 5 min ± 1 s, 5 intentos, 3 pedidos/15 min, período de 366 días), tablas de decisión (estado del envío × aviso), pruebas basadas en estados (vehículo activo / mantenimiento / ocupado).

## 4. Criterios

- **Entrada:** historia con criterios de aceptación, código compilando, migraciones aplicadas en la base de prueba.
- **Suspensión:** base de prueba no disponible (los E2E se saltean con `t.Skip`) o CI rojo por motivos ajenos.
- **Salida:** 100 % de los casos automatizados en verde; casos manuales críticos ejecutados; sin defectos abiertos de severidad alta.

## 5. Ambientes

- Base de datos: PostgreSQL 17 (CI, contenedor efímero) y Supabase (desarrollo).
- Navegadores: Chrome (escritorio y emulación de celular). Dispositivos: Android con APK, iPhone con PWA.
- CI: GitHub Actions (`api-ci`, `web-ci`, `mobile-ci`).

## 6. Matriz de casos de prueba

Prioridad: A = alta, M = media, B = baja. Tipo: Auto = automatizado, Man = manual.

| ID | HU | Caso | Tipo | Evidencia (test) | Resultado |
| --- | --- | --- | :-: | --- | :-: |
| CP-01 | 11 | El panel devuelve métricas, rutas con avance e incidencias del día; fecha inválida → 400 | Auto | `tests/analitica_flow_test.go` | ✅ |
| CP-02 | 11 | "Hoy" del panel es el día argentino aunque en UTC ya sea mañana | Auto | `TestFechaODefault` | ✅ |
| CP-03 | 11 | Un repartidor no accede al panel (403) | Auto | `tests/analitica_flow_test.go` | ✅ |
| CP-04 | 11 | El centro de operaciones muestra KPIs, camión, carga, chofer y línea de paradas con datos reales | Man | Sistema corriendo (demo del 07/11) | ✅ |
| CP-05 | 11 | Los camiones se mueven en el mapa sin recargar (SSE) y el indicador dice "En vivo" | Man | Sistema corriendo | ✅ |
| CP-06 | 11 | El stream SSE exige token (401 sin token) | Man | `curl` al endpoint | ✅ |
| CP-07 | 12 | Distancia (haversine), rumbo e interpolación sobre la polilínea | Auto | `geo_test.go`: `TestDistanciaM_*`, `TestRumbo_*`, `TestInterpolar_*` | ✅ |
| CP-08 | 12 | Cliente Nominatim: User-Agent propio, filtro por país y CP, caché | Auto | `TestNominatim_ParseaYCachea`, `TestNominatim_SinResultados` | ✅ |
| CP-09 | 12 | Cliente OSRM: parseo de la geometría; si falla, línea recta | Auto | `TestOSRM_ParseaGeoJSON`, `TestConRespaldo_UsaLineaRectaSiFalla` | ✅ |
| CP-10 | 12 | Geocodificación: dirección exacta → calle sin altura → localidad (aproximada); expande "Bv.", "Av." | Auto | `geo_service_test.go` | ✅ |
| CP-11 | 12 | Simulador: avanza velocidad × tiempo, rumbo correcto, se detiene en la última parada y no reescribe la base detenido | Auto | `TestSimulador_AvanzaHastaLaUltimaParadaYSeDetiene` | ✅ |
| CP-12 | 12 | Simulador: recalcula al resolverse una parada y olvida rutas terminadas | Auto | `TestSimulador_RecalculaCuandoCambianLasParadas` | ✅ |
| CP-13 | 12 | Hub: quien se conecta tarde recibe la última posición; desuscribirse es idempotente | Auto | `TestFlotaHub_UltimaPosicionParaQuienLlegaTarde` | ✅ |
| CP-14 | 12 | Mapa de ruta con paradas, recorrido y vehículo; repartidor ajeno → 404 | Auto | `tests/flota_flow_test.go`, `tests/analitica_flow_test.go` | ✅ |
| CP-15 | 12 | Trayecto del envío: vehículo, destino y recorrido | Auto | `tests/flota_flow_test.go` | ✅ |
| CP-16 | 12 | Página de mapa de ruta: lista paradas, marca las que no tienen ubicación y no dibuja el mapa sin coordenadas | Auto | `RutaMapaPage.test.tsx` | ✅ |
| CP-17 | 12 | Al tocar un paquete se dibuja el camino por calles desde el camión con distancia y tiempo | Man | Sistema corriendo | ✅ |
| CP-18 | 12 | Mapa real en la PWA del repartidor (iframe Leaflet) con recorrido y camión | Man | Navegador | ✅ |
| CP-19 | 13 | Período obligatorio, desde ≤ hasta, máximo 366 días; estado válido | Auto | `reportes_service_test.go` | ✅ |
| CP-20 | 13 | CSV con encabezado, filtros y celdas peligrosas escapadas | Auto | `reportes_service_test.go`, `tests/analitica_flow_test.go` | ✅ |
| CP-21 | 13–15 | Página de reportes: pestañas, ranking, Pareto, error de validación | Auto | `ReportesPage.test.tsx` | ✅ |
| CP-22 | 14 | Ranking por efectividad y tiempo promedio de entrega | Auto | `reportes_service_test.go`, `tests/analitica_flow_test.go` | ✅ |
| CP-23 | 15 | Pareto con los 5 motivos siempre presentes y porcentajes | Auto | `reportes_service_test.go` | ✅ |
| CP-24 | 16 | Login en dos pasos: contraseña → desafío sin token; el código llega por WhatsApp; con el código se entra y el token sirve para la API | Auto | `tests/login_dos_pasos_flow_test.go`, `TestOTP_FlujoCompleto` | ✅ |
| CP-25 | 16 | 5 intentos fallidos invalidan el código; vencido (5 min + 1 s) rechazado; no se reutiliza; solo vale para su desafío | Auto | `TestOTP_CodigoIncorrectoYLimiteDeIntentos`, `TestOTP_Vencido`, `TestOTP_ElCodigoSoloSirveParaSuDesafio` | ✅ |
| CP-26 | 16 | Reenviar invalida el código anterior; máximo 3 códigos cada 15 min | Auto | `TestOTP_ReenviarInvalidaElAnteriorYRespetaElLimite` | ✅ |
| CP-27 | 16 | Contraseña incorrecta no envía código; usuario sin celular entra en un paso | Auto | `tests/login_dos_pasos_flow_test.go`, `TestOTP_Requiere` | ✅ |
| CP-28 | 16 | WhatsApp desvinculado → se entra solo con contraseña (nadie queda afuera); pantalla del código en web | Auto | `TestOTP_Requiere`, `LoginPage.test.tsx` | ✅ |
| CP-29 | 16 | Normalización de teléfonos (0, 15, +54, sin área) y rechazo de inválidos | Auto | `TestNormalizarTelefonoAR*` | ✅ |
| CP-30 | 16 | Cargar celular: normaliza, solo supervisor, inválido → 400 | Auto | `tests/flota_flow_test.go` | ✅ |
| CP-31 | 16 | Vincular la cuenta escaneando el QR y entrar con el código real recibido en WhatsApp (verificado en la app con WhatsApp en modo log) | Man | Teléfono de la empresa | ⬜ a ejecutar al vincular el número |
| CP-32 | 17 | Textos de cada aviso (en camino, entregado, no entregado con motivo, reprogramado) con link | Auto | `TestMensajeEnvio`, `TestMensajeRuta` | ✅ |
| CP-33 | 17 | Un aviso por evento (idempotencia); sin teléfono queda "omitido" | Auto | `TestNotificador_*` | ✅ |
| CP-34 | 17 | Aviso al repartidor con el total actualizado al asignarle más envíos | Auto | `TestNotificador_AvisoDeRutaAlRepartidor` | ✅ |
| CP-35 | 18 | Alta de vehículo: patente normalizada y única, capacidad > 0; repartidor no puede (403) | Auto | `tests/flota_flow_test.go` | ✅ |
| CP-36 | 18 | Asignación a ruta, flota con carga y paquetes; vehículo en mantenimiento → 409 | Auto | `tests/flota_flow_test.go` | ✅ |
| CP-37 | 19 | Firma: se dibuja en todo el ancho del recuadro | Man | Navegador (PWA) | ✅ |
| CP-38 | 19 | La PWA se sirve con manifest (`application/manifest+json`), íconos, service worker y `viewport-fit=cover` | Man | `curl` + export de Expo | ✅ |
| CP-39 | 19 | iPhone: "Agregar a inicio", pantalla completa sin barras, safe areas | Man | iPhone físico | ⬜ pendiente del equipo |
| CP-40 | 19 | Android: instalar el APK de EAS e iniciar sesión | Man | Android físico | ⬜ pendiente del equipo |
| CP-41 | 1–10 | Regresión de los Sprints 1 y 2 (registro, login, envíos, rutas, estados, firma, reprogramación, tracking) | Auto | resto de `go test ./...`, tests web y mobile | ✅ |
| CP-42 | 6 | "Iniciar ruta" pasa a "en camino" todos los envíos de la ruta y la ruta queda en curso; a una ruta iniciada no se le pueden asignar envíos | Auto | `TestReiniciar_EstadoInicialRepetibleSinTocarDatosAjenos`, `BotonIniciarRuta.test.tsx`, `tests/iniciar-ruta.test.ts` (app) | ✅ |
| CP-43 | 6 | El estado de la ruta se deriva de sus envíos (planificada → en curso → completada) | Auto | `TestEnvioRepo_EstadoDeRutaSeDerivaDeSusEnvios`, `eliminar_handler_test.go` | ✅ |
| CP-44 | 12 | Recorrido más corto: el orden exacto es el óptimo, evita el zigzag y con muchas paradas la heurística mejora el orden de alta | Auto | `TestOrdenMasCorto_ExactoEsElMejorPosible`, `TestOrdenMasCorto_EvitaElZigzag`, `TestOrdenMasCorto_HeuristicaConMuchasParadas`, `TestOrdenMasCorto_SinLlegadaTerminaEnLaMasLejana` | ✅ |
| CP-45 | 12 | Simulador: entrega las paradas de demostración, termina la ruta y vuelve al depósito | Auto | `TestSimulador_EntregaLasParadasDemoYVuelveAlDeposito`, `TestSimulador_TerminaLaRutaYVuelveAlDeposito` | ✅ |
| CP-46 | 12 | Simulador: un camión de entrega manual espera en la puerta hasta que se resuelve el envío desde la app y va a su velocidad propia | Auto + Man | `TestSimulador_CamionConEntregaManualEsperaEnLaPuertaYVaMasRapido`; verificado en el sistema corriendo (11/11) | ✅ |
| CP-47 | 17 | WhatsApp sin vincular o con falla → el aviso va por mail; si fallan ambos queda el error; sin teléfono ni mail queda omitido | Auto | `TestNotificador_SinWhatsappVinculadoVaPorMail`, `TestNotificador_SiWhatsappFallaReintentaPorMail`, `TestNotificador_SiFallanAmbosQuedaElError`, `TestNotificador_SinTelefonoNiMailQuedaOmitido` | ✅ |
| CP-48 | 17 | Los avisos de destinatarios de demostración quedan "simulado"; no se mandan mails a dominios reservados | Auto | `TestNotificador_DestinatarioDemoQuedaSimuladoSinEnviar`, `TestNotificador_NoMandaMailsADominiosReservados` | ✅ |
| CP-49 | 17 | Mail por SMTP: valores de Gmail y rechazo de inyección de encabezados | Auto | `TestNewSMTP_ValoresDeGmail`, `TestArmarMensaje_RechazaInyeccionDeEncabezados` | ✅ |
| CP-50 | 11 | Botón ▶: el estado inicial se puede repetir y no toca usuarios, vehículos agregados a mano ni envíos o rutas reales; la ruta del camión naranja queda sin iniciar y es de la cuenta de la app | Auto | `TestReiniciar_EstadoInicialRepetibleSinTocarDatosAjenos`, `TestConCuentaDemoEnVivo_LeDaElCamionNaranjaALaCuentaDeLaApp`, `BotonSimulacion.test.tsx` | ✅ |
| CP-51 | 2, 3, 18 | Máscaras y límites de los formularios (teléfono, patente, kilos, textos) | Auto | `mascaras.test.ts`, `EnvioForm.test.tsx`, `RutaForm.test.tsx` | ✅ |
| CP-52 | 11, 12 | Seguimiento en vivo: la parada a la que va el camión se marca "Yendo ahora" y la web se actualiza sola al entregarse un paquete | Man | Sistema corriendo (11/11) | ✅ |
| CP-53 | todas | Prueba manual completa de la web (37 hallazgos; los graves corregidos y verificados) | Man | `docs/superpowers/plans/2026-11-10-web-prueba-manual-resultados.md` | ✅ |

## 7. Resultados

| Suite | Tests | Resultado |
| --- | :-: | --- |
| Go | 297 funciones | ✅ |
| Web | 215 | ✅ |
| Mobile | 65 (+1 salteado) | ✅ |

Corrida del 11/11/2026 (al 07/11 eran 215, 71 y 51). Cobertura de la API: 66,3 % de las sentencias (70,5 % sin `cmd/*`).

- Casos: 53 · ejecutados: 50 · aprobados: 50 · pendientes de ejecución manual en dispositivos/WhatsApp real: 3 (CP-31, CP-39, CP-40).
- Defectos encontrados y corregidos durante el sprint: firma limitada a la mitad del recuadro; firma no exportable en la PWA; rutas de hoy "vencidas" después de las 21 h; 500 en lugar de 404 en flota; coordenadas inventadas en el mapa; dependencia de Leaflet no declarada; manifest servido como `text/plain`; mapa mal encuadrado al cambiar el tamaño del contenedor.

### Conclusión
Las historias del Sprint 3 cumplen sus criterios de aceptación en las pruebas automatizadas y en el sistema corriendo. Queda ejecutar los tres casos manuales sobre dispositivos físicos y la cuenta de WhatsApp real antes de la presentación.
