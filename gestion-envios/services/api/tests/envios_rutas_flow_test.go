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

func TestFlujoCompleto_EnvioRutaYAsignacion(t *testing.T) {
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
		CORSOrigins:     []string{"*"},
		JWTSecret:       "secreto-de-test",
		AuthHandler:     handlers.NewAuthHandler(authService),
		UsuariosHandler: handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:    handlers.NewEnvioHandler(services.NewEnvioService(pool, envioRepo, repository.NewEventoRepo(pool))),
		RutaHandler:     handlers.NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo)),
	})

	// 0. Login como operador de la demo.
	loginBody, _ := json.Marshal(map[string]string{"email": "operador@movii.demo", "password": "Movii2026!"})
	loginReq := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody))
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)
	require.Equal(t, http.StatusOK, loginRec.Code)
	var loginResp map[string]string
	require.NoError(t, json.Unmarshal(loginRec.Body.Bytes(), &loginResp))
	token := loginResp["token"]

	// 1. Registrar un envío.
	envioBody, _ := json.Marshal(map[string]any{
		"remitente":    map[string]string{"nombre": "Dep. Flujo Test"},
		"destinatario": map[string]string{"nombre": "Cliente Flujo Test", "calle": "Mitre", "numero": "200", "localidad": "San Francisco", "codigo_postal": "X2400"},
		"paquete":      map[string]any{"peso": 5.0, "tamano": "mediano"},
	})
	envioReq := httptest.NewRequest(http.MethodPost, "/envios", bytes.NewReader(envioBody))
	envioReq.Header.Set("Authorization", "Bearer "+token)
	envioRec := httptest.NewRecorder()
	router.ServeHTTP(envioRec, envioReq)
	require.Equal(t, http.StatusCreated, envioRec.Code)
	var envioResp map[string]any
	require.NoError(t, json.Unmarshal(envioRec.Body.Bytes(), &envioResp))
	envioID := envioResp["id"].(string)

	// 2. Crear una ruta para una fecha futura (no vencida).
	var repartidorID string
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))
	rutaBody, _ := json.Marshal(map[string]string{
		"nombre": "Ruta Flujo Test", "zona": "Centro", "fecha": "2026-12-31", "repartidor_id": repartidorID,
	})
	rutaReq := httptest.NewRequest(http.MethodPost, "/rutas", bytes.NewReader(rutaBody))
	rutaReq.Header.Set("Authorization", "Bearer "+token)
	rutaRec := httptest.NewRecorder()
	router.ServeHTTP(rutaRec, rutaReq)
	require.Equal(t, http.StatusCreated, rutaRec.Code)
	var rutaResp map[string]any
	require.NoError(t, json.Unmarshal(rutaRec.Body.Bytes(), &rutaResp))
	rutaID := rutaResp["id"].(string)

	// 3. Asignar el envío a la ruta.
	asigBody, _ := json.Marshal(map[string]any{"envio_ids": []string{envioID}})
	asigReq := httptest.NewRequest(http.MethodPost, "/rutas/"+rutaID+"/envios", bytes.NewReader(asigBody))
	asigReq.Header.Set("Authorization", "Bearer "+token)
	asigRec := httptest.NewRecorder()
	router.ServeHTTP(asigRec, asigReq)
	require.Equal(t, http.StatusOK, asigRec.Code)

	// 4. Ver el detalle de la ruta: debe tener 1 envío y el peso total.
	detalleReq := httptest.NewRequest(http.MethodGet, "/rutas/"+rutaID, nil)
	detalleReq.Header.Set("Authorization", "Bearer "+token)
	detalleRec := httptest.NewRecorder()
	router.ServeHTTP(detalleRec, detalleReq)
	require.Equal(t, http.StatusOK, detalleRec.Code)
	var detalleResp map[string]any
	require.NoError(t, json.Unmarshal(detalleRec.Body.Bytes(), &detalleResp))
	require.Equal(t, float64(1), detalleResp["cantidad_envios"])
	require.Equal(t, float64(5), detalleResp["peso_total"])

	// 5. Desasignar el envío.
	desasigReq := httptest.NewRequest(http.MethodDelete, "/rutas/"+rutaID+"/envios/"+envioID, nil)
	desasigReq.Header.Set("Authorization", "Bearer "+token)
	desasigRec := httptest.NewRecorder()
	router.ServeHTTP(desasigRec, desasigReq)
	require.Equal(t, http.StatusOK, desasigRec.Code)

	// Limpieza.
	_, _ = pool.Exec(t.Context(), "DELETE FROM rutas WHERE id = $1", rutaID)
	var remitenteID, destinatarioID string
	_ = pool.QueryRow(t.Context(), "SELECT remitente_id, destinatario_id FROM envios WHERE id = $1", envioID).Scan(&remitenteID, &destinatarioID)
	_, _ = pool.Exec(t.Context(), "DELETE FROM envios WHERE id = $1", envioID)
	_, _ = pool.Exec(t.Context(), "DELETE FROM remitentes WHERE id = $1", remitenteID)
	_, _ = pool.Exec(t.Context(), "DELETE FROM destinatarios WHERE id = $1", destinatarioID)
}
