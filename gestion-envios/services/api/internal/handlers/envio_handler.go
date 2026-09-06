package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// EnvioHandler expone HU-02: alta, listado y detalle de envíos.
type EnvioHandler struct {
	svc *services.EnvioService
}

// NewEnvioHandler crea un EnvioHandler.
func NewEnvioHandler(svc *services.EnvioService) *EnvioHandler {
	return &EnvioHandler{svc: svc}
}

type crearEnvioRequest struct {
	Remitente struct {
		Nombre    string `json:"nombre"`
		Telefono  string `json:"telefono"`
		Direccion string `json:"direccion"`
	} `json:"remitente"`
	Destinatario struct {
		Nombre       string `json:"nombre"`
		Telefono     string `json:"telefono"`
		Calle        string `json:"calle"`
		Numero       string `json:"numero"`
		PisoDepto    string `json:"piso_depto"`
		Localidad    string `json:"localidad"`
		CodigoPostal string `json:"codigo_postal"`
	} `json:"destinatario"`
	Paquete struct {
		Peso          float64 `json:"peso"`
		Tamano        string  `json:"tamano"`
		TipoContenido string  `json:"tipo_contenido"`
		Fragil        bool    `json:"fragil"`
		Urgente       bool    `json:"urgente"`
	} `json:"paquete"`
}

// Create maneja POST /envios.
func (h *EnvioHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req crearEnvioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	envio, err := h.svc.Create(r.Context(), services.CrearEnvioInput{
		RemitenteNombre:      req.Remitente.Nombre,
		RemitenteTelefono:    req.Remitente.Telefono,
		RemitenteDireccion:   req.Remitente.Direccion,
		DestinatarioNombre:   req.Destinatario.Nombre,
		DestinatarioTelefono: req.Destinatario.Telefono,
		Calle:                req.Destinatario.Calle,
		Numero:               req.Destinatario.Numero,
		PisoDepto:            req.Destinatario.PisoDepto,
		Localidad:            req.Destinatario.Localidad,
		CodigoPostal:         req.Destinatario.CodigoPostal,
		Peso:                 req.Paquete.Peso,
		Tamano:               req.Paquete.Tamano,
		TipoContenido:        req.Paquete.TipoContenido,
		Fragil:               req.Paquete.Fragil,
		Urgente:              req.Paquete.Urgente,
	})
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusCreated, map[string]any{
			"id": envio.ID, "codigo_guia": envio.CodigoGuia, "estado": envio.Estado,
			"peso": envio.Peso, "tamano": envio.Tamano,
		})
	case errors.Is(err, services.ErrCamposObligatorios):
		httpx.WriteError(w, http.StatusBadRequest, "campos_obligatorios", "faltan datos obligatorios del envío")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo registrar el envío")
	}
}

type envioListItemResponse struct {
	ID           string  `json:"id"`
	CodigoGuia   string  `json:"codigo_guia"`
	Estado       string  `json:"estado"`
	Peso         float64 `json:"peso"`
	Tamano       string  `json:"tamano"`
	Destinatario string  `json:"destinatario"`
	Direccion    string  `json:"direccion"`
	RutaID       *string `json:"ruta_id"`
}

// List maneja GET /envios?estado=&fecha=.
func (h *EnvioHandler) List(w http.ResponseWriter, r *http.Request) {
	estado := r.URL.Query().Get("estado")
	fecha := r.URL.Query().Get("fecha")

	envios, err := h.svc.List(r.Context(), estado, fecha)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener la lista de envíos")
		return
	}

	resp := make([]envioListItemResponse, 0, len(envios))
	for _, e := range envios {
		resp = append(resp, envioListItemResponse{
			ID: e.ID, CodigoGuia: e.CodigoGuia, Estado: e.Estado, Peso: e.Peso, Tamano: e.Tamano,
			Destinatario: e.Destinatario.Nombre,
			Direccion:    e.Destinatario.Calle + " " + e.Destinatario.Numero + ", " + e.Destinatario.Localidad,
			RutaID:       e.RutaID,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

// GetByID maneja GET /envios/{id}.
func (h *EnvioHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	envio, err := h.svc.GetByID(r.Context(), id)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, envio)
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el envío no existe")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener el envío")
	}
}
