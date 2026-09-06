package services

import (
	"context"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// repoFake implementa usuarioRepo en memoria para testear AuthService sin DB.
type repoFake struct {
	porEmail map[string]domain.Usuario
}

func nuevoRepoFake() *repoFake {
	return &repoFake{porEmail: map[string]domain.Usuario{}}
}

func (f *repoFake) Create(ctx context.Context, u domain.Usuario) (domain.Usuario, error) {
	if _, existe := f.porEmail[u.Email]; existe {
		return domain.Usuario{}, repository.ErrDuplicado
	}
	u.ID = "id-" + u.Email
	u.Activo = true
	f.porEmail[u.Email] = u
	return u, nil
}

func (f *repoFake) GetByEmail(ctx context.Context, email string) (domain.Usuario, error) {
	u, existe := f.porEmail[email]
	if !existe {
		return domain.Usuario{}, repository.ErrNoEncontrado
	}
	return u, nil
}

func TestRegister_CreaUsuarioConPasswordHasheada(t *testing.T) {
	svc := NewAuthService(nuevoRepoFake(), "secreto-de-test")

	u, err := svc.Register(context.Background(), "Ana", "ana@movii.demo", "clave-segura-123", domain.RolOperador)

	require.NoError(t, err)
	require.NotEmpty(t, u.ID)
	require.NotEqual(t, "clave-segura-123", u.PasswordHash)
}

func TestRegister_RechazaEmailInvalido(t *testing.T) {
	svc := NewAuthService(nuevoRepoFake(), "secreto-de-test")

	_, err := svc.Register(context.Background(), "Ana", "no-es-un-email", "clave-segura-123", domain.RolOperador)

	require.ErrorIs(t, err, ErrEmailInvalido)
}

func TestRegister_RechazaRolInvalido(t *testing.T) {
	svc := NewAuthService(nuevoRepoFake(), "secreto-de-test")

	_, err := svc.Register(context.Background(), "Ana", "ana@movii.demo", "clave-segura-123", "rol-inventado")

	require.ErrorIs(t, err, ErrRolInvalido)
}

func TestRegister_RechazaEmailDuplicado(t *testing.T) {
	repo := nuevoRepoFake()
	svc := NewAuthService(repo, "secreto-de-test")
	ctx := context.Background()

	_, err := svc.Register(ctx, "Ana", "ana@movii.demo", "clave-segura-123", domain.RolOperador)
	require.NoError(t, err)

	_, err = svc.Register(ctx, "Ana Dos", "ana@movii.demo", "otra-clave-123", domain.RolOperador)
	require.ErrorIs(t, err, ErrEmailEnUso)
}

func TestLogin_DevuelveTokenValidoConCredencialesCorrectas(t *testing.T) {
	repo := nuevoRepoFake()
	svc := NewAuthService(repo, "secreto-de-test")
	ctx := context.Background()

	_, err := svc.Register(ctx, "Ana", "ana@movii.demo", "clave-segura-123", domain.RolSupervisor)
	require.NoError(t, err)

	token, err := svc.Login(ctx, "ana@movii.demo", "clave-segura-123")
	require.NoError(t, err)
	require.NotEmpty(t, token)

	parsed, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		return []byte("secreto-de-test"), nil
	})
	require.NoError(t, err)
	claims := parsed.Claims.(jwt.MapClaims)
	require.Equal(t, domain.RolSupervisor, claims["rol"])
}

func TestLogin_RechazaPasswordIncorrecta(t *testing.T) {
	repo := nuevoRepoFake()
	svc := NewAuthService(repo, "secreto-de-test")
	ctx := context.Background()

	_, err := svc.Register(ctx, "Ana", "ana@movii.demo", "clave-segura-123", domain.RolOperador)
	require.NoError(t, err)

	_, err = svc.Login(ctx, "ana@movii.demo", "clave-incorrecta")
	require.ErrorIs(t, err, ErrCredencialesInvalidas)
}

func TestLogin_RechazaEmailInexistente(t *testing.T) {
	svc := NewAuthService(nuevoRepoFake(), "secreto-de-test")

	_, err := svc.Login(context.Background(), "no-existe@movii.demo", "cualquier-clave")

	require.ErrorIs(t, err, ErrCredencialesInvalidas)
}
