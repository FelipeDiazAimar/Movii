package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"
)

// RequireAuth solo debe aceptar tokens firmados con HS256, que es el algoritmo
// con el que AuthService firma. Aceptar el algoritmo que declara el propio
// token es la puerta de entrada a los ataques de confusión de algoritmo
// (CA-05 de HU-01: cada endpoint protegido valida el token).
func TestRequireAuth_RechazaTokenConAlgoritmoDistinto(t *testing.T) {
	claims := jwt.MapClaims{"sub": "user-1", "rol": "supervisor", "exp": time.Now().Add(time.Hour).Unix()}
	token := jwt.NewWithClaims(jwt.SigningMethodHS512, claims)
	firmado, err := token.SignedString([]byte("secreto"))
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+firmado)
	rec := httptest.NewRecorder()

	RequireAuth("secreto")(handlerDePrueba()).ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

// Un token sin firma ("alg": "none") tampoco puede pasar.
func TestRequireAuth_RechazaTokenSinFirma(t *testing.T) {
	claims := jwt.MapClaims{"sub": "user-1", "rol": "supervisor", "exp": time.Now().Add(time.Hour).Unix()}
	token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
	firmado, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+firmado)
	rec := httptest.NewRecorder()

	RequireAuth("secreto")(handlerDePrueba()).ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}
