package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

type repoFakeUsuarios struct {
	usuarios []domain.Usuario
}

func (f *repoFakeUsuarios) List(ctx context.Context) ([]domain.Usuario, error) {
	return f.usuarios, nil
}

func TestUsuariosHandler_List_Devuelve200ConLista(t *testing.T) {
	repo := &repoFakeUsuarios{usuarios: []domain.Usuario{
		{ID: "1", Nombre: "Ana", Email: "ana@movii.demo", Rol: domain.RolSupervisor, Activo: true, PasswordHash: "no-deberia-viajar"},
	}}
	h := NewUsuariosHandler(repo)

	req := httptest.NewRequest(http.MethodGet, "/users", nil)
	rec := httptest.NewRecorder()

	h.List(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.NotContains(t, rec.Body.String(), "no-deberia-viajar")

	var resp []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Len(t, resp, 1)
	require.Equal(t, "ana@movii.demo", resp[0]["email"])
}
