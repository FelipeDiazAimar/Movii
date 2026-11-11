package handlers

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// SugerenciaHandler expone los rankings que ayudan a elegir con qué asignar.
type SugerenciaHandler struct{ svc *services.SugerenciaService }

// NewSugerenciaHandler crea un SugerenciaHandler.
func NewSugerenciaHandler(svc *services.SugerenciaService) *SugerenciaHandler {
	return &SugerenciaHandler{svc: svc}
}

func escribirErrorSugerencia(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el envío o la ruta no existen")
	case errors.Is(err, services.ErrFechaReporteInvalida):
		httpx.WriteError(w, http.StatusBadRequest, "fecha_invalida", "la fecha debe tener formato YYYY-MM-DD")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo calcular la sugerencia")
	}
}

// RutasParaEnvio maneja GET /envios/{id}/rutas-sugeridas.
func (h *SugerenciaHandler) RutasParaEnvio(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.RutasParaEnvio(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		escribirErrorSugerencia(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// Repartidores maneja GET /repartidores/sugeridos?ruta_id=&fecha=.
func (h *SugerenciaHandler) Repartidores(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	out, err := h.svc.RepartidoresParaRuta(r.Context(), q.Get("ruta_id"), q.Get("fecha"))
	if err != nil {
		escribirErrorSugerencia(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
