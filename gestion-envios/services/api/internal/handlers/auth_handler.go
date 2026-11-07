package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	httpx "movii/api/internal/platform/http"
	"movii/api/internal/services"
)

// AuthHandler expone HU-01 (registro, login) y el segundo paso del login con
// código por WhatsApp (HU-16).
type AuthHandler struct {
	svc *services.AuthService
	otp *services.OTPService
}

// ConSegundoFactor activa el login en dos pasos: con celular cargado, después
// de la contraseña se pide el código de 6 dígitos que llega por WhatsApp.
func (h *AuthHandler) ConSegundoFactor(otp *services.OTPService) *AuthHandler {
	h.otp = otp
	return h
}

// NewAuthHandler crea un AuthHandler.
func NewAuthHandler(svc *services.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type registerRequest struct {
	Nombre   string `json:"nombre"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Rol      string `json:"rol"`
	Telefono string `json:"telefono"`
}

// Register maneja POST /auth/register.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	u, err := h.svc.RegisterConTelefono(r.Context(), req.Nombre, req.Email, req.Password, req.Rol, req.Telefono)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusCreated, map[string]any{
			"id": u.ID, "nombre": u.Nombre, "email": u.Email, "rol": u.Rol, "telefono": u.Telefono,
		})
	case errors.Is(err, services.ErrEmailInvalido):
		httpx.WriteError(w, http.StatusBadRequest, "email_invalido", "el email no tiene un formato válido")
	case errors.Is(err, services.ErrRolInvalido):
		httpx.WriteError(w, http.StatusBadRequest, "rol_invalido", "el rol debe ser operador, repartidor o admin")
	case errors.Is(err, services.ErrTelefonoInvalido):
		httpx.WriteError(w, http.StatusBadRequest, "telefono_invalido", "ingresá un celular argentino con código de área")
	case errors.Is(err, services.ErrTelefonoEnUso):
		httpx.WriteError(w, http.StatusConflict, "telefono_en_uso", "ya existe un usuario con ese teléfono")
	case errors.Is(err, services.ErrEmailEnUso):
		httpx.WriteError(w, http.StatusConflict, "email_en_uso", "ya existe un usuario con ese email")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo registrar el usuario")
	}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login maneja POST /auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	u, err := h.svc.VerificarCredenciales(r.Context(), req.Email, req.Password)
	switch {
	case errors.Is(err, services.ErrCredencialesInvalidas):
		httpx.WriteError(w, http.StatusUnauthorized, "credenciales_invalidas", "email o contraseña incorrectos")
		return
	case err != nil:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo iniciar sesión")
		return
	}

	// Primer acceso (T1): 428 con un token que solo sirve para cambiar la
	// contraseña (no da acceso a ningún otro endpoint).
	if u.MustChangePassword {
		token, err := h.svc.EmitirTokenPrimerAcceso(u)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo iniciar sesión")
			return
		}
		var cuerpo primerAccesoResponse
		cuerpo.Code, cuerpo.UserID, cuerpo.Token = "must_change_password", u.ID, token
		cuerpo.Error.Code, cuerpo.Error.Message = "must_change_password", "es tu primer acceso: elegí una contraseña nueva desde la web de Movii"
		httpx.WriteJSON(w, http.StatusPreconditionRequired, cuerpo)
		return
	}

	// Segundo paso (HU-16): el token sale recién con el código de WhatsApp.
	if h.otp != nil && h.otp.Requiere(u) {
		desafio, err := h.otp.Iniciar(r.Context(), u)
		switch {
		case err == nil:
			httpx.WriteJSON(w, http.StatusOK, loginResponse{RequiereCodigo: true, Desafio: &desafio})
			return
		case errors.Is(err, services.ErrDemasiadosPedidos), errors.Is(err, services.ErrEsperarReenvio):
			escribirErrorCodigo(w, err)
			return
		default:
			// WhatsApp no pudo entregar el código: se entra solo con la
			// contraseña para no dejar a nadie afuera (queda en el log).
			log.Printf("login: sin segundo factor para %s: %v", u.Email, err)
		}
	}

	token, err := h.svc.EmitirToken(u)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo iniciar sesión")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, loginResponse{Token: token})
}

// primerAccesoResponse es el cuerpo del 428: {code, user_id, token, error}.
type primerAccesoResponse struct {
	Code   string `json:"code"`
	UserID string `json:"user_id"`
	Token  string `json:"token"` // solo para /auth/primer-acceso/cambiar-password (15 min)
	httpx.APIError
}

// escribirErrorCodigo traduce los errores del código de verificación (OTPService).
func escribirErrorCodigo(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, services.ErrCodigoVencido):
		httpx.WriteError(w, http.StatusUnauthorized, "codigo_vencido", "el código venció o superaste los intentos; pedí uno nuevo")
	case errors.Is(err, services.ErrCodigoInvalido):
		httpx.WriteError(w, http.StatusUnauthorized, "codigo_invalido", "el código es incorrecto")
	case errors.Is(err, services.ErrEsperarReenvio):
		httpx.WriteError(w, http.StatusTooManyRequests, "esperar_reenvio", "esperá un minuto antes de pedir otro código")
	case errors.Is(err, services.ErrDemasiadosPedidos):
		httpx.WriteError(w, http.StatusTooManyRequests, "demasiados_pedidos", "pediste demasiados códigos; esperá 15 minutos")
	default:
		log.Printf("código de verificación: %v", err)
		httpx.WriteError(w, http.StatusBadGateway, "envio_codigo_error", "no se pudo enviar el código; probá de nuevo en un minuto")
	}
}

// loginResponse es {token} o, con segundo factor, {requiere_codigo, desafio_id, telefono, vence_en_segundos}.
type loginResponse struct {
	Token          string `json:"token,omitempty"`
	RequiereCodigo bool   `json:"requiere_codigo,omitempty"`
	*services.Desafio
}

type codigoRequest struct {
	DesafioID string `json:"desafio_id"`
	Codigo    string `json:"codigo"`
}

// VerificarCodigo maneja POST /auth/login/verificar {"desafio_id", "codigo"} → {"token"}.
func (h *AuthHandler) VerificarCodigo(w http.ResponseWriter, r *http.Request) {
	var req codigoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || h.otp == nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}
	token, err := h.otp.Verificar(r.Context(), req.DesafioID, req.Codigo)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, loginResponse{Token: token})
	case errors.Is(err, services.ErrCodigoInvalido):
		escribirErrorCodigo(w, err)
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo verificar el código")
	}
}

// ReenviarCodigo maneja POST /auth/login/reenviar {"desafio_id"}: manda un código nuevo.
func (h *AuthHandler) ReenviarCodigo(w http.ResponseWriter, r *http.Request) {
	var req codigoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || h.otp == nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}
	desafio, err := h.otp.Reenviar(r.Context(), req.DesafioID)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, loginResponse{RequiereCodigo: true, Desafio: &desafio})
	case errors.Is(err, services.ErrCodigoInvalido):
		httpx.WriteError(w, http.StatusUnauthorized, "codigo_invalido", "el inicio de sesión venció; volvé a ingresar tu contraseña")
	default:
		escribirErrorCodigo(w, err)
	}
}

type cambiarPasswordRequest struct {
	UserID        string `json:"user_id"`
	NuevaPassword string `json:"nueva_password"`
	Token         string `json:"token"` // el del 428 del login
}

// CambiarPasswordPrimerAcceso maneja POST /auth/primer-acceso/cambiar-password
// {user_id, nueva_password, token}: guarda la contraseña nueva y manda el
// código por WhatsApp o mail. El token de sesión sale de /auth/primer-acceso/verificar.
func (h *AuthHandler) CambiarPasswordPrimerAcceso(w http.ResponseWriter, r *http.Request) {
	var req cambiarPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || h.otp == nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}
	u, err := h.svc.CambiarPasswordPrimerAcceso(r.Context(), req.Token, req.UserID, req.NuevaPassword)
	switch {
	case errors.Is(err, services.ErrPrimerAccesoInvalido):
		httpx.WriteError(w, http.StatusUnauthorized, "primer_acceso_invalido", "el primer acceso venció; volvé a iniciar sesión")
		return
	case errors.Is(err, services.ErrPasswordDebil):
		httpx.WriteError(w, http.StatusBadRequest, "password_debil", "la contraseña debe tener al menos 8 caracteres, una mayúscula y un número")
		return
	case err != nil:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo cambiar la contraseña")
		return
	}
	desafio, err := h.otp.Iniciar(r.Context(), u)
	if err != nil {
		escribirErrorCodigo(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, loginResponse{RequiereCodigo: true, Desafio: &desafio})
}
