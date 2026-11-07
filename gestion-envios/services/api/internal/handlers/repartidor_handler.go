package handlers

import (
	"errors"
	"net/http"
	"time"

	"movii/api/internal/middleware"
	"movii/api/internal/repository"
	httpx "movii/api/internal/platform/http"
	"movii/api/internal/services"
)

// RepartidorHandler expone HU-05: el listado de envíos del día del
// repartidor logueado.
type RepartidorHandler struct {
	svc    *services.RepartidorService
	perfil *repository.PerfilRepo
}

// ConPerfil habilita GET /repartidor/perfil.
func (h *RepartidorHandler) ConPerfil(p *repository.PerfilRepo) *RepartidorHandler {
	h.perfil = p
	return h
}

// Perfil maneja GET /repartidor/perfil: cuenta, vehículo de hoy y
// rendimiento histórico del repartidor logueado (siempre el del JWT).
func (h *RepartidorHandler) Perfil(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}
	if h.perfil == nil {
		httpx.WriteError(w, http.StatusNotFound, "no_disponible", "el perfil no está disponible")
		return
	}
	p, err := h.perfil.DeRepartidor(r.Context(), claims.UsuarioID, services.FechaAR(time.Now()))
	if errors.Is(err, repository.ErrNoEncontrado) {
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el usuario no existe")
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener el perfil")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

// NewRepartidorHandler crea un RepartidorHandler.
func NewRepartidorHandler(svc *services.RepartidorService) *RepartidorHandler {
	return &RepartidorHandler{svc: svc}
}

// EnviosDelDia maneja GET /repartidor/envios-del-dia?estado=. El repartidor
// se identifica por el JWT (RequireAuth ya dejó las Claims en el contexto),
// nunca por un parámetro que el cliente pudiera manipular.
func (h *RepartidorHandler) EnviosDelDia(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}

	estado := r.URL.Query().Get("estado")

	resumen, err := h.svc.EnviosDelDia(r.Context(), claims.UsuarioID, estado)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener el listado del día")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resumen)
}
