package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"movii/api/internal/domain"
	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// RutaHandler expone HU-03 (rutas) y HU-04 (asignación de envíos a rutas).
type RutaHandler struct {
	rutaSvc *services.RutaService
	asigSvc *services.AsignacionService
}

// NewRutaHandler crea un RutaHandler.
func NewRutaHandler(rutaSvc *services.RutaService, asigSvc *services.AsignacionService) *RutaHandler {
	return &RutaHandler{rutaSvc: rutaSvc, asigSvc: asigSvc}
}

type rutaRequest struct {
	Nombre       string `json:"nombre"`
	Zona         string `json:"zona"`
	Fecha        string `json:"fecha"`
	RepartidorID string `json:"repartidor_id"`
}

// Create maneja POST /rutas.
func (h *RutaHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req rutaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	ruta, err := h.rutaSvc.Create(r.Context(), domain.Ruta{
		Nombre: req.Nombre, Zona: req.Zona, Fecha: req.Fecha, RepartidorID: req.RepartidorID,
	})
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusCreated, ruta)
	case errors.Is(err, services.ErrRutaCamposObligatorios):
		httpx.WriteError(w, http.StatusBadRequest, "campos_obligatorios", "faltan el repartidor o la fecha de la ruta")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo crear la ruta")
	}
}

// List maneja GET /rutas?fecha=.
func (h *RutaHandler) List(w http.ResponseWriter, r *http.Request) {
	fecha := r.URL.Query().Get("fecha")

	rutas, err := h.rutaSvc.List(r.Context(), fecha)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener la lista de rutas")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, rutas)
}

type detalleRutaResponse struct {
	ID             string         `json:"id"`
	Nombre         string         `json:"nombre"`
	Zona           string         `json:"zona"`
	Fecha          string         `json:"fecha"`
	Estado         string         `json:"estado"`
	RepartidorID   string         `json:"repartidor_id"`
	Envios         []domain.Envio `json:"envios"`
	PesoTotal      float64        `json:"peso_total"`
	CantidadEnvios int            `json:"cantidad_envios"`
}

// Detail maneja GET /rutas/{id}.
func (h *RutaHandler) Detail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	detalle, err := h.rutaSvc.Detalle(r.Context(), id)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, detalleRutaResponse{
			ID: detalle.Ruta.ID, Nombre: detalle.Ruta.Nombre, Zona: detalle.Ruta.Zona,
			Fecha: detalle.Ruta.Fecha, Estado: detalle.Ruta.Estado, RepartidorID: detalle.Ruta.RepartidorID,
			Envios: detalle.Envios, PesoTotal: detalle.PesoTotal, CantidadEnvios: detalle.CantidadEnvios,
		})
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "la ruta no existe")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener la ruta")
	}
}

// Update maneja PUT /rutas/{id}.
func (h *RutaHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req rutaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	ruta, err := h.rutaSvc.Update(r.Context(), id, domain.Ruta{
		Nombre: req.Nombre, Zona: req.Zona, Fecha: req.Fecha, RepartidorID: req.RepartidorID,
	})
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, ruta)
	case errors.Is(err, services.ErrRutaCamposObligatorios):
		httpx.WriteError(w, http.StatusBadRequest, "campos_obligatorios", "faltan el repartidor o la fecha de la ruta")
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "la ruta no existe")
	case errors.Is(err, repository.ErrRutaNoEditable):
		httpx.WriteError(w, http.StatusConflict, "ruta_no_editable", "la ruta no se puede editar en su estado actual")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo editar la ruta")
	}
}

type asignarEnviosRequest struct {
	EnvioIDs []string `json:"envio_ids"`
}

// AsignarEnvios maneja POST /rutas/{id}/envios.
func (h *RutaHandler) AsignarEnvios(w http.ResponseWriter, r *http.Request) {
	rutaID := chi.URLParam(r, "id")

	var req asignarEnviosRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	err := h.asigSvc.Asignar(r.Context(), rutaID, req.EnvioIDs)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"asignados": len(req.EnvioIDs)})
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "la ruta no existe")
	case errors.Is(err, services.ErrFechaVencida):
		httpx.WriteError(w, http.StatusBadRequest, "fecha_vencida", "la fecha de la ruta ya pasó")
	case errors.Is(err, repository.ErrEnvioNoDisponible):
		httpx.WriteError(w, http.StatusConflict, "envio_no_disponible", "uno o más envíos no están pendientes")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo asignar los envíos")
	}
}

// DesasignarEnvio maneja DELETE /rutas/{id}/envios/{envioId}.
func (h *RutaHandler) DesasignarEnvio(w http.ResponseWriter, r *http.Request) {
	rutaID := chi.URLParam(r, "id")
	envioID := chi.URLParam(r, "envioId")

	err := h.asigSvc.Desasignar(r.Context(), rutaID, envioID)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"estado": "pendiente"})
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "la ruta o el envío no existen")
	case errors.Is(err, repository.ErrRutaNoEditable):
		httpx.WriteError(w, http.StatusConflict, "ruta_no_editable", "la ruta no se puede editar en su estado actual")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo desasignar el envío")
	}
}
