package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func nuevoEnvioHandlerDeTest(t *testing.T) (*EnvioHandler, *pgxpool.Pool) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	envioRepo := repository.NewEnvioRepo(pool)
	svc := services.NewEnvioService(pool, envioRepo)
	return NewEnvioHandler(svc), pool
}

func TestEnvioHandler_CreateDevuelve201(t *testing.T) {
	h, pool := nuevoEnvioHandlerDeTest(t)
	ctx := context.Background()

	body, _ := json.Marshal(map[string]any{
		"remitente":    map[string]string{"nombre": "Dep. Central"},
		"destinatario": map[string]string{"nombre": "Cliente Handler Test", "calle": "Belgrano", "numero": "10", "localidad": "San Francisco", "codigo_postal": "X2400"},
		"paquete":      map[string]any{"peso": 2.0, "tamano": "chico"},
	})
	req := httptest.NewRequest(http.MethodPost, "/envios", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Contains(t, resp["codigo_guia"], "MOV-")

	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", resp["id"])
	})
}

func TestEnvioHandler_CreateCamposFaltantesDevuelve400(t *testing.T) {
	h, _ := nuevoEnvioHandlerDeTest(t)

	body, _ := json.Marshal(map[string]any{})
	req := httptest.NewRequest(http.MethodPost, "/envios", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestEnvioHandler_GetByIDNoEncontradoDevuelve404(t *testing.T) {
	h, _ := nuevoEnvioHandlerDeTest(t)

	req := httptest.NewRequest(http.MethodGet, "/envios/00000000-0000-0000-0000-000000000000", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "00000000-0000-0000-0000-000000000000")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	rec := httptest.NewRecorder()

	h.GetByID(rec, req)

	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestEnvioHandler_ListDevuelve200(t *testing.T) {
	h, _ := nuevoEnvioHandlerDeTest(t)

	req := httptest.NewRequest(http.MethodGet, "/envios", nil)
	rec := httptest.NewRecorder()

	h.List(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
}
