package httprouter

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/handlers"
)

func tokenDe(t *testing.T, rol string) string {
	t.Helper()
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "00000000-0000-0000-0000-000000000001", "rol": rol, "exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString([]byte("s"))
	require.NoError(t, err)
	return tok
}

// Los borrados son solo admin: operador y repartidor reciben 403 antes de tocar la base.
func TestDelete_SoloAdmin(t *testing.T) {
	h := New(Deps{JWTSecret: "s", CORSOrigins: []string{"*"}, EliminarHandler: handlers.NewEliminarHandler(nil)})
	id := "11111111-1111-1111-1111-111111111111"
	for _, rol := range []string{domain.RolOperador, domain.RolRepartidor} {
		for _, path := range []string{"/rutas/" + id, "/envios/" + id, "/users/" + id, "/vehiculos/" + id} {
			req := httptest.NewRequest(http.MethodDelete, path, nil)
			req.Header.Set("Authorization", "Bearer "+tokenDe(t, rol))
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			require.Equal(t, http.StatusForbidden, rec.Code, "%s %s", rol, path)
		}
	}
}
