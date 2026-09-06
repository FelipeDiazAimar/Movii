package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

type repoFakeAuth struct {
	porEmail map[string]domain.Usuario
}

func nuevoRepoFakeAuth() *repoFakeAuth {
	return &repoFakeAuth{porEmail: map[string]domain.Usuario{}}
}

func (f *repoFakeAuth) Create(ctx context.Context, u domain.Usuario) (domain.Usuario, error) {
	if _, existe := f.porEmail[u.Email]; existe {
		return domain.Usuario{}, repository.ErrDuplicado
	}
	u.ID = "id-" + u.Email
	u.Activo = true
	f.porEmail[u.Email] = u
	return u, nil
}

func (f *repoFakeAuth) GetByEmail(ctx context.Context, email string) (domain.Usuario, error) {
	u, existe := f.porEmail[email]
	if !existe {
		return domain.Usuario{}, repository.ErrNoEncontrado
	}
	return u, nil
}

func TestRegisterHandler_Devuelve201(t *testing.T) {
	svc := services.NewAuthService(nuevoRepoFakeAuth(), "secreto-de-test")
	h := NewAuthHandler(svc)

	body, _ := json.Marshal(map[string]string{
		"nombre": "Ana", "email": "ana@movii.demo", "password": "clave-segura-123", "rol": domain.RolOperador,
	})
	req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Register(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Equal(t, "ana@movii.demo", resp["email"])
	require.NotContains(t, rec.Body.String(), "password")
}

func TestRegisterHandler_EmailDuplicadoDevuelve409(t *testing.T) {
	svc := services.NewAuthService(nuevoRepoFakeAuth(), "secreto-de-test")
	h := NewAuthHandler(svc)
	body, _ := json.Marshal(map[string]string{
		"nombre": "Ana", "email": "ana@movii.demo", "password": "clave-segura-123", "rol": domain.RolOperador,
	})

	h.Register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(body)))

	rec := httptest.NewRecorder()
	h.Register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(body)))

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestRegisterHandler_BodyInvalidoDevuelve400(t *testing.T) {
	svc := services.NewAuthService(nuevoRepoFakeAuth(), "secreto-de-test")
	h := NewAuthHandler(svc)

	req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader([]byte("no-es-json")))
	rec := httptest.NewRecorder()

	h.Register(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestLoginHandler_CredencialesCorrectasDevuelveToken(t *testing.T) {
	repo := nuevoRepoFakeAuth()
	svc := services.NewAuthService(repo, "secreto-de-test")
	h := NewAuthHandler(svc)

	regBody, _ := json.Marshal(map[string]string{
		"nombre": "Ana", "email": "ana@movii.demo", "password": "clave-segura-123", "rol": domain.RolOperador,
	})
	h.Register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(regBody)))

	loginBody, _ := json.Marshal(map[string]string{"email": "ana@movii.demo", "password": "clave-segura-123"})
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody))
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.NotEmpty(t, resp["token"])
}

func TestLoginHandler_CredencialesIncorrectasDevuelve401(t *testing.T) {
	svc := services.NewAuthService(nuevoRepoFakeAuth(), "secreto-de-test")
	h := NewAuthHandler(svc)

	body, _ := json.Marshal(map[string]string{"email": "no-existe@movii.demo", "password": "x"})
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}
