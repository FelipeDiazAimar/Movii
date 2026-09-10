package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

// Tests de Task 3 (HU-08): POST /envios/{id}/confirmacion + GETs de firma y
// foto. Reutilizan los helpers de estado_handler_test.go. Las evidencias
// mínimas solo necesitan los magic bytes (el service no valida el contenido
// completo de la imagen).

var (
	firmaValidaDeTest = []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01}
	fotoValidaDeTest  = []byte{0xFF, 0xD8, 0xFF, 0x00, 0x01}
)

func cuerpoConfirmacionDeTest(t *testing.T, receptor, relacion string, firma, foto []byte) []byte {
	t.Helper()
	body, _ := json.Marshal(map[string]string{
		"receptor_nombre":   receptor,
		"receptor_relacion": relacion,
		"firma_base64":      base64.StdEncoding.EncodeToString(firma),
		"foto_base64":       base64.StdEncoding.EncodeToString(foto),
	})
	return body
}

func TestEstadoHandler_ConfirmarFeliz(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

	body := cuerpoConfirmacionDeTest(t, "Juan Pérez", domain.RelacionDestinatario, firmaValidaDeTest, fotoValidaDeTest)
	req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", body, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.Confirmar(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Equal(t, domain.EstadoEnvioEntregado, resp["estado"])
	require.Equal(t, envioID, resp["id"])
}

func TestEstadoHandler_Confirmar400(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	t.Run("body malformado", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", []byte("{no json"), envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Confirmar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "body_invalido", codigoErrorDeTest(t, rec))
	})

	t.Run("campos ausentes", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body, _ := json.Marshal(map[string]string{"receptor_nombre": "Juan"})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Confirmar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "body_invalido", codigoErrorDeTest(t, rec))
	})

	t.Run("campos vacios", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body, _ := json.Marshal(map[string]string{
			"receptor_nombre": "  ", "receptor_relacion": domain.RelacionVecino,
			"firma_base64": base64.StdEncoding.EncodeToString(firmaValidaDeTest),
			"foto_base64":  base64.StdEncoding.EncodeToString(fotoValidaDeTest),
		})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Confirmar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "body_invalido", codigoErrorDeTest(t, rec))
	})

	t.Run("firma con base64 malformado", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body, _ := json.Marshal(map[string]string{
			"receptor_nombre": "Juan", "receptor_relacion": domain.RelacionDestinatario,
			"firma_base64": "!!!", "foto_base64": base64.StdEncoding.EncodeToString(fotoValidaDeTest),
		})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Confirmar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "imagen_invalida", codigoErrorDeTest(t, rec))
	})

	t.Run("foto con base64 malformado", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body, _ := json.Marshal(map[string]string{
			"receptor_nombre": "Juan", "receptor_relacion": domain.RelacionDestinatario,
			"firma_base64": base64.StdEncoding.EncodeToString(firmaValidaDeTest), "foto_base64": "!!!",
		})
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Confirmar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "imagen_invalida", codigoErrorDeTest(t, rec))
	})

	t.Run("relacion invalida", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body := cuerpoConfirmacionDeTest(t, "Juan", "primo", firmaValidaDeTest, fotoValidaDeTest)
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Confirmar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "relacion_invalida", codigoErrorDeTest(t, rec))
	})

	t.Run("firma JPEG y foto PNG (magic cruzados)", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body := cuerpoConfirmacionDeTest(t, "Juan", domain.RelacionFamiliar, fotoValidaDeTest, firmaValidaDeTest)
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", body, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Confirmar(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Equal(t, "imagen_invalida", codigoErrorDeTest(t, rec))
	})
}

func TestEstadoHandler_Confirmar413(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

	// Firma válida en magic pero >5 MB decodificada (construida en memoria).
	grande := append([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
		make([]byte, domain.MaxImagenBytes)...)
	body := cuerpoConfirmacionDeTest(t, "Juan", domain.RelacionDestinatario, grande, fotoValidaDeTest)
	req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", body, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.Confirmar(rec, req)

	require.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
	require.Equal(t, "imagen_muy_grande", codigoErrorDeTest(t, rec))
}

func TestEstadoHandler_Confirmar404(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	t.Run("envio inexistente", func(t *testing.T) {
		inexistente := "00000000-0000-0000-0000-000000000000"
		body := cuerpoConfirmacionDeTest(t, "Juan", domain.RelacionDestinatario, firmaValidaDeTest, fotoValidaDeTest)
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+inexistente+"/confirmacion", body, inexistente, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Confirmar(rec, req)

		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))
	})

	t.Run("repartidor ajeno", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
		body := cuerpoConfirmacionDeTest(t, "Juan", domain.RelacionDestinatario, firmaValidaDeTest, fotoValidaDeTest)
		req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", body, envioID,
			"00000000-0000-0000-0000-000000000000", domain.RolRepartidor)
		rec := httptest.NewRecorder()

		h.Confirmar(rec, req)

		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))
	})
}

func TestEstadoHandler_ConfirmarDoble409(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

	primera := cuerpoConfirmacionDeTest(t, "Juan", domain.RelacionDestinatario, firmaValidaDeTest, fotoValidaDeTest)
	req1 := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", primera, envioID, repartidorID, domain.RolRepartidor)
	rec1 := httptest.NewRecorder()
	h.Confirmar(rec1, req1)
	require.Equal(t, http.StatusOK, rec1.Code)

	// El envío ya está entregado (terminal): reconfirmar → 409.
	segunda := cuerpoConfirmacionDeTest(t, "Otro", domain.RelacionVecino, firmaValidaDeTest, fotoValidaDeTest)
	req2 := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", segunda, envioID, repartidorID, domain.RolRepartidor)
	rec2 := httptest.NewRecorder()
	h.Confirmar(rec2, req2)

	require.Equal(t, http.StatusConflict, rec2.Code)
	require.Equal(t, "transicion_invalida", codigoErrorDeTest(t, rec2))
}

func TestEstadoHandler_ConfirmarSinToken401(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

	body := cuerpoConfirmacionDeTest(t, "Juan", domain.RelacionDestinatario, firmaValidaDeTest, fotoValidaDeTest)
	req := httptest.NewRequest(http.MethodPost, "/envios/"+envioID+"/confirmacion", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Confirmar(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

// confirmarEnvioDeTest confirma un envío vía el handler y devuelve su ID
// (atajo para los tests de descarga de binarios).
func confirmarEnvioDeTest(t *testing.T, h *EstadoHandler, pool *pgxpool.Pool, repartidorID string) string {
	t.Helper()
	envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)
	body := cuerpoConfirmacionDeTest(t, "Juan Pérez", domain.RelacionDestinatario, firmaValidaDeTest, fotoValidaDeTest)
	req := estadoRequestDeTest(t, http.MethodPost, "/envios/"+envioID+"/confirmacion", body, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()
	h.Confirmar(rec, req)
	require.Equal(t, http.StatusOK, rec.Code, "la confirmación previa falló: %s", rec.Body.String())
	return envioID
}

func TestEstadoHandler_DescargarFirmaFeliz(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := confirmarEnvioDeTest(t, h, pool, repartidorID)

	req := estadoRequestDeTest(t, http.MethodGet, "/envios/"+envioID+"/confirmacion/firma", nil, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.DescargarFirma(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "image/png", rec.Header().Get("Content-Type"))
	require.Equal(t, firmaValidaDeTest, rec.Body.Bytes())
}

func TestEstadoHandler_DescargarFotoFeliz(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	envioID := confirmarEnvioDeTest(t, h, pool, repartidorID)

	req := estadoRequestDeTest(t, http.MethodGet, "/envios/"+envioID+"/confirmacion/foto", nil, envioID, repartidorID, domain.RolRepartidor)
	rec := httptest.NewRecorder()

	h.DescargarFoto(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "image/jpeg", rec.Header().Get("Content-Type"))
	require.Equal(t, fotoValidaDeTest, rec.Body.Bytes())
}

func TestEstadoHandler_DescargarBinarios404(t *testing.T) {
	h, pool, repartidorID, _ := nuevoEstadoHandlerDeTest(t)

	t.Run("sin confirmacion", func(t *testing.T) {
		envioID := crearEnvioAsignadoHandlerDeTest(t, pool, repartidorID)

		req := estadoRequestDeTest(t, http.MethodGet, "/envios/"+envioID+"/confirmacion/firma", nil, envioID, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()
		h.DescargarFirma(rec, req)
		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))

		reqFoto := estadoRequestDeTest(t, http.MethodGet, "/envios/"+envioID+"/confirmacion/foto", nil, envioID, repartidorID, domain.RolRepartidor)
		recFoto := httptest.NewRecorder()
		h.DescargarFoto(recFoto, reqFoto)
		require.Equal(t, http.StatusNotFound, recFoto.Code)
		require.Equal(t, "no_encontrado", codigoErrorDeTest(t, recFoto))
	})

	t.Run("repartidor ajeno", func(t *testing.T) {
		envioID := confirmarEnvioDeTest(t, h, pool, repartidorID)
		ajeno := "00000000-0000-0000-0000-000000000000"

		req := estadoRequestDeTest(t, http.MethodGet, "/envios/"+envioID+"/confirmacion/firma", nil, envioID, ajeno, domain.RolRepartidor)
		rec := httptest.NewRecorder()
		h.DescargarFirma(rec, req)
		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))

		reqFoto := estadoRequestDeTest(t, http.MethodGet, "/envios/"+envioID+"/confirmacion/foto", nil, envioID, ajeno, domain.RolRepartidor)
		recFoto := httptest.NewRecorder()
		h.DescargarFoto(recFoto, reqFoto)
		require.Equal(t, http.StatusNotFound, recFoto.Code)
		require.Equal(t, "no_encontrado", codigoErrorDeTest(t, recFoto))
	})

	t.Run("envio inexistente", func(t *testing.T) {
		inexistente := "00000000-0000-0000-0000-000000000000"
		req := estadoRequestDeTest(t, http.MethodGet, "/envios/"+inexistente+"/confirmacion/foto", nil, inexistente, repartidorID, domain.RolRepartidor)
		rec := httptest.NewRecorder()
		h.DescargarFoto(rec, req)
		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Equal(t, "no_encontrado", codigoErrorDeTest(t, rec))
	})
}
