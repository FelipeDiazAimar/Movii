package handlers

import (
	"context"
	"net/http"

	"movii/api/internal/domain"
	httpx "movii/api/internal/platform/http"
)

// listaUsuariosRepo es lo mínimo que UsuariosHandler necesita.
type listaUsuariosRepo interface {
	List(ctx context.Context) ([]domain.Usuario, error)
}

// UsuariosHandler expone el listado de usuarios (HU-01, CA-06).
type UsuariosHandler struct {
	repo listaUsuariosRepo
}

// NewUsuariosHandler crea un UsuariosHandler.
func NewUsuariosHandler(repo listaUsuariosRepo) *UsuariosHandler {
	return &UsuariosHandler{repo: repo}
}

type usuarioResponse struct {
	ID     string `json:"id"`
	Nombre string `json:"nombre"`
	Email  string `json:"email"`
	Rol    string `json:"rol"`
	Activo bool   `json:"activo"`
}

// List maneja GET /users.
func (h *UsuariosHandler) List(w http.ResponseWriter, r *http.Request) {
	usuarios, err := h.repo.List(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener la lista de usuarios")
		return
	}

	resp := make([]usuarioResponse, 0, len(usuarios))
	for _, u := range usuarios {
		resp = append(resp, usuarioResponse{ID: u.ID, Nombre: u.Nombre, Email: u.Email, Rol: u.Rol, Activo: u.Activo})
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}
