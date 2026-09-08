package services

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

// Un usuario dado de baja (activo = false) no puede iniciar sesión, y recibe
// el mismo error genérico que cualquier otra credencial inválida para no
// revelar que la cuenta existe (CA-03 y CA-04 de HU-01).
func TestLogin_RechazaUsuarioInactivo(t *testing.T) {
	repo := nuevoRepoFake()
	svc := NewAuthService(repo, "secreto-de-test")
	ctx := context.Background()

	_, err := svc.Register(ctx, "Baja", "baja@movii.demo", "clave-segura-123", domain.RolOperador)
	require.NoError(t, err)

	// El usuario existe y la contraseña es correcta: solo se lo da de baja.
	usuario := repo.porEmail["baja@movii.demo"]
	usuario.Activo = false
	repo.porEmail["baja@movii.demo"] = usuario

	token, err := svc.Login(ctx, "baja@movii.demo", "clave-segura-123")

	require.ErrorIs(t, err, ErrCredencialesInvalidas)
	require.Empty(t, token)
}

// El mismo usuario, mientras sigue activo, sí puede entrar. Sirve de control
// para que el test de arriba no pase por una razón equivocada.
func TestLogin_AceptaUsuarioActivo(t *testing.T) {
	svc := NewAuthService(nuevoRepoFake(), "secreto-de-test")
	ctx := context.Background()

	_, err := svc.Register(ctx, "Alta", "alta@movii.demo", "clave-segura-123", domain.RolOperador)
	require.NoError(t, err)

	token, err := svc.Login(ctx, "alta@movii.demo", "clave-segura-123")

	require.NoError(t, err)
	require.NotEmpty(t, token)
}
