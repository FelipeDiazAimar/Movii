package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

// llevarANoEntregadoDeTest marca el envío como no_entregado vía el propio
// handler de incidencia (misma técnica que el test de doble incidencia).
func llevarANoEntregadoDeTest(t *testing.T, h *EstadoHandler, envioID, repartidorID string) {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"motivo": domain.MotivoClienteAusente})
	req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/incidencia", body, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()
	h.RegistrarIncidencia(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
}

func fechaFuturaHandlerDeTest(dias int) string {
	return time.Now().UTC().AddDate(0, 0, dias).Format("2006-01-02")
}

func TestEstadoHandler_ReprogramarFeliz(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
	llevarANoEntregadoDeTest(t, h, envioID, repartidorID)

	nuevaFecha := fechaFuturaHandlerDeTest(1)
	body, _ := json.Marshal(map[string]string{"nueva_fecha": nuevaFecha, "franja": domain.FranjaTarde})
	req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/reprogramacion", body, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.Reprogramar(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Equal(t, domain.EstadoEnvioPendiente, resp["estado"])
}

func TestEstadoHandler_ReprogramarBodyInvalido(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	t.Run("json malformado", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		llevarANoEntregadoDeTest(t, h, envioID, repartidorID)
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/reprogramacion", []byte("{no json"), envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Reprogramar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "body_invalido", codigoErrorDeTest(t, rec))
	})

	t.Run("campos ausentes", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		llevarANoEntregadoDeTest(t, h, envioID, repartidorID)
		body, _ := json.Marshal(map[string]string{})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/reprogramacion", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Reprogramar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "body_invalido", codigoErrorDeTest(t, rec))
	})

	t.Run("campos vacios", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		llevarANoEntregadoDeTest(t, h, envioID, repartidorID)
		body, _ := json.Marshal(map[string]string{"nueva_fecha": "", "franja": ""})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/reprogramacion", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Reprogramar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "body_invalido", codigoErrorDeTest(t, rec))
	})
}

func TestEstadoHandler_ReprogramarFechaInvalida(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	t.Run("formato malo", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		llevarANoEntregadoDeTest(t, h, envioID, repartidorID)
		body, _ := json.Marshal(map[string]string{"nueva_fecha": "10-09-2026", "franja": domain.FranjaTarde})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/reprogramacion", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Reprogramar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "fecha_invalida", codigoErrorDeTest(t, rec))
	})

	t.Run("fecha pasada", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		llevarANoEntregadoDeTest(t, h, envioID, repartidorID)
		body, _ := json.Marshal(map[string]string{"nueva_fecha": fechaFuturaHandlerDeTest(-1), "franja": domain.FranjaTarde})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/reprogramacion", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Reprogramar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "fecha_invalida", codigoErrorDeTest(t, rec))
	})
}

func TestEstadoHandler_ReprogramarFranjaInvalida(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
	llevarANoEntregadoDeTest(t, h, envioID, repartidorID)
	body, _ := json.Marshal(map[string]string{"nueva_fecha": fechaFuturaHandlerDeTest(1), "franja": "madrugada"})
	req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/reprogramacion", body, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.Reprogramar(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "franja_invalida", codigoErrorDeTest(t, rec))
}

func TestEstadoHandler_ReprogramarRepartidorAjeno404(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
	llevarANoEntregadoDeTest(t, h, envioID, repartidorID)

	body, _ := json.Marshal(map[string]string{"nueva_fecha": fechaFuturaHandlerDeTest(1), "franja": domain.FranjaNoche})
	req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/reprogramacion", body, envioID,
		"00000000-0000-0000-0000-000000000000", domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.Reprogramar(rec, req)

	require.Equal(t, http.StatusNotFound, rec.Code)
	require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))
}

func TestEstadoHandler_ReprogramarNoNoEntregado409(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	// El envío sigue asignado (sin incidencia): reprogramar → 409.
	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

	body, _ := json.Marshal(map[string]string{"nueva_fecha": fechaFuturaHandlerDeTest(1), "franja": domain.FranjaManana})
	req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/reprogramacion", body, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.Reprogramar(rec, req)

	require.Equal(t, http.StatusConflict, rec.Code)
	require.Equal(t, "transicion_invalida", codigoErrorDeTest(t, rec))
}
