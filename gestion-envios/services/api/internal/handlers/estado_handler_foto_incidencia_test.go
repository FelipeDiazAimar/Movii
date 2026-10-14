package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/middleware"
)

// Tests de Task 1, Paso 2 (HU-07 cierre):
// GET /envios/{id}/eventos/{eventoId}/foto.

var fotoIncidenciaHandlerDeTest = []byte{0xFF, 0xD8, 0xFF, 0x00, 0x01}

// estadoFotoRequestDeTest arma una request con {id} y {eventoId} en la ruta
// chi y claims en el contexto (extiende estadoRequestDeTest, que solo pone
// {id}).
func estadoFotoRequestDeTest(t *testing.T, metodo, ruta, envioID, eventoID, usuarioID, rol string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(metodo, ruta, bytes.NewReader([]byte{}))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", envioID)
	rctx.URLParams.Add("eventoId", eventoID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	return req.WithContext(middleware.ContextWithClaims(req.Context(), middleware.Claims{UsuarioID: usuarioID, Rol: rol}))
}

// incidenciaConFotoHandlerDeTest registra una incidencia con o sin foto vía
// el service y devuelve el envío y el ID del evento de incidencia.
func incidenciaConFotoHandlerDeTest(t *testing.T, h *EstadoHandler, pool *pgxpool.Pool, repartidorID string, foto []byte) (envioID, eventoID string) {
	t.Helper()
	ctx := context.Background()

	envioID = crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
	_, err := h.svc.RegistrarIncidencia(ctx, envioID, domain.MotivoClienteAusente, "nadie atendió", foto, repartidorID, domain.RolRepartidor)
	require.NoError(t, err)
	err = pool.QueryRow(ctx, "SELECT id FROM eventos_envio WHERE envio_id = $1 AND estado_nuevo = 'no_entregado'", envioID).Scan(&eventoID)
	require.NoError(t, err)
	return envioID, eventoID
}

func TestEstadoHandler_DescargarFotoIncidenciaFeliz(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID, eventoID := incidenciaConFotoHandlerDeTest(t, h, pool, repartidorID, fotoIncidenciaHandlerDeTest)

	req := estadoFotoRequestDeTest(t, http.MethodGet, "/envios/"+envioID+"/eventos/"+eventoID+"/foto", envioID, eventoID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.DescargarFotoIncidencia(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "image/jpeg", rec.Header().Get("Content-Type"))
	require.Equal(t, fotoIncidenciaHandlerDeTest, rec.Body.Bytes())
}

func TestEstadoHandler_DescargarFotoIncidencia404(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	t.Run("evento sin foto", func(t *testing.T) {
		envioID, eventoID := incidenciaConFotoHandlerDeTest(t, h, pool, repartidorID, nil)

		req := estadoFotoRequestDeTest(t, http.MethodGet, "/envios/"+envioID+"/eventos/"+eventoID+"/foto", envioID, eventoID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()
		h.DescargarFotoIncidencia(rec, req)

		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))
	})

	t.Run("evento de otro envio", func(t *testing.T) {
		_, eventoID := incidenciaConFotoHandlerDeTest(t, h, pool, repartidorID, fotoIncidenciaHandlerDeTest)
		otroEnvio := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

		req := estadoFotoRequestDeTest(t, http.MethodGet, "/envios/"+otroEnvio+"/eventos/"+eventoID+"/foto", otroEnvio, eventoID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()
		h.DescargarFotoIncidencia(rec, req)

		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))
	})

	t.Run("evento inexistente", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		inexistente := "00000000-0000-0000-0000-000000000000"

		req := estadoFotoRequestDeTest(t, http.MethodGet, "/envios/"+envioID+"/eventos/"+inexistente+"/foto", envioID, inexistente, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()
		h.DescargarFotoIncidencia(rec, req)

		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))
	})

	t.Run("repartidor ajeno", func(t *testing.T) {
		envioID, eventoID := incidenciaConFotoHandlerDeTest(t, h, pool, repartidorID, fotoIncidenciaHandlerDeTest)
		ajeno := "00000000-0000-0000-0000-000000000000"

		req := estadoFotoRequestDeTest(t, http.MethodGet, "/envios/"+envioID+"/eventos/"+eventoID+"/foto", envioID, eventoID, ajeno, domain.RolRepartidor)
		rec := httptest.NewRecorder()
		h.DescargarFotoIncidencia(rec, req)

		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))
	})
}

func TestEstadoHandler_DescargarFotoIncidenciaSinToken401(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID, eventoID := incidenciaConFotoHandlerDeTest(t, h, pool, repartidorID, fotoIncidenciaHandlerDeTest)

	req := httptest.NewRequest(http.MethodGet, "/envios/"+envioID+"/eventos/"+eventoID+"/foto", bytes.NewReader([]byte{}))
	rec := httptest.NewRecorder()

	h.DescargarFotoIncidencia(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
	require.Equal(t, "sin_token", codigoErrorDeTest(t, rec))
}
