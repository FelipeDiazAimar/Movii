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
