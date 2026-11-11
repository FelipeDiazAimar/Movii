package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	qrcode "github.com/skip2/go-qrcode"

	httpx "movii/api/internal/platform/http"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// telefonosUsuarios es lo que hace falta para cargar el teléfono de un usuario.
type telefonosUsuarios interface {
	ActualizarTelefono(ctx context.Context, id, telefono string) error
}

// avisosDeEnvio lista los avisos registrados de un envío.
type avisosDeEnvio interface {
	NotificacionesDeEnvio(ctx context.Context, envioID string) ([]repository.NotificacionEnvio, error)
}

// WhatsappHandler expone la administración de la cuenta vinculada, el celular
// de los usuarios (HU-16) y el registro de avisos (HU-17).
type WhatsappHandler struct {
	wa       whatsapp.Administrable
	usuarios telefonosUsuarios
	avisos   avisosDeEnvio
	mail     EstadoMail
}

// EstadoMail describe el canal de mail de respaldo, para el panel del admin.
type EstadoMail struct {
	Configurado bool   `json:"configurado"`
	Proveedor   string `json:"proveedor"` // gmail | smtp | resend | log
	Remitente   string `json:"remitente,omitempty"`
	Descripcion string `json:"-"`
}

// ConMail informa en el estado cómo está configurado el mail de respaldo.
func (h *WhatsappHandler) ConMail(m EstadoMail) *WhatsappHandler {
	h.mail = m
	return h
}

// NewWhatsappHandler crea un WhatsappHandler.
func NewWhatsappHandler(wa whatsapp.Administrable, usuarios telefonosUsuarios, avisos avisosDeEnvio) *WhatsappHandler {
	return &WhatsappHandler{wa: wa, usuarios: usuarios, avisos: avisos}
}

type estadoWhatsappResponse struct {
	whatsapp.Estado
	// QRImagen es el QR listo para mostrar (data URL PNG).
	QRImagen string `json:"qr_imagen,omitempty"`
	// Mail es el canal de respaldo de los avisos.
	Mail EstadoMail `json:"mail"`
}

// Estado maneja GET /admin/whatsapp/estado. Si la cuenta no está vinculada,
// pide un QR nuevo para escanear desde WhatsApp → Dispositivos vinculados.
func (h *WhatsappHandler) Estado(w http.ResponseWriter, r *http.Request) {
	e := h.wa.Estado()
	if e.Habilitado && !e.Vinculado && e.QR == "" {
		if err := h.wa.IniciarVinculacion(r.Context()); err != nil {
			httpx.WriteError(w, http.StatusBadGateway, "whatsapp_error", "no se pudo iniciar la vinculación: "+err.Error())
			return
		}
		e = h.wa.Estado()
	}
	resp := estadoWhatsappResponse{Estado: e, Mail: h.mail}
	if e.QR != "" {
		if png, err := qrcode.Encode(e.QR, qrcode.Medium, 320); err == nil {
			resp.QRImagen = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
		}
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

// Desvincular maneja POST /admin/whatsapp/desvincular.
func (h *WhatsappHandler) Desvincular(w http.ResponseWriter, r *http.Request) {
	if err := h.wa.Desvincular(r.Context()); err != nil {
		httpx.WriteError(w, http.StatusBadGateway, "whatsapp_error", "no se pudo desvincular: "+err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ActualizarTelefono maneja PUT /users/{id}/telefono {"telefono": "..."} (vacío = quitar).
func (h *WhatsappHandler) ActualizarTelefono(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Telefono string `json:"telefono"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}
	tel := ""
	if req.Telefono != "" {
		var err error
		if tel, err = services.NormalizarTelefonoAR(req.Telefono); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "telefono_invalido", "ingresá un celular argentino con código de área")
			return
		}
	}
	err := h.usuarios.ActualizarTelefono(r.Context(), chi.URLParam(r, "id"), tel)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"telefono": tel})
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el usuario no existe")
	case errors.Is(err, repository.ErrTelefonoDuplicado):
		httpx.WriteError(w, http.StatusConflict, "telefono_en_uso", "otro usuario ya tiene ese teléfono")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo guardar el teléfono")
	}
}

// AvisosEnvio maneja GET /envios/{id}/avisos: los WhatsApp enviados al destinatario.
func (h *WhatsappHandler) AvisosEnvio(w http.ResponseWriter, r *http.Request) {
	ns, err := h.avisos.NotificacionesDeEnvio(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudieron obtener los avisos")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ns)
}
