package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func TestFlujoCompleto_EnviosDelDiaDelRepartidor(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}

	pool, err := db.New(t.Context(), url)
	require.NoError(t, err)
	defer pool.Close()

	usuarioRepo := repository.NewUsuarioRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)
	authService := services.NewAuthService(usuarioRepo, "secreto-de-test")
	router := httprouter.New(httprouter.Deps{
		CORSOrigins:       []string{"*"},
		JWTSecret:         "secreto-de-test",
		AuthHandler:       handlers.NewAuthHandler(authService),
		UsuariosHandler:   handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:      handlers.NewEnvioHandler(services.NewEnvioService(pool, envioRepo, repository.NewEventoRepo(pool))),
		RutaHandler:       handlers.NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo)),
		RepartidorHandler: handlers.NewRepartidorHandler(services.NewRepartidorService(envioRepo)),
	})

	// 0. Login como repartidor de la demo.
	loginBody, _ := json.Marshal(map[string]string{"email": "repartidor@movii.demo", "password": "Movii2026!"})
	loginReq := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody))
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)
	require.Equal(t, http.StatusOK, loginRec.Code)
	var loginResp map[string]string
	require.NoError(t, json.Unmarshal(loginRec.Body.Bytes(), &loginResp))
	token := loginResp["token"]

	// 1. Pedir el listado del día como repartidor: debe dar 200.
	req := httptest.NewRequest(http.MethodGet, "/repartidor/envios-del-dia", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Contains(t, resp, "rutas")

	// 2. Un operador (rol distinto) NO puede acceder a este endpoint: 403.
	loginOpBody, _ := json.Marshal(map[string]string{"email": "operador@movii.demo", "password": "Movii2026!"})
	loginOpReq := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginOpBody))
	loginOpRec := httptest.NewRecorder()
	router.ServeHTTP(loginOpRec, loginOpReq)
	require.Equal(t, http.StatusOK, loginOpRec.Code)
	var loginOpResp map[string]string
	require.NoError(t, json.Unmarshal(loginOpRec.Body.Bytes(), &loginOpResp))
	tokenOperador := loginOpResp["token"]

	reqOperador := httptest.NewRequest(http.MethodGet, "/repartidor/envios-del-dia", nil)
	reqOperador.Header.Set("Authorization", "Bearer "+tokenOperador)
	recOperador := httptest.NewRecorder()
	router.ServeHTTP(recOperador, reqOperador)
	require.Equal(t, http.StatusForbidden, recOperador.Code)
}
