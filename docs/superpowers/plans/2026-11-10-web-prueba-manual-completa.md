# Prueba manual completa de la web — plan y procedimiento (10/11/2026)

Código bajo prueba: `main` = `fb3a164`. Alcance: **panel web** (operador y
admin) + **tracking público**. Fuera de alcance: app móvil/PWA del repartidor
(solo se usa para generar estados si hace falta), APK, iPhone.

## 1. Ambiente

| Pieza | Cómo |
|---|---|
| API | Local, `go run ./cmd/api` en `:8080`, con el `.env` actual |
| Web | Local, `npm run dev` en `:5173` (código más nuevo que producción) |
| Base | Supabase compartido (la única que hay: el equipo retiró el Postgres local en `fb3a164`) |
| WhatsApp / mail | `WHATSAPP_HABILITADO=false` → los códigos de login salen en el log de la API y no se manda nada real. Para la prueba se vacía `RESEND_API_KEY` en el `.env` para que tampoco salgan mails |
| GPS | `SIMULADOR_GPS=true` solo durante la prueba (sin él no se puede ver el movimiento "en vivo") |
| Navegador | Chrome con la extensión de Claude, pestaña nueva propia |
| Producción | Pasada final de **solo lectura** sobre `movii-production.up.railway.app` |

## 2. Reglas sobre los datos (la base es la de producción)

- Todo lo que se cree lleva el prefijo **`QA-1110`** (envíos, ruta, vehículo, usuario).
- Solo se edita o borra lo creado en esta prueba. Nada de datos del equipo.
- No se toca la sesión de WhatsApp (ni vincular ni desvincular).
- Al final se lista lo que quedó creado. Los envíos entregados o en camino
  no se pueden borrar por la API: quedan informados para limpiarlos en la base.

## 3. Usuarios

- Admin: `supervisor@movii.demo` · Operador: `operador@movii.demo` ·
  Repartidor: `repartidor@movii.demo` (clave demo del seed).
- Si el login pide código de 6 dígitos, se lee del log de la API.
- Si las claves demo fueron cambiadas en la base compartida → frenar y pedirlas.

## 4. Procedimiento

1. Levantar API y web en segundo plano; verificar `/health` y que la web carga.
2. Abrir pestaña nueva en Chrome; ventana a 1440×900.
3. Recorrer los bloques de la sección 5 **en orden** (cada bloque deja datos
   que usa el siguiente).
4. En cada pantalla revisar siempre lo mismo:
   - **Se ve bien**: alineación, textos cortados, contraste, estados vacíos,
     loaders, íconos, tema noche si aplica.
   - **Funciona**: la acción hace lo que dice y el dato persiste al recargar.
   - **Errores**: consola del navegador y pedidos de red fallidos (4xx/5xx inesperados).
   - **Validaciones**: campo vacío, dato inválido, mensaje de error legible.
5. Repetir las pantallas principales a **390×844** (celular) y **768×1024** (tablet).
6. Cada hallazgo se anota con: pantalla, pasos, esperado vs. obtenido,
   severidad (bloqueante / mayor / menor / cosmético) y captura.
7. Cierre: apagar API y web, devolver el `.env` a como estaba, entregar informe.

Límites: no se hace clic en nada que abra un diálogo nativo del navegador
(el código no usa `confirm`/`alert`, verificado). El login con Google se
prueba hasta la redirección a Google; el ingreso real con la cuenta lo hace Ulises.

## 5. Casos de prueba

### A. Acceso (sin sesión)
- A1 `/` sin sesión redirige a `/login`. A2 Clave incorrecta → error claro.
- A3 Login admin OK (y paso del código si lo pide: código malo, reenviar, código bueno).
- A4 Botón "Continuar con Google" visible y redirige a Google.
- A5 Login como repartidor → aviso de usar la app (`/acceso-denegado`).
- A6 Ruta inexistente → página 404. A7 Cerrar sesión; "atrás" no vuelve a entrar.
- A8 Sesión persiste al recargar.

### B. Roles
- B1 Operador no ve "Usuarios" ni "WhatsApp" en el menú.
- B2 Operador entrando por URL a `/usuarios` y `/configuracion/whatsapp` → acceso denegado.
- B3 Operador no ve botones de borrar (solo admin).

### C. Envíos
- C1 Listado: carga, filtros por estado y fecha, buscador, estado vacío.
- C2 Alta: validaciones campo por campo (vacíos, CP, peso, tamaño inválido → 400 del fix `354e6d5`).
- C3 Alta OK (`QA-1110`): muestra código de guía y botón copiar; con y sin ruta opcional.
- C4 Validación/geocodificación de dirección (dirección real vs. inexistente).
- C5 Detalle: datos, línea de tiempo, tarjeta de asignación, avisos de WhatsApp.
- C6 Acciones de estado desde el detalle (las que permita el rol) y que el timeline se actualice.
- C7 Borrado (admin) de un envío pendiente creado en la prueba.

### D. Rutas
- D1 Listado en tarjetas, filtro de fecha, estado vacío.
- D2 Alta: validaciones; selector de repartidor funciona **como operador** (gap viejo).
- D3 Detalle: asignar envíos, **recomendación por distancia** (conviene / no conviene / sin recomendación), peso y cantidad totales, desasignar.
- D4 Asignar vehículo; vehículo en mantenimiento → rechazo.
- D5 Edición solo mientras está planificada.
- D6 Mapa 2D (`/rutas/:id/mapa`): paradas, recorrido, paradas sin ubicación, botón Google Maps.
- D7 Vista 3D (`/rutas/:id/3d`): carga, toggle 2D/3D, pantalla completa, sin errores de WebGL.
- D8 Borrado (admin) de la ruta de prueba al final.

### E. Vehículos
- E1 Listado y slider. E2 Alta: patente normalizada y duplicada, capacidad > 0.
- E3 Editar tipo y color (selector de color), ilustración según tipo.
- E4 Borrado (admin) del vehículo de prueba.

### F. Operaciones (pantalla principal)
- F1 KPIs, flota, carga, chofer y línea de paradas con datos reales.
- F2 Indicador "En vivo" y camiones moviéndose sin recargar (SSE).
- F3 Seleccionar un recorrido a la vez; clic en paquete dibuja el camino con distancia y tiempo.
- F4 Toggle 2D/3D, pantalla completa con panel, tema noche legible.
- F5 Filtro de fecha del encabezado; día sin rutas → estado vacío.

### G. Repartidores
- G1 Listado y buscador. G2 Detalle con perfil e historial reales.

### H. Reportes
- H1 Pestañas envíos / repartidores / incidencias con período válido.
- H2 Validaciones: sin período, desde > hasta, más de 366 días.
- H3 Ranking y Pareto con datos; descarga de CSV.

### I. Usuarios (admin)
- I1 Listado, filtros y buscador. I2 Alta `QA-1110` (validaciones, email duplicado).
- I3 Editar celular (normalización, inválido). I4 Borrado del usuario de prueba.
- I5 **Primer acceso** con el usuario nuevo: login → `/primer-acceso` → reglas de
  contraseña → código (del log) → entra. Se hace antes de I4.

### J. WhatsApp (admin) — solo lectura
- J1 La pantalla carga y muestra el estado. No se vincula ni desvincula.

### K. Tracking público (sin sesión)
- K1 `/tracking` con código inexistente → mensaje genérico.
- K2 Código real: estados, hora estimada, mapa en vivo 2D y 3D.
- K3 URL directa `/tracking/:codigo`. K4 No expone datos internos.

### L. Transversal
- L1 Responsive (390 / 768 / 1440): menú lateral, tablas, formularios, mapas.
- L2 Menú compacto / expandido; navegación con teclado y foco visible en formularios.
- L3 Recarga en cualquier ruta interna no rompe (SPA).
- L4 Consola limpia en cada pantalla.

### M. Producción (solo lectura)
- M1 Carga `/`, login, Operaciones, Envíos, Rutas, Tracking: se ven igual que en local.
- M2 Anotar diferencias de versión entre producción y `main`.

## 6. Entregable

Informe en `docs/superpowers/plans/2026-11-10-web-prueba-manual-resultados.md`:
tabla caso por caso (OK / falla / no probado y por qué), lista de hallazgos
ordenada por severidad con capturas, y lista de datos `QA-1110` que quedaron en la base.
