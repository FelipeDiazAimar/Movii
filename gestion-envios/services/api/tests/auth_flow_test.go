package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func TestFlujoCompleto_RegistroLoginYListadoDeUsuarios(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	pool, err := db.New(t.Context(), url)
	require.NoError(t, err)
	defer pool.Close()

	usuarioRepo := repository.NewUsuarioRepo(pool)
	authService := services.NewAuthService(usuarioRepo, "secreto-de-test")
	router := httprouter.New(httprouter.Deps{
		CORSOrigins:     []string{"*"},
		JWTSecret:       "secreto-de-test",
		AuthHandler:     handlers.NewAuthHandler(authService),
		UsuariosHandler: handlers.NewUsuariosHandler(usuarioRepo),
	})

	// 1. Registrar un supervisor nuevo.
	regBody, _ := json.Marshal(map[string]string{
		"nombre": "Flujo Test", "email": "flujo-test@movii.demo",
		"password": "clave-segura-123", "rol": domain.RolSupervisor,
	})
	regReq := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(regBody))
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)
	require.Equal(t, http.StatusCreated, regRec.Code)

	// 2. Loguearse y obtener el token.
	loginBody, _ := json.Marshal(map[string]string{"email": "flujo-test@movii.demo", "password": "clave-segura-123"})
	loginReq := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody))
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)
	require.Equal(t, http.StatusOK, loginRec.Code)

	var loginResp map[string]string
	require.NoError(t, json.Unmarshal(loginRec.Body.Bytes(), &loginResp))
	token := loginResp["token"]
	require.NotEmpty(t, token)

	// 3. Usar el token para listar usuarios (requiere rol supervisor).
	listReq := httptest.NewRequest(http.MethodGet, "/users", nil)
	listReq.Header.Set("Authorization", "Bearer "+token)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	require.Equal(t, http.StatusOK, listRec.Code)

	// 4. Sin token, /users debe devolver 401.
	sinTokenReq := httptest.NewRequest(http.MethodGet, "/users", nil)
	sinTokenRec := httptest.NewRecorder()
	router.ServeHTTP(sinTokenRec, sinTokenReq)
	require.Equal(t, http.StatusUnauthorized, sinTokenRec.Code)

	// Limpieza.
	_, _ = pool.Exec(t.Context(), "DELETE FROM usuarios WHERE email = $1", "flujo-test@movii.demo")
}
