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

// EstadoHandler expone HU-06, HU-07 y HU-08: cambio de estado (asignado ⇄
// en_camino), registro de incidencias (→ no_entregado con motivo) y
// confirmación de entrega (→ entregado con firma y foto) + descarga de
// la evidencia. El actor se identifica por el JWT (claims en el contexto),
// nunca por parámetro; la pertenencia del repartidor la chequea el service.
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

type confirmacionRequest struct {
	ReceptorNombre   string `json:"receptor_nombre"`
	ReceptorRelacion string `json:"receptor_relacion"`
	FirmaBase64      string `json:"firma_base64"`
	FotoBase64       string `json:"foto_base64"`
}

// Confirmar maneja POST /envios/{id}/confirmacion (HU-08): pasa el envío a
// entregado con su evidencia (receptor + firma PNG + foto JPEG). La
// presencia de los cuatro campos se valida acá (ausentes/vacíos/JSON malo
// → 400 body_invalido); el CONTENIDO (relación, tamaños, magic bytes) lo
// valida el service. El base64 malformado se rechaza acá con 400
// imagen_invalida; el service recibe los bytes ya decodificados.
func (h *EstadoHandler) Confirmar(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}

	var req confirmacionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}
	if strings.TrimSpace(req.ReceptorNombre) == "" || strings.TrimSpace(req.ReceptorRelacion) == "" ||
		strings.TrimSpace(req.FirmaBase64) == "" || strings.TrimSpace(req.FotoBase64) == "" {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "receptor_nombre, receptor_relacion, firma_base64 y foto_base64 son obligatorios")
		return
	}
	firma, err := base64.StdEncoding.DecodeString(strings.TrimSpace(req.FirmaBase64))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "imagen_invalida", "la firma no es base64 válido")
		return
	}
	foto, err := base64.StdEncoding.DecodeString(strings.TrimSpace(req.FotoBase64))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "imagen_invalida", "la foto no es base64 válido")
		return
	}

	envio, err := h.svc.ConfirmarEntrega(r.Context(), chi.URLParam(r, "id"), strings.TrimSpace(req.ReceptorNombre), strings.TrimSpace(req.ReceptorRelacion), firma, foto, claims.UsuarioID, claims.Rol)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, envio)
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el envío no existe")
	case errors.Is(err, services.ErrEvidenciaIncompleta):
		httpx.WriteError(w, http.StatusBadRequest, "evidencia_incompleta", "la confirmación requiere receptor, firma y foto")
	case errors.Is(err, services.ErrRelacionInvalida):
		httpx.WriteError(w, http.StatusBadRequest, "relacion_invalida", "la relación debe ser destinatario, familiar, vecino o encargado")
	case errors.Is(err, services.ErrImagenInvalida):
		httpx.WriteError(w, http.StatusBadRequest, "imagen_invalida", "la firma debe ser PNG y la foto JPEG")
	case errors.Is(err, services.ErrImagenMuyGrande):
		httpx.WriteError(w, http.StatusRequestEntityTooLarge, "imagen_muy_grande", "la imagen no puede superar los 5 MB")
	case errors.Is(err, services.ErrTransicionInvalida):
		httpx.WriteError(w, http.StatusConflict, "transicion_invalida", "solo se puede confirmar un envío asignado o en camino")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo confirmar la entrega")
	}
}

// DescargarFirma maneja GET /envios/{id}/confirmacion/firma (HU-08):
// devuelve los bytes PNG de la firma (no JSON). Sin confirmación o con
// guard de pertenencia fallido → 404 no_encontrado (envelope JSON).
func (h *EstadoHandler) DescargarFirma(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}

	confirmacion, err := h.svc.ObtenerConfirmacion(r.Context(), chi.URLParam(r, "id"), claims.UsuarioID, claims.Rol)
	if err != nil {
		if errors.Is(err, repository.ErrNoEncontrado) {
			httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el envío no existe o no tiene evidencia")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener la firma")
		return
	}

	w.Header().Set("Content-Type", "image/png")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(confirmacion.Firma)
}

// DescargarFoto maneja GET /envios/{id}/confirmacion/foto (HU-08): devuelve
// los bytes JPEG de la foto del paquete (no JSON). Sin confirmación o con
// guard de pertenencia fallido → 404 no_encontrado (envelope JSON).
func (h *EstadoHandler) DescargarFoto(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}

	confirmacion, err := h.svc.ObtenerConfirmacion(r.Context(), chi.URLParam(r, "id"), claims.UsuarioID, claims.Rol)
	if err != nil {
		if errors.Is(err, repository.ErrNoEncontrado) {
			httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el envío no existe o no tiene evidencia")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener la foto")
		return
	}

	w.Header().Set("Content-Type", "image/jpeg")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(confirmacion.Foto)
}

// DescargarFotoIncidencia maneja GET /envios/{id}/eventos/{eventoId}/foto
// (HU-07 cierre): devuelve los bytes JPEG de la foto de una incidencia (no
// JSON). Sin foto en el evento, evento de otro envío o guard de
// pertenencia fallido → 404 no_encontrado (envelope JSON, nunca binario).
func (h *EstadoHandler) DescargarFotoIncidencia(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}

	foto, err := h.svc.ObtenerFotoIncidencia(r.Context(), chi.URLParam(r, "id"), chi.URLParam(r, "eventoId"), claims.UsuarioID, claims.Rol)
	if err != nil {
		if errors.Is(err, repository.ErrNoEncontrado) {
			httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el envío no existe o el evento no tiene foto")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener la foto de la incidencia")
		return
	}

	w.Header().Set("Content-Type", "image/jpeg")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(foto)
}

type incidenciaRequest struct {
	Motivo     string `json:"motivo"`
	Comentario string `json:"comentario"`
	FotoBase64 string `json:"foto_base64"`
}

// RegistrarIncidencia maneja POST /envios/{id}/incidencia (HU-07): marca el
// envío como no_entregado con motivo de la lista cerrada. La foto
// (foto_base64 opcional, JPEG en base64) se persiste en el evento
// (columna foto, migración 0005); ausente → nil (NULL = sin foto).
// Base64 malformado → 400 imagen_invalida; el service valida magic bytes
// (→ 400 imagen_invalida) y tamaño (→ 413 imagen_muy_grande).
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
	case errors.Is(err, services.ErrImagenInvalida):
		httpx.WriteError(w, http.StatusBadRequest, "imagen_invalida", "la foto debe ser JPEG")
	case errors.Is(err, services.ErrImagenMuyGrande):
		httpx.WriteError(w, http.StatusRequestEntityTooLarge, "imagen_muy_grande", "la imagen no puede superar los 5 MB")
	case errors.Is(err, services.ErrTransicionInvalida):
		httpx.WriteError(w, http.StatusConflict, "transicion_invalida", "solo se puede registrar incidencia sobre un envío asignado o en camino")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo registrar la incidencia")
	}
}
