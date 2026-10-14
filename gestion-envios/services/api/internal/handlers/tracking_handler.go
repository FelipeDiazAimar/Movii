package handlers

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// TrackingHandler expone HU-10: tracking público por código de guía, SIN
// login. No usa claims ni roles: la ruta vive fuera del grupo protegido
// (junto a /health y /auth/*). Solo devuelve columnas blancas (las del
// TrackingService): jamás teléfonos, emails, dirección exacta, repartidor,
// comentarios internos ni actor.
type TrackingHandler struct {
	svc *services.TrackingService
}

// NewTrackingHandler crea un TrackingHandler.
func NewTrackingHandler(svc *services.TrackingService) *TrackingHandler {
	return &TrackingHandler{svc: svc}
}

// PorCodigo maneja GET /tracking/{codigo} (código del path tal cual, sin
// normalizar: match exacto). Código inexistente → 404 no_encontrado
// genérico (mensaje exacto del openapi, sin distinguir formatos para no
// enumerar).
func (h *TrackingHandler) PorCodigo(w http.ResponseWriter, r *http.Request) {
	resp, err := h.svc.PorCodigo(r.Context(), chi.URLParam(r, "codigo"))
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, resp)
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "no se encontró ningún envío con ese código")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener el tracking del envío")
	}
}
