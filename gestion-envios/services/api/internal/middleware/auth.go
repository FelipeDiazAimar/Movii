package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"

	httpx "movii/api/internal/platform/http"
)

type contextKey string

const claimsKey contextKey = "claims"

// Claims son los datos del usuario autenticado extraídos del JWT.
type Claims struct {
	UsuarioID string
	Rol       string
}

// ClaimsFromContext recupera las Claims guardadas por RequireAuth.
func ClaimsFromContext(ctx context.Context) (Claims, bool) {
	c, ok := ctx.Value(claimsKey).(Claims)
	return c, ok
}

// RequireAuth valida el JWT del header Authorization: Bearer <token> y
// guarda las Claims en el contexto de la request.
func RequireAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			tokenStr := strings.TrimPrefix(header, "Bearer ")
			if header == "" || tokenStr == header {
				httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta el header Authorization")
				return
			}

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
				return []byte(jwtSecret), nil
			})
			if err != nil || !token.Valid {
				httpx.WriteError(w, http.StatusUnauthorized, "token_invalido", "el token es inválido o expiró")
				return
			}

			claimsMap, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				httpx.WriteError(w, http.StatusUnauthorized, "token_invalido", "el token es inválido")
				return
			}

			claims := Claims{
				UsuarioID: toString(claimsMap["sub"]),
				Rol:       toString(claimsMap["rol"]),
			}
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole exige que el usuario autenticado tenga uno de los roles dados.
// Debe montarse después de RequireAuth.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	permitido := make(map[string]bool, len(roles))
	for _, r := range roles {
		permitido[r] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok || !permitido[claims.Rol] {
				httpx.WriteError(w, http.StatusForbidden, "rol_no_autorizado", "no tenés permisos para esta acción")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func toString(v interface{}) string {
	s, _ := v.(string)
	return s
}

// ContextWithClaims agrega Claims al contexto manualmente. Pensada para
// tests y para cualquier código que necesite construir un contexto con
// claims sin pasar por RequireAuth/un JWT real.
func ContextWithClaims(ctx context.Context, c Claims) context.Context {
	return context.WithValue(ctx, claimsKey, c)
}
