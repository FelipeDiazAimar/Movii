package handlers

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"movii/api/internal/domain"
	"movii/api/internal/middleware"
	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// EstadoHandler expone HU-06 y HU-07: cambio de estado (asignado ⇄
// en_camino) y registro de incidencias (→ no_entregado con motivo).
// El actor se identifica por el JWT (claims en el contexto), nunca por
// parámetro; la pertenencia del repartidor la chequea el service.
type EstadoHandler struct {
	svc *services.EstadoService
}

// NewEstadoHandler crea un EstadoHandler.
func NewEstadoHandler(svc *services.EstadoService) *EstadoHandler {
	return &EstadoHandler{svc: svc}
}

type cambiarEstadoRequest struct {
	Estado string `json:"estado"`
}

// estadoPedidoValido indica si el estado pedido está dentro del
// vocabulario del endpoint (openapi: CambiarEstadoRequest solo admite
// asignado o en_camino; el resto va por sus endpoints propios).
func estadoPedidoValido(estado string) bool {
	return estado == domain.EstadoEnvioAsignado || estado == domain.EstadoEnvioEnCamino
}

// CambiarEstado maneja PUT /envios/{id}/estado.
func (h *EstadoHandler) CambiarEstado(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}

	var req cambiarEstadoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}
	if !estadoPedidoValido(req.Estado) {
		httpx.WriteError(w, http.StatusBadRequest, "estado_invalido", "el estado debe ser asignado o en_camino")
		return
	}

	envio, err := h.svc.CambiarEstado(r.Context(), chi.URLParam(r, "id"), req.Estado, claims.UsuarioID, claims.Rol)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, envio)
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el envío no existe")
	case errors.Is(err, services.ErrTransicionInvalida):
		httpx.WriteError(w, http.StatusConflict, "transicion_invalida", err.Error())
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo actualizar el estado del envío")
	}
}

type reprogramacionRequest struct {
	NuevaFecha string `json:"nueva_fecha"`
	Franja     string `json:"franja"`
}

// Reprogramar maneja POST /envios/{id}/reprogramacion (HU-09): vuelve un
// envío en estado no_entregado a pendiente para una nueva fecha + franja.
func (h *EstadoHandler) Reprogramar(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}

	var req reprogramacionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}
	if strings.TrimSpace(req.NuevaFecha) == "" || strings.TrimSpace(req.Franja) == "" {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "nueva_fecha y franja son obligatorios")
		return
	}

	envio, err := h.svc.Reprogramar(r.Context(), chi.URLParam(r, "id"), strings.TrimSpace(req.NuevaFecha), strings.TrimSpace(req.Franja), claims.UsuarioID, claims.Rol)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, envio)
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el envío no existe")
	case errors.Is(err, services.ErrFechaInvalida):
		httpx.WriteError(w, http.StatusBadRequest, "fecha_invalida", "la fecha debe tener formato YYYY-MM-DD y ser hoy o futura")
	case errors.Is(err, services.ErrFranjaInvalida):
		httpx.WriteError(w, http.StatusBadRequest, "franja_invalida", "la franja debe ser manana, tarde o noche")
	case errors.Is(err, services.ErrTransicionInvalida):
		httpx.WriteError(w, http.StatusConflict, "transicion_invalida", "solo se puede reprogramar un envío en estado no_entregado")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo reprogramar el envío")
	}
}

type incidenciaRequest struct {
	Motivo     string `json:"motivo"`
	Comentario string `json:"comentario"`
	FotoBase64 string `json:"foto_base64"`
}

// RegistrarIncidencia maneja POST /envios/{id}/incidencia.
// La foto (openapi: foto_base64 opcional) queda pendiente del mecanismo
// de imágenes de HU-08/09: si se adjunta se rechaza con
// imagen_no_soportada (400) en vez de aceptarla en silencio.
func (h *EstadoHandler) RegistrarIncidencia(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}

	var req incidenciaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	var foto []byte
	if strings.TrimSpace(req.FotoBase64) != "" {
		decodificada, err := base64.StdEncoding.DecodeString(strings.TrimSpace(req.FotoBase64))
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "imagen_invalida", "la foto no es base64 válido")
			return
		}
		foto = decodificada
	}

	envio, err := h.svc.RegistrarIncidencia(r.Context(), chi.URLParam(r, "id"), req.Motivo, req.Comentario, foto, claims.UsuarioID, claims.Rol)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, envio)
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el envío no existe")
	case errors.Is(err, services.ErrMotivoInvalido):
		httpx.WriteError(w, http.StatusBadRequest, "motivo_invalido", "el motivo debe ser uno de la lista cerrada")
	case errors.Is(err, services.ErrComentarioObligatorio):
		httpx.WriteError(w, http.StatusBadRequest, "comentario_obligatorio", "el motivo 'otro' requiere un comentario")
	case errors.Is(err, services.ErrImagenNoSoportada):
		httpx.WriteError(w, http.StatusBadRequest, "imagen_no_soportada", "la incidencia con foto aún no está soportada")
	case errors.Is(err, services.ErrTransicionInvalida):
		httpx.WriteError(w, http.StatusConflict, "transicion_invalida", "solo se puede registrar incidencia sobre un envío asignado o en camino")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo registrar la incidencia")
	}
}
