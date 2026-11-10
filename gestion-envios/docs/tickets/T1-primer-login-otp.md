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
