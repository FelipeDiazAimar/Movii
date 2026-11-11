package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"movii/api/internal/domain"
	"movii/api/internal/middleware"
	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// FlotaHandler expone la flota, el seguimiento en vivo y el trayecto de cada envío (HU-11, HU-12, HU-18).
type FlotaHandler struct {
	svc *services.FlotaService
	hub *services.FlotaHub
}

// NewFlotaHandler crea un FlotaHandler.
func NewFlotaHandler(svc *services.FlotaService, hub *services.FlotaHub) *FlotaHandler {
	return &FlotaHandler{svc: svc, hub: hub}
}

func escribirErrorFlota(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el recurso no existe")
	case errors.Is(err, services.ErrFechaReporteInvalida):
		httpx.WriteError(w, http.StatusBadRequest, "fecha_invalida", "la fecha debe tener formato YYYY-MM-DD")
	case errors.Is(err, services.ErrVehiculoInvalido):
		httpx.WriteError(w, http.StatusBadRequest, "vehiculo_invalido", "revisá patente, modelo, tipo, estado y capacidades (mayores a 0)")
	case errors.Is(err, services.ErrPatenteEnUso):
		httpx.WriteError(w, http.StatusConflict, "patente_en_uso", "ya existe un vehículo con esa patente")
	case errors.Is(err, services.ErrVehiculoNoDisponible):
		httpx.WriteError(w, http.StatusConflict, "vehiculo_no_disponible", "el vehículo está en mantenimiento")
	case errors.Is(err, services.ErrCapacidadExcedida):
		httpx.WriteError(w, http.StatusConflict, "capacidad_excedida", "los envíos de la ruta pesan más que la capacidad del vehículo")
	case errors.Is(err, repository.ErrRutaNoEditable):
		httpx.WriteError(w, http.StatusConflict, "ruta_no_editable", "la ruta ya se completó: no se le puede cambiar el vehículo")
	case errors.Is(err, repository.ErrVehiculoOcupado):
		httpx.WriteError(w, http.StatusConflict, "vehiculo_ocupado", "el vehículo ya tiene otra ruta ese día")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", fallback)
	}
}

// List maneja GET /operaciones/flota?fecha=YYYY-MM-DD (vacía = hoy).
func (h *FlotaHandler) List(w http.ResponseWriter, r *http.Request) {
	vs, err := h.svc.List(r.Context(), r.URL.Query().Get("fecha"))
	if err != nil {
		escribirErrorFlota(w, err, "no se pudo obtener la flota")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, vs)
}

// Detalle maneja GET /operaciones/flota/{id}?fecha=.
func (h *FlotaHandler) Detalle(w http.ResponseWriter, r *http.Request) {
	d, err := h.svc.Detalle(r.Context(), chi.URLParam(r, "id"), r.URL.Query().Get("fecha"))
	if err != nil {
		escribirErrorFlota(w, err, "no se pudo obtener el vehículo")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, d)
}

type vehiculoRequest struct {
	Patente          string  `json:"patente"`
	Modelo           string  `json:"modelo"`
	Tipo             string  `json:"tipo"`
	CapacidadPeso    float64 `json:"capacidad_peso"`
	CapacidadVolumen float64 `json:"capacidad_volumen"`
	Estado           string  `json:"estado"`
	Color            string  `json:"color"`
}

func (v vehiculoRequest) dominio() domain.Vehiculo {
	return domain.Vehiculo{Patente: v.Patente, Modelo: v.Modelo, Tipo: v.Tipo, CapacidadPeso: v.CapacidadPeso, CapacidadVolumen: v.CapacidadVolumen, Estado: v.Estado, Color: v.Color}
}

// Crear maneja POST /vehiculos.
func (h *FlotaHandler) Crear(w http.ResponseWriter, r *http.Request) {
	var req vehiculoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}
	v, err := h.svc.Crear(r.Context(), req.dominio())
	if err != nil {
		escribirErrorFlota(w, err, "no se pudo crear el vehículo")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, v)
}

// Actualizar maneja PUT /vehiculos/{id}.
func (h *FlotaHandler) Actualizar(w http.ResponseWriter, r *http.Request) {
	var req vehiculoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}
	v, err := h.svc.Actualizar(r.Context(), chi.URLParam(r, "id"), req.dominio())
	if err != nil {
		escribirErrorFlota(w, err, "no se pudo actualizar el vehículo")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, v)
}

// AsignarVehiculo maneja PUT /rutas/{id}/vehiculo con {"vehiculo_id": "..."} (vacío = quitar).
func (h *FlotaHandler) AsignarVehiculo(w http.ResponseWriter, r *http.Request) {
	var req struct {
		VehiculoID string `json:"vehiculo_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}
	if err := h.svc.AsignarARuta(r.Context(), chi.URLParam(r, "id"), req.VehiculoID); err != nil {
		escribirErrorFlota(w, err, "no se pudo asignar el vehículo")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Trayecto maneja GET /envios/{id}/trayecto: camino por calles del vehículo al destino.
func (h *FlotaHandler) Trayecto(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	t, err := h.svc.Trayecto(r.Context(), chi.URLParam(r, "id"), claims.UsuarioID, claims.Rol)
	if err != nil {
		escribirErrorFlota(w, err, "no se pudo calcular el trayecto")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, t)
}

// Stream maneja GET /operaciones/flota/stream: Server-Sent Events con la
// posición de cada vehículo ("event: posicion") y un latido cada 20 s para
// que proxies y balanceadores no corten la conexión.
func (h *FlotaHandler) Stream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.WriteError(w, http.StatusInternalServerError, "sin_streaming", "el servidor no soporta streaming")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	_, _ = fmt.Fprint(w, "retry: 3000\n\n")
	flusher.Flush()

	posiciones, desuscribir := h.hub.Suscribir()
	defer desuscribir()
	cambios, desuscribirCambios := h.hub.SuscribirCambios()
	defer desuscribirCambios()
	latido := time.NewTicker(20 * time.Second)
	defer latido.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-latido.C:
			_, _ = fmt.Fprint(w, ": latido\n\n")
			flusher.Flush()
		case id, ok := <-cambios:
			if !ok {
				return
			}
			b, _ := json.Marshal(map[string]string{"id": id})
			_, _ = fmt.Fprintf(w, "event: cambio\ndata: %s\n\n", b)
			flusher.Flush()
		case p, ok := <-posiciones:
			if !ok {
				return
			}
			b, _ := json.Marshal(p)
			_, _ = fmt.Fprintf(w, "event: posicion\ndata: %s\n\n", b)
			flusher.Flush()
		}
	}
}
