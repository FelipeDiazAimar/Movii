# Movii — Tickets para el dev (T1-T5)

Orden sugerido: T3 → T1 → T2 → T4 → T5

---
# T1 — Primer login: cambio obligatorio + OTP WhatsApp con fallback a mail

**Prioridad:** Alta | **Tipo:** Feature / Seguridad

## Historia
Como usuario nuevo con password quiero que en mi primer login se me exija cambiar la contraseña y validar un código, para asegurar mi cuenta.

## Estado actual
Ya existe 2FA WhatsApp propio: `services/api/internal/platform/whatsapp/cliente.go` (whatsmeow), `services.NewOTPService`, tabla `codigos_otp`, `AuthHandler.ConSegundoFactor`. No existe `must_change_password` ni fallback a mail.

## Alcance
### Backend `services/api`
- Migración: `ALTER TABLE usuarios ADD COLUMN must_change_password BOOL DEFAULT TRUE` (para nuevos). Al crear usuario por admin/API poner `TRUE`.
- `POST /auth/login`: si `must_change_password=true` → `428 {code:"must_change_password", user_id}` sin JWT útil.
- Nuevo `POST /auth/primer-acceso/cambiar-password {user_id, nueva_password}` → valida reglas (min 8, 1 mayús, 1 número), hashea, mantiene flag en `true` hasta OTP ok.
- Reusar `OTPService.Iniciar/Verificar/Reenviar`: si `telefono != null` → WhatsApp (actual). Si `null/vacío` → mail con servicio gratuito (Resend free tier, env `RESEND_API_KEY` + `MAIL_FROM`). OTP 6 dígitos, 10 min, 3 intentos, rate-limit 1/min.
- Nuevo `POST /auth/primer-acceso/verificar {desafio_id, codigo}` → si ok: `must_change_password=false` + JWT normal.
- OAuth (T2) saltea cambio pero igual pide OTP si es primer acceso.

### Frontend `apps/web`
- Nueva ruta `/primer-acceso`: Paso 1 nueva pass (2 campos + validación Zod), Paso 2 input código 6 dígitos + "Reenviar" + texto canal usado: "WhatsApp al ***123" / "mail a ***@...".
- `features/auth/api.ts`: `cambiarPasswordPrimerAcceso()`, `verificarPrimerAcceso()`.

## Criterios de aceptación
1. Usuario nuevo no puede llamar a `/envios`, `/rutas`, `/users` hasta completar flujo.
2. Con teléfono → llega WhatsApp; sin teléfono → llega mail en <60s.
3. Código vencido / 3 fallos → error claro + permite reenviar (invalida anterior).
4. Tests: `login_primer_acceso_test.go` cubre ambos canales + flag.

## Fuera de alcance
Recuperar contraseña olvidada, cambio de teléfono en este flujo.

## Env nuevas
`RESEND_API_KEY`, `MAIL_FROM`, `OTP_TTL_MIN=10`, `OTP_MAX_INTENTOS=3`

# T2 — Login con Google (OAuth2)

**Prioridad:** Media | **Tipo:** Feature

## Historia
Como usuario quiero loguearme con Google para no usar contraseña.

## Alcance
### Backend `services/api`
- `GET /auth/google` → redirect a Google (scopes `openid email profile`).
- `GET /auth/google/callback?code=` → valida, busca por email:
  - Existe → linkea `google_id` si vacío, `must_change_password=false`, devuelve JWT (si es primer acceso igual dispara OTP según T1).
  - No existe → crea con rol `operador` por defecto, `must_change_password=false`, `auth_provider=google`.
- Si email es `repartidor` mantiene regla actual: web muestra aviso "usá la app móvil".
- Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.

### Frontend `apps/web`
- Botón "Continuar con Google" en `/login` (`features/auth/LoginPage`). Maneja `?error=google_denied`.

### Mobile `apps/mobile`
- `expo-auth-session` contra mismo `GET /auth/google`, guarda JWT en SecureStore.

## Criterios de aceptación
1. Login nuevo crea usuario operador y entra en <5s.
2. Login existente por mail linkea y conserva rol.
3. Cancelar en Google → vuelve a `/login?error=cancelado` sin crash.
4. Sin `GOOGLE_*` configurado el botón se oculta (feature flag).

## Fuera de alcance
Microsoft/Apple login, restricción por dominio (si se pide después: `ALLOWED_DOMAINS`).

# T3 — Solo admin puede eliminar (borrado físico) + rename supervisor→admin

**Prioridad:** Media-Alta | **Tipo:** Feature breaking / Refactor

## Historia
Como admin quiero ser el único que puede eliminar rutas, usuarios y envíos.

## Decisión
Borrado **físico** (`DELETE` real). Rename total: `supervisor` desaparece de DB/API/UI → `admin`.

## Alcance
### Backend `services/api`
- Migración: rename enum/valor `supervisor`→`admin` en `usuarios.rol` + datos. Actualizar `domain.RolSupervisor`→`RolAdmin`, `internal/httprouter/router.go` `allow=["admin"]`.
- Nuevos:
  - `DELETE /rutas/:id` solo admin. Bloquear `423` si estado `en_curso`.
  - `DELETE /envios/:id` solo admin. Bloquear si `ruta_id != null` o estado `en_camino/entregado`.
  - `DELETE /users/:id` solo admin. Bloquear auto-borrado y último admin.
- `GET /users` sigue solo admin (ya era así). Operador que llama a DELETE → `403`.
- ⚠️ FKs con `ON DELETE RESTRICT`. Backup previo obligatorio.

### Frontend `apps/web`
- `src/App.tsx`: `ProtectedRoute allow={["admin"]}`.
- `src/components/layout/AppLayout.tsx`: `type Rol="operador"|"admin"`, menú Usuarios/WhatsApp solo admin.
- `features/usuarios/api.ts`, `RepartidorSelect`, páginas `Rutas/Envios/Usuarios`: botón Eliminar solo si `rol==="admin"` + modal confirm con nombre + llamada DELETE.
- Buscar/reemplazar `supervisor` en web, mobile, `supabase/seeds`, docs.

## Criterios de aceptación
1. Operador no ve botones Eliminar; por API recibe `403`.
2. Admin elimina ruta `planificada`, envío `pendiente`, usuario inactivo.
3. Intentar borrar ruta en curso / envío asignado → error claro, no borra.
4. `grep -r supervisor` da 0 resultados (salvo histórico en migraciones viejas).
5. Tests: `delete_rbac_test.go` (operador 403, admin 204, bloqueos 423).

## Fuera de alcance
Papelera / restaurar, auditoría (proponer como T3-bis).

# T4 — Validar dirección al asignar + recomendar por distancia

**Prioridad:** Alta | **Tipo:** Feature

## Historia
Como operador quiero que al asignar un pedido a una ruta se valide la dirección y me diga si conviene por distancia.

## Estado actual
Asignación en `/rutas/:id` (HU-04) no valida dirección. Ya existe `internal/platform/geo/` (usar de base).

## Alcance
### Backend `services/api`
- Interfaz `GeoProvider { Geocodificar(dir)->{lat,lon,confianza}, Matriz(origen,destinos)->km/min }`.
- Impl inicial gratis: Nominatim (geocode) + OSRM `router.project-osrm.org` (route/table). Dejar enchufable Google Distance Matrix (`GOOGLE_MAPS_KEY` opcional).
- Nuevo `POST /rutas/:id/recomendar {envio_id}`:
  - Geocodifica dirección envío + paradas actuales ruta. Si `confianza<0.6` o null → `422 {code:"direccion_invalida"}`.
  - Calcula `extra_km` y `desvio_%` = extra / largo actual.
  - Regla inicial: `<2km o <15% = conviene`, `>5km o >40% = no_conviene`, resto `dudoso`. Devuelve `{extra_km, desvio_pct, recomendacion, motivo}`.
- `POST /rutas/:id/envios` ahora exige `direccion_valida=true` (o llama a recomendar por dentro). Si `no_conviene` exige `{forzar:true}` + log.

### Frontend `apps/web`
- En panel asignación: al seleccionar envío muestra badge: verde "Conviene (+1.2km, +8%)" / amarillo "Dudoso" / rojo "No conviene (+9km, fuera de zona)". Botón Asignar deshabilitado si dirección inválida; si rojo pide checkbox "Asignar igual".

## Criterios de aceptación
1. Dirección vacía/inexistente → error `422` y no asigna.
2. Pedido a 1km → verde, asigna directo. Pedido a 15km → rojo, exige confirmar.
3. Sin internet a OSRM → mensaje "sin recomendación" pero permite asignar (degradado).
4. Tests: `recomendar_test.go` con 3 casos (cerca/lejos/inválida). Cache geocode 24h.

## Env nuevas
`GEO_PROVIDER=osrm`, `GOOGLE_MAPS_KEY` (opcional), `RECOMIENDA_UMBRAL_OK_KM=2`, `RECOMIENDA_UMBRAL_NO_KM=5`

# T5 — Vista 3D rutas en web + botón Abrir en Google Maps

**Prioridad:** Baja (Spike 3-5d) + MVP | **Tipo:** Spike + Feature

## Historia
Como operador quiero ver en 3D cada ruta y dónde va cada repartidor. Como repartidor quiero abrir la ruta en Maps con 1 toque.

## Aclaración importante
Los archivos `reference.mp4`, `map-flight.mp4`, `new-york-camera.esp` y Prompts A/B/C son pipeline de **video promo** (Earth Studio + `camera.json/route.json` + render frame-by-frame). No sirven para tiempo real. No replicar eso en la app. La vista 3D real va con Mapbox 3D / Google 3D Tiles + posición en vivo.

## Alcance
### A) Spike 3D solo web (no móvil)
- Nueva ruta `/rutas/:id/3d` con toggle 2D/3D.
- Evaluar y elegir (doc `docs/decisions/3d-mapas.md`): Mapbox GL JS `freeCamera+terrain` vs Google Photorealistic 3D Tiles (Cesium/deck.gl). Criterio: costo/cuota, perf, créditos visibles.
- Dibuja: ruta OSRM (línea azul `#2F7FF5`), paradas, dot repartidor (posición simulada o `WS /rutas/:id/live` cada 5s si ya hay GPS). Controles tilt/bearing. Fallback 2D si sin WebGL.

### B) Botón Abrir en Google Maps (web + móvil)
- Web en detalle ruta + móvil en ficha entrega: botón "Abrir en Maps".
- Genera `https://www.google.com/maps/dir/?api=1&origin=..&destination=proxima_parada&waypoints=..&travelmode=driving`.
- Modos: "Próximo destino" (default) y "Ruta completa". En móvil usa `Linking.openURL` (abre app nativa), en web `target=_blank`.

## Criterios de aceptación
1. Toggle 3D carga <3s en desktop, no tapa créditos del mapa.
2. Dot repartidor se mueve (aunque sea simulado en spike).
3. Botón Maps abre ruta correcta con 2+ paradas (testeado en Android + web).
4. Doc decisión + demo deployada para aprobar MVP.

## Fuera de alcance
Seguimiento cada 1s, Earth Studio en prod, navegación turn-by-turn propia.

