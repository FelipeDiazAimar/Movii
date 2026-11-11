# Repaso visual de las correcciones QA-1110 — resultados (11/11/2026)

Plan ejecutado: `docs/superpowers/plans/2026-11-11-web-repaso-visual.md`.
Ambiente: web `http://localhost:5173`, API `http://localhost:8080` (local). No se usó producción.
Navegador: Claude en Chrome, una pestaña (cerrada al final). Usuarios demo solo en localhost.
Este repaso no modificó código del repo.

## 1. Resumen

- Casos: 32. **OK: 30 · FALLA: 2 · NO VERIFICABLE: 0.**
- **Criterio de éxito (plan, sección 5): NO CUMPLIDO.** H1, H30 y H31 están OK, pero H35 (grave) falla a 390 px en `/envios` y en el detalle de envío. Además hubo errores nuevos de consola (React, modo desarrollo) al cargar `/operaciones`.
- **Limpieza (bloque F): completa.** Verificada por API: no queda ningún registro `QA-1111` ni la patente `QA1111`.

## 2. Caso por caso

| Caso | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| A1 | H1 | OK | Email y contraseña con valor vacío al cargar. Enviar vacío muestra "Completá el email y la contraseña." y no hay petición a la API. |
| A2 | H24/H6 | OK | "Email o contraseña incorrectos" (mayúscula inicial). POST /auth/login 401. Consola sin console.error (solo INFO). |
| A3 | H31 | OK | Fondo uniforme rgb(238,240,242) en 6 puntos, contenedor de 1366×645. Título "Página no encontrada" con contraste 15,53:1. El botón lleva a /login. Captura A3. |
| A4 | H30 | OK | repartidor → /acceso-denegado con "usá la app móvil" y sin "Volver al panel". "Cerrar sesión" → /login, sin token. |
| A5 | H32 | OK | operador en /usuarios: "Volver al panel" (href /operaciones) y el clic llega a /operaciones. |
| A6 | H31 | OK | operador en ruta inexistente: "Volver al panel" lleva a /operaciones. |
| A7 | H3 | OK | Menú con clase scroll-oscuro: scrollbar thin y translúcida, sin barra blanca nativa (zoom). Evaluado con admin, porque el menú del operador no desborda. Captura A7. |
| A8 | — | OK | Cierre de sesión de operador (sin token). Login de admin supervisor@ → /operaciones. |
| B1 | H36 | OK | Columna Alta en 2 renglones: fecha (18 px) y hora (16 px). |
| B2 | H33 | OK | "Envío no encontrado" con botón "Volver a envíos" (lleva a /envios). Captura B2. |
| B3 | H7/H8 | OK | Envío vacío: 4 errores propios y sin POST. El error del nombre desaparece al escribir. Peso -5 muestra error; con 2 desaparece. Sin reenviar. |
| B4 | H25 | OK | Días 1–10 de noviembre y octubre deshabilitados; del 11 en adelante habilitados. Escape cierra sin registrar. |
| C1 | H21/H11/H12b | OK | Editar CAM-205 cancelado sin cambios. Formulario de 989 px; selects y modelo sin truncar; badges en 1 renglón. Captura C1. |
| C2 | H22 | OK | CAM-205 #654564; FUR-102 #0ea5e9; TRK-318 #f97316. Iguales antes y tras 2 recargas (ver O7). |
| C3 | H34b | OK | Celulares con mismo formato ("+54 9 " + 10 dígitos). /usuarios/nuevo vacío: mensajes propios bajo cada campo, sin POST. |
| C4 | H28b | OK | Columna "Tasa sobre cerrados", nota explicativa, "—" para Diego y Lucía (confirmado con get_page_text). |
| C5 | H2 | OK | 5 ruedas sobre el mapa: la página baja (scrollY 874 → 1038) y el zoom de teselas queda en 14. Aparece "Ctrl + rueda para acercar". |
| C6 | H23 | OK | 3D: la barra de cámaras no tapa la atribución. HUD "RESTA 0,0 km" completo con QA1111 (ruta asignada). Con CAM-205 (sin ruta) dice "RESTA –", por eso se verificó después de D6. Capturas C6. |
| D1 | H7 | OK | Alta por UI: cartel "Envío registrado. Código de guía para el cliente: MOV-20261111-0001" en la misma vista. POST 201. Captura D1. |
| D2 | — | OK | Alta por API: MOV-20261111-0002 (201). El panel de asignación la marca "Dirección inválida". |
| D3 | H13 + nombre | OK | Sin nombre: "El nombre es obligatorio" junto al campo, sin POST. "QA-1111 Ruta" creada con Carla (201). Fecha "11 nov. 2026" legible (H17). Ver O3. |
| D4 | H14/H15/H16 | OK | Sin "+0%" antes de tildar. Dirección inválida: "Asignar (1)" deshabilitado con motivo. MOV-20261111-0001: peso dentro del borde y badge "Conviene (+1.8km)". Asignado. Captura D4. |
| D5 | H18 | OK | Tabla "Envíos de la ruta": destinatario "QA-1111 Destinatario" y código como enlace a /envios/e35180b7-… (ver O6). |
| D6 | H20 | OK | QA1111 creado por UI (201) con estado "En base". Asignado desde el detalle de la ruta ("Carga 2 de 3500 kg"). En /vehiculos figura "En servicio". |
| D7 | H17/H19 | OK | Mapa: "11 nov. 2026" y sin formato ISO. 3D General: el panel GPS no tapa paradas. "Completa": sin excepción "not granted" en consola (ver O4). Captura D7. |
| D8 | H28a | OK | 9 de 9 filas con enlace a la ruta, fechas legibles y sin ISO. "QA-1111 Ruta" presente. |
| D9 | H25/H24b/H26/H29 | OK | Incidencia (cliente ausente, comentario "QA-1111 incidencia de prueba"): POST 200 y aparece en el historial. Foto: control visible propio ("Elegir foto"); el input está oculto (sr-only) y no se abrió el selector nativo. Reprogramar sin fecha: "Elegí una fecha". Días pasados deshabilitados. 13/11: POST 200 e historial "Reprogramado para el 13/11/2026 (mañana)" (ver O9). |
| D10 | H27/H37 | OK | MOV-20261111-0001: "Llega el viernes 13 de noviembre" (fecha futura). MOV-20261107-0006: "Estamos actualizando el horario de llegada". Captura D10. |
| E1 | H35 (390 px) | **FALLA** | /envios mide 431 px y el detalle de envío 440 px (criterio: no más de 395). Detalle en la sección 3, falla 1 y 2. |
| E2 | H35 (768 px) | OK | Todas las rutas miden 751 px (ancho útil). Detalle de envío 766 px: dentro del criterio (≤ 773), con observación O5. |
| E3 | — | **FALLA** | /envios a 390 px: tabla cortada en el borde derecho, con la columna Estado fuera de vista. /usuarios a 390 px: tarjetas, correcto. Capturas E3. |
| F | — | OK | Limpieza completa y verificada por API (sección 6). |

Conteo: A 8 OK · B 4 OK · C 6 OK · D 10 OK · E 1 OK y 2 FALLA · F OK = **30 OK, 2 FALLA, 0 NO VERIFICABLE**.

## 3. Fallas (por gravedad)

1. **[GRAVE] H35 — /envios con desborde horizontal a 390 px (E1, E3).**
   - Pasos: con sesión de admin, cargar `/envios` en un marco de 390 px.
   - Esperado: sin desborde; columnas reducidas o tarjetas, sin tabla cortada.
   - Obtenido: scrollWidth 431 px (criterio: no más de 395). La tabla queda cortada en el borde derecho: la columna Estado queda fuera de vista y aparece una barra de desplazamiento interna.
   - Captura: `capturas-qa-1111/E3-envios-390px-FALLA.jpg`.

2. **[GRAVE] H35 — detalle de envío con desborde a 390 px (E1).**
   - Pasos: abrir `/envios/e35180b7-c468-44c0-a975-35781c08dbaa` en un marco de 390 px.
   - Esperado: sin desborde.
   - Obtenido: scrollWidth 440 px (+50). Los paneles Destinatario, Paquete y Asignación miden 424 px dentro de un área útil de 373 px: quedan cortados a la derecha.
   - Captura: `capturas-qa-1111/E1-envio-detalle-390px-FALLA.jpg`.

3. **[MEDIA, incumple "sin errores nuevos en consola"] Error de React al cargar /operaciones.**
   - Pasos: con QA1111 asignado a una ruta, cargar `/operaciones`. También ocurre al borrar ese vehículo con la página abierta.
   - Esperado: sin errores nuevos en consola.
   - Obtenido: ERROR "The final argument passed to useMemo changed size between renders…" (react-dom, modo desarrollo). La dependencia que cambia es el id del vehículo QA1111 (`ef488e2c-07a9-4e14-a4d9-d35fa3ad091d`). Sin impacto visual observado. Tras borrar el vehículo y recargar `/operaciones`: sin errores.
   - Sin captura (error de consola).

## 4. Errores de consola

- **ERROR** (react-dom_client.js, modo desarrollo): "useMemo changed size between renders". Instantes: 10:06:33, 10:07:01, 10:07:53, 10:08:23, 10:10:39, 10:11:21, 10:12:12 (carga aislada de /operaciones a 390 px) y 10:13:23 (tres veces, al borrar QA1111 con /operaciones abierta). Origen: /operaciones con el vehículo QA1111 asignado a una ruta. Ver falla 3.
- **WARNING** (maplibre, 9:55:32, en `/rutas/<id>/3d`): imagen "swimming_pool" no cargada. Sin impacto visible.
- Sin errores en A2 (solo logs INFO de login), al cierre de B, en C6, en D7 (Completa) ni en las cargas de /usuarios, /reportes, /rutas, /vehiculos, /envios/<id> y /tracking durante E.

## 5. Medidas responsive (scrollWidth en px)

Criterio del plan: desborde si scrollWidth > ancho + 5. Ancho útil = ancho del marco menos la barra de scroll (17 px) cuando la página tiene scroll vertical: 373 px a 390 y 751 px a 768.

| Ruta | 390 px | 768 px | Resultado 390 |
|---|---|---|---|
| /envios | 431 | 751 | **Desborde** (+41) |
| /usuarios | 373 | 751 | OK |
| /reportes — pestaña Envíos | 373 | 751 | OK |
| /reportes — pestaña Repartidores | 373 | 751 | OK |
| /reportes — pestaña Incidencias | 373 | 751 | OK |
| /operaciones | 373 | 751 | OK |
| /rutas | 373 | 751 | OK |
| /vehiculos | 373 | 751 | OK |
| /envios/e35180b7-… (MOV-20261111-0001) | 440 | 766 | **Desborde** (+50) a 390; OK a 768 (criterio) |
| /login (sin sesión) | 388 | 766 | OK |
| /login con sesión | redirige a /operaciones (373) | — | Nota |
| /tracking/MOV-20261111-0001 | 373 | 751 | OK |

## 6. Limpieza (bloque F)

Ejecutada por API con el token de la sesión de admin (fetch a localhost:8080, solo a la API local).

| Paso | Llamada | Resultado |
|---|---|---|
| 1 | DELETE /rutas/240a4e75-…/envios/e35180b7-… | 404 "la ruta o el envío no existen" (el envío ya había salido de la ruta, ver O8) |
| 2 | DELETE /envios/e35180b7-… (MOV-20261111-0001, D1) | 204 |
| 2 | DELETE /envios/d10f95fd-… (MOV-20261111-0002, D2) | 204 |
| 3 | DELETE /rutas/240a4e75-… ("QA-1111 Ruta", con vehículo asignado) | 204 |
| 4 | DELETE /vehiculos/ef488e2c-… (patente QA1111) | 204 |
| 5 | GET /envios | 200, total 25 (igual que al inicio), sin coincidencias `QA-1111` / `MOV-20261111-000[12]` |
| 5 | GET /rutas | 200, total 12, sin coincidencias `QA-1111` |
| 5 | GET /operaciones/flota | 200, total 3 (igual que al inicio), sin coincidencias `QA1111` |
| 5 | GET /envios/e35180b7-… y GET /envios/d10f95fd-… | 404 ambos |

**Qué se borró:** los 2 envíos QA-1111, la ruta QA-1111 Ruta y el vehículo QA1111. Con ellos se fueron sus eventos, la incidencia y la reprogramación.

**Qué quedó y por qué:** en la API no queda nada creado por este repaso. No se creó ningún usuario (C3 no envió). No se tocó WhatsApp. No se modificaron CAM-205, FUR-102 ni TRK-318 más allá de abrir y cancelar la edición de CAM-205. La verificación fue solo por API: no se consultó la base compartida (regla de no tocarla), así que las filas auxiliares de los envíos borrados se asumen eliminadas en cascada sin confirmación directa.

## 7. Observaciones (no cuentan como falla)

- **O1 (A3):** el "404" decorativo tiene contraste 1,38:1 contra el fondo. El título sí es legible (15,53:1).
- **O2 (C6):** el chip 2D muestra "Resta 0.0 km" (punto decimal) y el HUD 3D muestra "0,0 km" (coma).
- **O3 (D3):** en /rutas/nueva, los errores "El nombre es obligatorio" y "El repartidor es obligatorio" siguen visibles después de completar los campos, hasta reenviar. Es la misma clase que H8, que en envíos sí quedó corregido (B3). H13: los títulos de ruta usan 2 líneas con atributo title, según el plan de correcciones; en 134 px de ancho aún se cortan títulos largos como "Ruta Seguimiento E2E".
- **O4 (D7):** el clic en "Completa" no activó pantalla completa en el navegador de prueba (`document.fullscreenElement` = null; el botón sigue en "Completa" con aria-pressed=false). No hubo excepción; no se pudo confirmar si la app llama a requestFullscreen.
- **O5 (E2):** el detalle de envío a 768 px mide 766 px, dentro del criterio, pero queda 15 px por encima del área visible (751 px): habrá scroll horizontal dentro del marco.
- **O6 (D5):** tras asignar, la columna Destinatario muestra "—" unos segundos y luego se completa (carga asíncrona). Se verificó después de la carga.
- **O7 (C2):** FUR-102 y TRK-318 no tienen color guardado en la API (campo vacío); la UI pinta un color por defecto estable (azul y naranja).
- **O8 (F):** el DELETE de desasignación respondió 404 porque el envío ya no estaba en la ruta: tras la incidencia y la reprogramación, la app indica "el envío vuelve al depósito". No afectó la limpieza.
- **O9 (D9):** el "(mañana)" de "Reprogramado para el 13/11/2026 (mañana)" es la franja horaria (mañana/tarde/noche), que queda seleccionada por defecto, no el día. El texto coincide con el esperado del plan.
- **O10 (D4):** la explicación del botón Asignar tarda unos segundos ("Validando direcciones…") antes de mostrar el motivo.

## 8. Método y notas

- Se instaló un registro no bloqueante de `alert`/`confirm`/`prompt` en la pestaña cuando fue posible (se pierde en cada recarga completa). No se abrió ningún diálogo nativo ni se usó el selector de fotos (D9: se verificó por DOM que el control visible es propio). Ningún diálogo quedó registrado en las verificaciones hechas.
- Los usuarios demo entraron sin código de 6 dígitos (el log de la app indica "sesión iniciada (sin segundo paso)"), así que no hizo falta leer `api3.log`.
- Una consulta JS fue bloqueada por el filtro de la herramienta (C4); se verificó con get_page_text.
- Para E se usaron iframes del mismo origen dentro de la app con sesión. /login se midió sin sesión, cerrando sesión y volviendo a entrar como admin antes de la limpieza.
- En C5 el mapa se recentró entre ruedas para que el cursor siguiera sobre él; cada rueda se midió con scrollY y zoom antes y después.
- La contraseña de demo no se escribió en este informe.

## 9. Capturas (`docs/superpowers/plans/capturas-qa-1111/`)

- `A3-404-sin-sesion.jpg`
- `A7-menu-lateral.jpg`, `A7-menu-lateral-zoom.png`
- `B2-envio-no-encontrado.jpg`
- `C1-vehiculos-editar-cam205-cancelar.jpg`
- `C6-operaciones-3d-cam205-sin-ruta.jpg`, `C6-operaciones-3d-qa1111-resta-km.jpg`
- `D1-alta-envio-exito.jpg`
- `D4-panel-asignar-envios.jpg`
- `D7-ruta-3d-general.jpg`
- `D10-tracking-envio-vencido.jpg`
- `E1-envio-detalle-390px-FALLA.jpg`
- `E3-envios-390px-FALLA.jpg`, `E3-usuarios-390px.jpg`
