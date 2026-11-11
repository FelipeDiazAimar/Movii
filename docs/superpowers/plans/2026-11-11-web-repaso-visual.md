# Repaso visual de las correcciones QA-1110 — plan de ejecución (11/11/2026)

Objetivo: confirmar en Chrome que las correcciones de la rama
`fix/qa-1110-correcciones` (plan `2026-11-10-web-correcciones-qa.md`) se ven y
funcionan, sobre todo lo que los tests automáticos NO cubren.
Antecedentes: `2026-11-10-web-prueba-manual-resultados.md` (hallazgos H1..H37).

**Este repaso NO modifica código.** Solo observa y reporta.

## 1. Ambiente (ya levantado por el agente principal)

- Web: `http://localhost:5173` · API: `http://localhost:8080` (con `SIMULADOR_GPS=true`).
- Base: Supabase COMPARTIDO = misma base que producción. Ver reglas de datos.
- Códigos de verificación (login en dos pasos / primer acceso): se escriben en
  `C:\Users\Ulises\AppData\Local\Temp\claude\d2b9e6dd4a5f61ab\338768ba-19c8-46d7-a59c-b41527e5acaf\scratchpad\api3.log`.
- Usuarios demo (clave del seed `Movii2026!`): admin `supervisor@movii.demo`,
  operador `operador@movii.demo`, repartidor `repartidor@movii.demo`.

## 2. Reglas

- NO editar archivos del repo (salvo el informe y las capturas del punto 6).
- NO usar producción (`movii-production.up.railway.app`) para nada.
- NO hacer clic en nada que abra un diálogo NATIVO del navegador.
- NO tocar WhatsApp (ni vincular ni desvincular).
- Datos: todo lo que se cree lleva el prefijo **`QA-1111`**. Solo se crea lo
  que pide el bloque D. Solo se borra lo creado acá. Al final se verifica que
  no quede nada con `QA-1111`.
- Ancho de pantalla: la ventana de Chrome está maximizada y `resize_window` no
  la achica. Para 390 y 768 px usar un `<iframe>` del ancho deseado, como se
  explica en el bloque E.
- Si algo falla 2-3 veces seguidas (la extensión no responde, una página no
  carga), anotarlo como "no verificable" y seguir con el próximo caso.

## 3. Cómo registrar cada caso

Para cada caso: **OK / FALLA / NO VERIFICABLE**, una línea de evidencia
(texto leído, medida, error de consola) y, si es FALLA, una captura guardada
con `save_to_disk: true` y copiada a la carpeta de capturas.
Revisar la consola (`read_console_messages` con `onlyErrors: true`) al menos
una vez por bloque y anotar errores nuevos.

## 4. Casos

### A. Acceso y sesión (sin sesión iniciada)

- A1 (H1) `/login`: email y contraseña VACÍOS al cargar. Leer los `value` de
  los dos inputs con JavaScript. Enviar vacío → "Completá el email y la contraseña." sin pedido a la API.
- A2 (H24/H6) Clave incorrecta → mensaje con mayúscula inicial; la consola NO
  muestra `console.error` por el 401.
- A3 (H31) `/una-ruta-que-no-existe` sin sesión: fondo uniforme a pantalla
  completa, título legible (medir el color del texto contra el fondo con
  `getComputedStyle`), botón "Ir a iniciar sesión" que lleva a `/login`. Captura.
- A4 (H30) Iniciar sesión como `repartidor@movii.demo` → `/acceso-denegado`
  con texto de "usá la app móvil" y SIN "Volver al panel". "Cerrar sesión"
  debe terminar en `/login` (verificar `location.pathname` y que el token
  `movii.web.token` de `localStorage` ya no esté).
- A5 Iniciar sesión como `operador@movii.demo`. Ir a `/usuarios`: acceso
  denegado CON "Volver al panel" (H32) que lleva a `/operaciones`.
- A6 (H31) Con sesión de operador: `/otra-ruta-inexistente` → "Volver al panel"
  lleva a `/operaciones`.
- A7 (H3) Menú lateral: la barra de scroll no es la nativa blanca. Captura del menú.
- A8 Cerrar sesión e iniciar como admin `supervisor@movii.demo` para el resto.

### B. Envíos (admin)

- B1 (H36) `/envios` a ancho completo: la columna "Alta" muestra fecha y hora
  en no más de 2 renglones.
- B2 (H33) `/envios/00000000-0000-0000-0000-000000000000`: título "Envío no
  encontrado" + botón "Volver a envíos". Captura.
- B3 (H7/H8) `/envios/nuevo`: enviar vacío (aparecen errores), completar el
  nombre del destinatario y comprobar que SU error desaparece sin reenviar.
  Peso `-5` → error; corregir a `2` → el error desaparece.
- B4 (H25) En el alta, abrir el calendario de "Fecha de entrega": los días
  anteriores a hoy aparecen deshabilitados. NO registrar todavía (lo hace D1).

### C. Vehículos, usuarios, reportes, operaciones (admin)

- C1 (H21/H11/H12b) `/vehiculos`: abrir "Editar" de `CAM-205` y CANCELAR sin
  guardar. El formulario ocupa un ancho cómodo; selects y modelo sin truncar.
  Los badges de estado de todas las tarjetas en un solo renglón. Captura.
- C2 (H22) Anotar el color de cada vehículo, recargar la página 2 veces y
  comprobar que los colores no cambian.
- C3 (H34b) `/usuarios`: todos los celulares con el mismo formato. `/usuarios/nuevo`
  enviado vacío → mensajes propios debajo de cada campo (no burbujas nativas
  del navegador). NO crear el usuario.
- C4 (H28b) `/reportes` → pestaña Repartidores: columna "Tasa sobre cerrados",
  nota explicativa y "—" para quien no tiene envíos cerrados.
- C5 (H2) `/operaciones`: con el mouse sobre el mapa, hacer `scroll` hacia abajo
  4-5 veces: la PÁGINA baja y el mapa NO cambia de zoom (comparar el nivel de
  zoom o las etiquetas visibles antes y después). Aparece la pista de Ctrl + rueda.
- C6 (H23) En `/operaciones`, pasar el mapa a 3D: el HUD muestra "Resta X,X km"
  completo (sin "…") y la barra de cámaras no tapa la atribución del mapa. Captura.

### D. Flujo con datos (crea y borra datos `QA-1111`)

- D1 Crear por la UI el envío `QA-1111 Destinatario` en `Bv. 9 de Julio 1500,
  San Francisco, CP 2400`, peso 2. Comprobar (H7) que la vista queda en el
  cartel de éxito con el código de guía (sin tener que subir a mano). Anotar el código.
- D2 Crear por la API (con el token de `localStorage`) un segundo envío
  `QA-1111 Dirección Inválida` en `Calle Zzqqxx Inventada 99999, Pueblo Que No Existe`.
- D3 (H13 + nombre obligatorio) `/rutas/nueva`: enviar sin nombre → aparece
  "El nombre es obligatorio" junto al campo. Crear `QA-1111 Ruta` con
  repartidora Carla. En el detalle (H17) se ve la fecha legible.
- D4 (H14/H15/H16) "Asignar envíos": antes de tildar nada, no aparece "+0%".
  Tildar el envío de dirección inválida → el botón "Asignar" deshabilitado
  EXPLICA el motivo debajo. Destildarlo, tildar el de D1 → la tarjeta mantiene
  el peso dentro del borde con el badge de recomendación. Asignar. Captura del panel.
- D5 (H18) Tabla "Envíos de la ruta": muestra el destinatario y el código es un
  link al envío.
- D6 (H20) Crear por la UI el vehículo patente `QA1111` con estado "En base".
  Asignarlo a `QA-1111 Ruta` desde el detalle de la ruta. Ir a `/vehiculos`:
  el vehículo debe figurar "En servicio".
- D7 (H17/H19) `/rutas/<id>/mapa`: fecha legible (no `2026-11-11`).
  `/rutas/<id>/3d`: en la cámara General el panel de datos no tapa las paradas.
  Hacer clic en "Completa" (pantalla completa): la consola NO debe registrar una
  excepción "not granted" sin capturar. Captura del 3D.
- D8 (H28a) `/repartidores/33333333-3333-3333-3333-333333333333`: cada ruta con
  fecha y nombre como link; `QA-1111 Ruta` figura.
- D9 (H25/H24b/H26/H29) En el detalle del envío de D1: "Registrar incidencia"
  (motivo cliente ausente, comentario `QA-1111`). El selector de foto es un
  botón propio, no el input nativo. Después "Reprogramar": guardar sin fecha →
  "Elegí una fecha"; los días pasados están deshabilitados; elegir pasado
  mañana → el historial dice "Reprogramado para el DD/MM/AAAA (mañana)" y la
  tarjeta "Comprometido para ..." usa fecha legible.
- D10 (H27/H37) `/tracking/<código de D1>` y `/tracking/MOV-20261107-0006`
  (este último lleva días sin moverse): ninguno promete "Llega entre ..." con
  una ventana que ya pasó; el viejo muestra "Estamos actualizando el horario de llegada".

### E. Responsive (390 y 768 px)

Técnica: en una pestaña de `http://localhost:5173` con sesión iniciada,
reemplazar el `body` por `iframe`s del ancho deseado (alto 600 px) que carguen
cada ruta, esperar ~5 s y medir
`iframe.contentDocument.documentElement.scrollWidth` contra el ancho del iframe.
Desborde = `scrollWidth` mayor al ancho + 5 px. Volver a navegar a la app
al terminar.

- E1 (H35) A **390 px**: `/envios`, `/usuarios`, `/reportes` (las 3 pestañas),
  `/operaciones`, `/rutas`, `/vehiculos`, `/envios/<id de D1>`, `/login`,
  `/tracking/<código de D1>`. Anotar el `scrollWidth` de cada una.
- E2 (H35) A **768 px**: las mismas rutas.
- E3 Captura de `/envios` y `/usuarios` a 390 px (deben verse en columnas
  reducidas o tarjetas, sin tabla cortada).

### F. Limpieza (obligatoria)

Con el token del admin, por la API:
1. Pasar el envío de D1 a un estado borrable si hace falta y desasignarlo de la
   ruta (`DELETE /rutas/{id}/envios/{envioId}`).
2. `DELETE /envios/{id}` de los dos envíos `QA-1111`.
3. `DELETE /rutas/{id}` de `QA-1111 Ruta`.
4. `DELETE /vehiculos/{id}` de `QA1111`.
5. Verificar con `GET /envios`, `GET /rutas`, `GET /operaciones/flota` que no
   queda nada con `QA-1111` ni la patente `QA1111`.
Cerrar la pestaña que se abrió.

## 5. Criterio de éxito

Los cuatro graves (H1, H30, H31, H35) en OK, sin errores nuevos en consola y
limpieza completa. Cualquier FALLA se reporta con pasos, esperado vs. obtenido
y captura; NO se corrige.

## 6. Entregable

- Informe: `docs/superpowers/plans/2026-11-11-web-repaso-visual-resultados.md`
  con tabla caso por caso (OK / FALLA / NO VERIFICABLE + evidencia), lista de
  FALLAS ordenada por gravedad, errores de consola, medidas de responsive y
  resultado de la limpieza.
- Capturas en `docs/superpowers/plans/capturas-qa-1111/` (copiar desde la ruta
  que devuelve `save_to_disk`).
