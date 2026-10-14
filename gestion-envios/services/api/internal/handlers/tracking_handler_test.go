package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func nuevoTrackingHandlerDeTest(t *testing.T) *TrackingHandler {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	return NewTrackingHandler(services.NewTrackingService(repository.NewTrackingRepo(pool)))
}

// trackingRequest arma un GET /tracking/{codigo} con el path param
// inyectado como lo haría chi en producción.
func trackingRequest(codigo string) (*httptest.ResponseRecorder, *http.Request) {
	req := httptest.NewRequest(http.MethodGet, "/tracking/"+codigo, nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("codigo", codigo)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	return httptest.NewRecorder(), req
}

func TestTrackingHandler_FelizShapeExacta(t *testing.T) {
	h := nuevoTrackingHandlerDeTest(t)

	// Envío del seed (destinatario Juan Pérez, San Francisco).
	rec, req := trackingRequest("MOV-20260905-0001")
	h.PorCodigo(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "application/json", rec.Header().Get("Content-Type"))

	var raw map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &raw))
	require.Equal(t, "MOV-20260905-0001", raw["codigo_guia"])
	require.Equal(t, "asignado", raw["estado"])
	require.Equal(t, "San Francisco", raw["localidad"])
	require.Contains(t, raw, "actualizado_en")
	require.NotEmpty(t, raw["actualizado_en"])

	historial, ok := raw["historial"].([]any)
	require.True(t, ok, "historial debe ser un array JSON, no null")
	for _, evAny := range historial {
		ev, _ := evAny.(map[string]any)
		require.Contains(t, ev, "fecha")
		require.Contains(t, ev, "descripcion")
	}
}

func TestTrackingHandler_404Generico(t *testing.T) {
	h := nuevoTrackingHandlerDeTest(t)

	// Código inexistente Y código con formato raro: ambos 404 idénticos,
	// sin distinguir (no enumerar).
	for _, codigo := range []string{"MOV-20990101-9999", "!!!-formato-raro"} {
		rec, req := trackingRequest(codigo)
		h.PorCodigo(rec, req)

		require.Equal(t, http.StatusNotFound, rec.Code, "código %q", codigo)
		var raw map[string]any
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &raw))
		errObj, _ := raw["error"].(map[string]any)
		require.Equal(t, "no_encontrado", errObj["code"])
		require.Equal(t, "no se encontró ningún envío con ese código", errObj["message"])
	}
}

func TestTrackingHandler_NoLeak(t *testing.T) {
	h := nuevoTrackingHandlerDeTest(t)

	// MOV-20260905-0001 tiene teléfono, calle, número y email cargados en
	// el seed: ninguna de esas keys puede aparecer en el JSON.
	rec, req := trackingRequest("MOV-20260905-0001")
	h.PorCodigo(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	crudo := rec.Body.String()
	for _, key := range []string{`"telefono"`, `"email"`, `"calle"`, `"numero"`, `"actor_nombre"`, `"comentario"`, `"repartidor"`, `"direccion"`} {
		require.NotContains(t, crudo, key, "el tracking público no debe exponer %s", key)
	}

	var raw map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &raw))
	require.NotContains(t, strings.ToLower(crudo), "juan pérez")
	require.NotContains(t, crudo, "3564-200200")

	// Las keys sensibles tampoco pueden colarse dentro de cada item del
	// historial.
	historial, _ := raw["historial"].([]any)
	for _, evAny := range historial {
		evJSON, err := json.Marshal(evAny)
		require.NoError(t, err)
		for _, key := range []string{`"telefono"`, `"email"`, `"actor"`, `"comentario"`, `"foto"`} {
			require.NotContains(t, string(evJSON), key)
		}
	}
}
