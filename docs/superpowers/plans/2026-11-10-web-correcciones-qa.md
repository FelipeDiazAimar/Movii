# Correcciones de la prueba manual del 10/11/2026 — plan de implementación

Origen: `2026-11-10-web-prueba-manual-resultados.md` (hallazgos H1..H37).
Rama: `fix/qa-1110-correcciones` (desde `main` = `fb3a164`). Sin commits hasta revisar.

Rutas: la web está en `gestion-envios/apps/web/src/` y la API en
`gestion-envios/services/api/`.

## Reglas para todos los frentes

- Tocar SOLO los archivos del frente propio (lista abajo) y sus tests. Si hace
  falta cambiar otro archivo, NO tocarlo: dejarlo anotado en el reporte final.
- NO hacer commits ni cambiar de rama. NO instalar dependencias nuevas.
- NO levantar la API ni correr nada contra la base: `services/api/.env` apunta
  a la base de PRODUCCIÓN. Prohibido `go test ./...`, `go run`, `npm run dev`.
- Web: verificar con `npx eslint <archivos propios>` y
  `npx vitest run <archivos de test propios>` dentro de `gestion-envios/apps/web`.
  NO correr `npm run build` ni la suite completa (lo hace el integrador al
  final; hay otros frentes editando a la vez).
- Textos de interfaz en español rioplatense, mismo tono que el resto de la app.
- Mantener el estilo existente (Tailwind, componentes de `components/ui`).

## Frente 1 — Acceso, sesión y errores (web)

Archivos: `pages/LoginPage.tsx` (+ `LoginPage.test.tsx`, `LoginGoogle.test.tsx`),
`pages/AccesoDenegadoPage.tsx`, `pages/NotFoundPage.tsx`,
`features/auth/AuthContext.tsx`, `services/api-client.ts`,
`components/layout/AppLayout.tsx`, `components/ui/CodigoInput.tsx` (+ test),
`styles/index.css` (solo para la barra de scroll del menú).

- [ ] H1 BLOQUEANTE: quitar email y clave precargados del login (campos vacíos,
      `autocomplete` correcto). Ajustar tests que dependían del valor inicial.
- [ ] H30: en `/acceso-denegado`, "Cerrar sesión" debe terminar en `/login`.
- [ ] H32: para operador/admin sin permiso, agregar "Volver al panel"
      (a `/operaciones`); sin sesión, redirigir a `/login`.
- [ ] H31: página 404 con fondo propio a pantalla completa y texto legible;
      "Volver al panel" lleva a `/operaciones` (o a `/login` sin sesión).
- [ ] H24: los mensajes de error que vienen de la API se muestran con mayúscula
      inicial (resolverlo en un solo lugar: `getApiErrorMessage`).
- [ ] H6: no escribir `console.error` por un 401 esperado en el login.
- [ ] H3: barra de scroll del menú lateral discreta y oscura (no la nativa blanca).
- [ ] H34a: casillas del código OTP con `aria-label` ("Dígito 1 de 6", ...).

## Frente 2 — Envíos (web)

Archivos: `pages/envios/*` (+ tests), `features/envios/*` (+ tests),
`components/ui/DatePicker.tsx`.

- [ ] H7: tras registrar un envío, llevar la vista al cartel de éxito (scroll
      arriba + foco en el cartel).
- [ ] H8: los errores de un campo se limpian al corregirlo (revalidar al cambiar
      una vez que hubo un intento de envío).
- [ ] H35: la tabla del listado no debe desbordar la página: scroll horizontal
      propio del contenedor y/o columnas que se ocultan o apilan en pantallas
      chicas (pensar en 390 px y 768 px).
- [ ] H36: columna "Alta" sin partirse en 5 líneas (fecha compacta, sin corte).
- [ ] H10: mostrar el remitente en el detalle SI la API ya lo devuelve en
      `GET /envios/{id}`; si no lo devuelve, no inventar: anotarlo en el reporte.
- [ ] H33: envío inexistente → estado vacío prolijo con título y "Volver a envíos".
- [ ] H25: `DatePicker` acepta una fecha mínima y deshabilita los días
      anteriores; usarlo en reprogramación (mínimo hoy) y en la fecha de entrega
      del alta. El resto de los usos de `DatePicker` no debe cambiar.
- [ ] H24b: fecha vacía en reprogramación → "Elegí una fecha".
- [ ] H26 (parte web): "Comprometido para ..." con fecha legible ("12 nov. 2026").
- [ ] H29: selector de foto de incidencia con estilo propio (botón + nombre del archivo).

## Frente 3 — Rutas, repartidores y vistas 3D (web)

Archivos: `pages/rutas/*` (+ tests), `features/rutas/*` (+ tests),
`pages/repartidores/*`, `features/mapas/*` (+ tests).

- [ ] H13: títulos de las tarjetas de ruta sin truncar de más (dos líneas + `title`).
- [ ] H14: panel "Envíos pendientes" legible: código en una línea, badge de
      recomendación debajo, peso siempre dentro de la tarjeta.
- [ ] H15: si "Asignar" queda deshabilitado, explicar por qué (por ejemplo
      "Quitá los envíos con dirección inválida para asignar").
- [ ] H16: no mostrar "+0%" cuando la ruta está vacía; checkboxes con
      `aria-label` (código de guía + destinatario).
- [ ] H17: fechas legibles en el mapa de ruta y mostrar la fecha en el detalle de ruta.
- [ ] H18: tabla "Envíos de la ruta" con destinatario (si el dato ya viene) y
      código como link al envío.
- [ ] Alta de ruta: nombre obligatorio (validación Zod + mensaje).
- [ ] H28a: detalle de repartidor: fecha de cada ruta y link a la ruta.
- [ ] H19/H23: en las vistas 3D el panel de info no tapa paradas ni se trunca
      ("RESTA 1.8 km" completo); la barra de cámaras no pisa la atribución.
- [ ] Pantalla completa 3D: capturar el rechazo de `requestFullscreen()` (sin
      excepción suelta en consola).

## Frente 4 — Operaciones, vehículos, usuarios, reportes y tracking (web)

Archivos: `pages/OperacionesPage.tsx`, `pages/VehiculosPage.tsx`,
`pages/ReportesPage.tsx` (+ test), `pages/TrackingPage.tsx`,
`pages/usuarios/*`, `features/flota/*` (+ tests), `features/usuarios/*`.

- [ ] H2: en los mapas Leaflet embebidos en páginas con scroll, la rueda no hace
      zoom salvo con Ctrl; mostrar la pista "Ctrl + rueda para acercar".
- [ ] H21: formulario de edición de vehículo con ancho suficiente (no dentro de
      la columna de una tarjeta): selects y modelo sin truncar.
- [ ] H11: errores del formulario de vehículo junto al campo; `label` real en
      Patente y Modelo.
- [ ] H22: el color "automático" de un vehículo debe ser estable (derivado de la
      patente o el id, no aleatorio por render).
- [ ] H12b: el badge de estado no se parte en dos líneas en la tarjeta.
- [ ] H35: tablas de Usuarios y Reportes sin desbordar la página (scroll propio
      del contenedor o columnas apiladas en pantallas chicas).
- [ ] H34b: celulares con un único formato en el listado; alta de usuario con
      mensajes de validación propios (no los nativos del navegador).
- [ ] H28b: reporte de repartidores: aclarar la tasa ("sobre envíos cerrados") y
      mostrar "—" cuando no hay cerrados.
- [ ] H27/H37 (parte web): si la ventana de llegada ya pasó, la API no manda
      ETA o la posición es vieja, no prometer minutos: mostrar
      "Estamos actualizando el horario de llegada".
- NO tocar: "Temperatura de carga" ni el KPI "Vehículos en servicio" (decisión
  de diseño del equipo; queda como observación).

## Frente 5 — API (Go)

Archivos: `internal/services/{flota_service,estado_service,tracking_service,envio_service}.go`
(+ sus `_test.go` unitarios), `internal/handlers/*` solo si hace falta para el
código de error, `gestion-envios/docs/api/openapi.yaml`.

- [ ] H20: al asignar a una ruta un vehículo "en_base", pasa a "activo"
      (mantenimiento sigue devolviendo 409). Test unitario si es viable sin base.
- [ ] H26: comentario del evento de reprogramación legible:
      "Reprogramado para el 12/11/2026 (mañana)". Test.
- [ ] H37/H27: el tracking no devuelve ETA si la última posición del vehículo
      tiene más de 15 minutos; la ventana nunca empieza antes de "ahora". Test.
- [ ] Tamaño de paquete inválido: 400 con código y mensaje propios
      (`tamano_invalido`), no "faltan datos obligatorios". Test.
- Verificación permitida: `gofmt -l`, `go vet ./...`, `go build ./...` y
  `go test -run <TestUnitario> ./internal/services/` SOLO para tests que no
  abran conexión a la base (revisar que no usen `testenv` ni un pool).

## Fuera de alcance (no es código)

- H4/H12: limpiar datos de test en la base compartida (decisión del equipo).
- Rotar la clave del admin demo en producción después de desplegar H1.
- H9: dirección inexistente aceptada en el alta (ya se marca "Dirección
  inválida" al asignar; cambiarlo es decisión de producto).

## Integración (la hace el agente principal)

1. Revisar el diff de cada frente y los avisos de "archivo ajeno".
2. `npm run lint`, `npm test`, `npm run build` en `apps/web`; `gofmt`, `go vet`
   y `go build` en la API.
3. Repaso visual en Chrome de los graves (H1, H30, H31, H35).
