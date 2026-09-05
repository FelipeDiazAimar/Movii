package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"
)

func tokenDePrueba(t *testing.T, secret, rol string) string {
	t.Helper()
	claims := jwt.MapClaims{"sub": "user-1", "rol": rol, "exp": time.Now().Add(time.Hour).Unix()}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := token.SignedString([]byte(secret))
	require.NoError(t, err)
	return s
}

func handlerDePrueba() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			http.Error(w, "sin claims", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(claims.Rol))
	})
}

func TestRequireAuth_SinHeaderDevuelve401(t *testing.T) {
	mw := RequireAuth("secreto")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	mw(handlerDePrueba()).ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestRequireAuth_TokenInvalidoDevuelve401(t *testing.T) {
	mw := RequireAuth("secreto")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer token-invalido")
	rec := httptest.NewRecorder()

	mw(handlerDePrueba()).ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestRequireAuth_TokenValidoContinua(t *testing.T) {
	mw := RequireAuth("secreto")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenDePrueba(t, "secreto", "supervisor"))
	rec := httptest.NewRecorder()

	mw(handlerDePrueba()).ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "supervisor", rec.Body.String())
}

func TestRequireRole_RolIncorrectoDevuelve403(t *testing.T) {
	auth := RequireAuth("secreto")
	role := RequireRole("supervisor")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenDePrueba(t, "secreto", "operador"))
	rec := httptest.NewRecorder()

	auth(role(handlerDePrueba())).ServeHTTP(rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)
}

func TestRequireRole_RolCorrectoContinua(t *testing.T) {
	auth := RequireAuth("secreto")
	role := RequireRole("supervisor", "operador")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenDePrueba(t, "secreto", "operador"))
	rec := httptest.NewRecorder()

	auth(role(handlerDePrueba())).ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
}
