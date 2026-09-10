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
	eventoRepo := repository.NewEventoRepo(pool)
	svc := services.NewEnvioService(pool, envioRepo, eventoRepo, repository.NewConfirmacionRepo(pool))
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

// TestEnvioHandler_GetByIDIncluyeHistorialVacio: un envío recién creado no
// tiene eventos; el JSON debe traer "historial": [] (array vacío, nunca
// null) junto a los campos existentes — Task 5, HU-06/HU-07.
func TestEnvioHandler_GetByIDIncluyeEventoRaiz(t *testing.T) {
	h, pool := nuevoEnvioHandlerDeTest(t)
	ctx := context.Background()

	body, _ := json.Marshal(map[string]any{
		"remitente":    map[string]string{"nombre": "Dep. Central"},
		"destinatario": map[string]string{"nombre": "Cliente Historial Vacío", "calle": "Belgrano", "numero": "10", "localidad": "San Francisco", "codigo_postal": "X2400"},
		"paquete":      map[string]any{"peso": 2.0, "tamano": "chico"},
	})
	createReq := httptest.NewRequest(http.MethodPost, "/envios", bytes.NewReader(body))
	createRec := httptest.NewRecorder()
	h.Create(createRec, createReq)
	require.Equal(t, http.StatusCreated, createRec.Code)
	var created map[string]any
	require.NoError(t, json.Unmarshal(createRec.Body.Bytes(), &created))
	id, _ := created["id"].(string)
	require.NotEmpty(t, id)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", id)
	})

	req := httptest.NewRequest(http.MethodGet, "/envios/"+id, nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", id)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	rec := httptest.NewRecorder()

	h.GetByID(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var raw map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &raw))
	require.Contains(t, raw, "historial", "el detalle debe incluir historial (openapi EnvioDetalle)")
	historial, ok := raw["historial"].([]any)
	require.True(t, ok, "historial debe ser un array JSON, no null")
	// HU-10, Task 1: el alta registra el evento raíz (anterior=nil,
	// nuevo=pendiente), así que el detalle de un envío nuevo ya no sale vacío.
	require.Len(t, historial, 1)
	raiz, _ := historial[0].(map[string]any)
	require.Equal(t, "pendiente", raiz["estado_nuevo"])
	require.Nil(t, raiz["estado_anterior"])
	// Campos preexistentes intactos (aditivo, sin regresión).
	require.Equal(t, id, raw["id"])
	require.Contains(t, raw, "destinatario")
	require.Contains(t, raw, "fecha_creacion")
}

// TestEnvioHandler_GetByIDIncluyeHistorialConEventos: tras registrar una
// transición, el detalle la expone en historial — Task 5, HU-06/HU-07.
func TestEnvioHandler_GetByIDIncluyeHistorialConEventos(t *testing.T) {
	h, pool := nuevoEnvioHandlerDeTest(t)
	ctx := context.Background()
	eventos := repository.NewEventoRepo(pool)

	body, _ := json.Marshal(map[string]any{
		"remitente":    map[string]string{"nombre": "Dep. Central"},
		"destinatario": map[string]string{"nombre": "Cliente Historial Lleno", "calle": "Mitre", "numero": "20", "localidad": "San Francisco", "codigo_postal": "X2400"},
		"paquete":      map[string]any{"peso": 3.0, "tamano": "mediano"},
	})
	createReq := httptest.NewRequest(http.MethodPost, "/envios", bytes.NewReader(body))
	createRec := httptest.NewRecorder()
	h.Create(createRec, createReq)
	require.Equal(t, http.StatusCreated, createRec.Code)
	var created map[string]any
	require.NoError(t, json.Unmarshal(createRec.Body.Bytes(), &created))
	id, _ := created["id"].(string)
	require.NotEmpty(t, id)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM eventos_envio WHERE envio_id = $1", id)
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", id)
	})

	anterior := "asignado"
	require.NoError(t, eventos.Registrar(ctx, pool, id, &anterior, "en_camino", nil, nil, nil, nil))

	req := httptest.NewRequest(http.MethodGet, "/envios/"+id, nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", id)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	rec := httptest.NewRecorder()

	h.GetByID(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var raw map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &raw))
	historial, ok := raw["historial"].([]any)
	require.True(t, ok, "historial debe ser un array JSON")
	// HU-10, Task 1: el alta deja el evento raíz + la transición registrada.
	require.Len(t, historial, 2)
	nuevos := make(map[string]bool, 2)
	for _, evAny := range historial {
		ev, _ := evAny.(map[string]any)
		nuevo, _ := ev["estado_nuevo"].(string)
		nuevos[nuevo] = true
	}
	require.True(t, nuevos["pendiente"], "falta el evento raíz: %v", historial)
	require.True(t, nuevos["en_camino"], "falta la transición: %v", historial)
}
