package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/middleware"
	"movii/api/internal/repository"
	"movii/api/internal/services"
	_ "movii/api/internal/testenv"
)

func nuevoEstadoHandlerDeTest(t *testing.T) (*EstadoHandler, *pgxpool.Pool, string, string) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	ctx := context.Background()
	var repartidorID, operadorID string
	err = pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)
	err = pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'operador@movii.demo'").Scan(&operadorID)
	require.NoError(t, err)

	envioRepo := repository.NewEnvioRepo(pool)
	eventoRepo := repository.NewEventoRepo(pool)
	return NewEstadoHandler(services.NewEstadoService(pool, envioRepo, eventoRepo)), pool, repartidorID, operadorID
}

// crearEnvioAsignadoHandlerDeTest crea un envío en estado asignado en una
// ruta del repartidor dado y devuelve su ID. Limpia todo al final del test.
func crearEnvioAsignadoHandlerDeTest(t *testing.T, pool *pgxpool.Pool, repartidorID string) string {
	t.Helper()
	ctx := context.Background()

	rem, err := repository.CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem Estado H"})
	require.NoError(t, err)
	dest, err := repository.CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest Estado H", Calle: "Calle", Numero: "1", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)

	envioRepo := repository.NewEnvioRepo(pool)
	envio, err := envioRepo.Create(ctx, pool, domain.Envio{
		CodigoGuia: fmt.Sprintf("MOV-%d", time.Now().UnixNano()%100000000),
		Peso:       1, Tamano: domain.TamanoChico,
		RemitenteID: rem.ID, DestinatarioID: dest.ID,
	})
	require.NoError(t, err)

	var rutaID string
	err = pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id) VALUES ('Ruta Estado Handler', 'Zona H', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID)
	require.NoError(t, err)

	asignados, err := envioRepo.AsignarEnvios(ctx, []string{envio.ID}, rutaID)
	require.NoError(t, err)
	require.Equal(t, 1, asignados)

	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})
	return envio.ID
}

// estadoRequestDeTest arma una request con {id} en la ruta chi y claims en
// el contexto (misma técnica que repartidor_handler_test.go: simula lo que
// RequireAuth deja, sin JWT real).
func estadoRequestDeTest(t *testing.T, metodo, ruta string, body []byte, envioID, usuarioID, rol string) *http.Request {
	t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader([]byte{})
	} else {
		reader = bytes.NewReader(body)
	}
	req := httptest.NewRequest(metodo, ruta, reader)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", envioID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	return req.WithContext(middleware.ContextWithClaims(req.Context(), middleware.Claims{UsuarioID: usuarioID, Rol: rol}))
}

func codigoErrorDeTest(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	errObj, ok := body["error"].(map[string]any)
	require.True(t, ok, "el cuerpo debe tener envelope error: %s", rec.Body.String())
	code, ok := errObj["code"].(string)
	require.True(t, ok)
	return code
}

func TestEstadoHandler_CambiarEstadoFeliz(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

	body, _ := json.Marshal(map[string]string{"estado": domain.EstadoEnvioEnCamino})
	req := estadoRequestDeTest(t, http.MethodPut, "/envios/"+envioID+"/estado", body, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.CambiarEstado(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Equal(t, domain.EstadoEnvioEnCamino, resp["estado"])
}

func TestEstadoHandler_CambiarEstado400(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	t.Run("estado fuera de vocabulario", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body, _ := json.Marshal(map[string]string{"estado": domain.EstadoEnvioEntregado})
		req := estadoRequestDeTest(t, http.MethodPut, "/envios/"+envioID+"/estado", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.CambiarEstado(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "estado_invalido", codigoErrorDeTest(t, rec))
	})

	t.Run("body malformado", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		req := estadoRequestDeTest(t, http.MethodPut, "/envios/"+envioID+"/estado", []byte("{no json"), envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.CambiarEstado(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "body_invalido", codigoErrorDeTest(t, rec))
	})

	t.Run("estado ausente", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body, _ := json.Marshal(map[string]string{})
		req := estadoRequestDeTest(t, http.MethodPut, "/envios/"+envioID+"/estado", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.CambiarEstado(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "estado_invalido", codigoErrorDeTest(t, rec))
	})
}

func TestEstadoHandler_CambiarEstadoRepartidorAjeno404(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

	body, _ := json.Marshal(map[string]string{"estado": domain.EstadoEnvioEnCamino})
	req := estadoRequestDeTest(t, http.MethodPut, "/envios/"+envioID+"/estado", body, envioID,
		"00000000-0000-0000-0000-000000000000", domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.CambiarEstado(rec, req)

	require.Equal(t, http.StatusNotFound, rec.Code)
	require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))
}

func TestEstadoHandler_CambiarEstadoInexistente404(t *testing.T) {
	h, _, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	inexistente := "00000000-0000-0000-0000-000000000000"
	body, _ := json.Marshal(map[string]string{"estado": domain.EstadoEnvioEnCamino})
	req := estadoRequestDeTest(t, http.MethodPut, "/envios/"+inexistente+"/estado", body, inexistente, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.CambiarEstado(rec, req)

	require.Equal(t, http.StatusNotFound, rec.Code)
	require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))
}

func TestEstadoHandler_CambiarEstadoMismoEstado409(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

	// El envío ya está asignado: pedir asignado no es una transición válida.
	body, _ := json.Marshal(map[string]string{"estado": domain.EstadoEnvioAsignado})
	req := estadoRequestDeTest(t, http.MethodPut, "/envios/"+envioID+"/estado", body, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.CambiarEstado(rec, req)

	require.Equal(t, http.StatusConflict, rec.Code)
	require.Equal(t, "transicion_invalida", codigoErrorDeTest(t, rec))
}

func TestEstadoHandler_RegistrarIncidenciaFeliz(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

	body, _ := json.Marshal(map[string]string{"motivo": domain.MotivoClienteAusente, "comentario": "volver 18h"})
	req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/incidencia", body, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.RegistrarIncidencia(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Equal(t, domain.EstadoEnvioNoEntregado, resp["estado"])
}

func TestEstadoHandler_RegistrarIncidencia400(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	t.Run("motivo invalido", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body, _ := json.Marshal(map[string]string{"motivo": "llueve_mucho"})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/incidencia", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.RegistrarIncidencia(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "motivo_invalido", codigoErrorDeTest(t, rec))
	})

	t.Run("otro sin comentario", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body, _ := json.Marshal(map[string]string{"motivo": domain.MotivoOtro})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/incidencia", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.RegistrarIncidencia(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "comentario_obligatorio", codigoErrorDeTest(t, rec))
	})

	t.Run("con foto se rechaza", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body, _ := json.Marshal(map[string]string{"motivo": domain.MotivoZonaInsegura, "foto_base64": "aG9sYQ=="})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/incidencia", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.RegistrarIncidencia(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "imagen_no_soportada", codigoErrorDeTest(t, rec))
	})

	t.Run("foto con base64 malformado", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body, _ := json.Marshal(map[string]string{"motivo": domain.MotivoZonaInsegura, "foto_base64": "!!!"})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/incidencia", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.RegistrarIncidencia(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "imagen_invalida", codigoErrorDeTest(t, rec))
	})
}

func TestEstadoHandler_RegistrarIncidenciaRepartidorAjeno404(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

	body, _ := json.Marshal(map[string]string{"motivo": domain.MotivoRechazado})
	req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/incidencia", body, envioID,
		"00000000-0000-0000-0000-000000000000", domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.RegistrarIncidencia(rec, req)

	require.Equal(t, http.StatusNotFound, rec.Code)
	require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))
}

func TestEstadoHandler_RegistrarIncidenciaDoble409(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

	primera, _ := json.Marshal(map[string]string{"motivo": domain.MotivoClienteAusente})
	req1 := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/incidencia", primera, envioID, repartidorID, domain.RolRepartidor)
	rec1 := httptest.NewRecorder()
	h.RegistrarIncidencia(rec1, req1)
	require.Equal(t, http.StatusOK, rec1.Code)

	// El envío ya está no_entregado: segunda incidencia → 409.
	segunda, _ := json.Marshal(map[string]string{"motivo": domain.MotivoRechazado})
	req2 := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/incidencia", segunda, envioID, repartidorID, domain.RolRepartidor)
	rec2 := httptest.NewRecorder()
	h.RegistrarIncidencia(rec2, req2)

	require.Equal(t, http.StatusConflict, rec2.Code)
	require.Equal(t, "transicion_invalida", codigoErrorDeTest(t, rec2))
}
