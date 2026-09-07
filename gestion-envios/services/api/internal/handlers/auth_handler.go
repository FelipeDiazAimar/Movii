package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	httpx "movii/api/internal/platform/http"
	"movii/api/internal/services"
)

// AuthHandler expone HU-01: registro, login.
type AuthHandler struct {
	svc *services.AuthService
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
}

// Register maneja POST /auth/register.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	u, err := h.svc.Register(r.Context(), req.Nombre, req.Email, req.Password, req.Rol)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusCreated, map[string]any{
			"id": u.ID, "nombre": u.Nombre, "email": u.Email, "rol": u.Rol,
		})
	case errors.Is(err, services.ErrEmailInvalido):
		httpx.WriteError(w, http.StatusBadRequest, "email_invalido", "el email no tiene un formato válido")
	case errors.Is(err, services.ErrRolInvalido):
		httpx.WriteError(w, http.StatusBadRequest, "rol_invalido", "el rol debe ser operador, repartidor o supervisor")
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

	token, err := h.svc.Login(r.Context(), req.Email, req.Password)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"token": token})
	case errors.Is(err, services.ErrCredencialesInvalidas):
		httpx.WriteError(w, http.StatusUnauthorized, "credenciales_invalidas", "email o contraseña incorrectos")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo iniciar sesión")
	}
}
