package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/middleware"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func nuevoRepartidorHandlerDeTest(t *testing.T) (*RepartidorHandler, *pgxpool.Pool, string) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	var repartidorID string
	err = pool.QueryRow(context.Background(), "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	envioRepo := repository.NewEnvioRepo(pool)
	h := NewRepartidorHandler(services.NewRepartidorService(envioRepo))
	return h, pool, repartidorID
}

// conClaimsDeRepartidor simula lo que RequireAuth deja en el contexto,
// sin pasar por un JWT real.
func conClaimsDeRepartidor(req *http.Request, usuarioID string) *http.Request {
	return req.WithContext(middleware.ContextWithClaims(req.Context(), middleware.Claims{UsuarioID: usuarioID, Rol: "repartidor"}))
}

func TestRepartidorHandler_EnviosDelDiaDevuelve200(t *testing.T) {
	h, _, repartidorID := nuevoRepartidorHandlerDeTest(t)

	req := httptest.NewRequest(http.MethodGet, "/repartidor/envios-del-dia", nil)
	req = conClaimsDeRepartidor(req, repartidorID)
	rec := httptest.NewRecorder()

	h.EnviosDelDia(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Contains(t, resp, "rutas")
	require.Contains(t, resp, "total")
}
