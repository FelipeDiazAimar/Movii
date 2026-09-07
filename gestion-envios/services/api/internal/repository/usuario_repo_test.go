package repository

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func nuevoPoolDeTest(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return pool
}

func TestUsuarioRepo_CreateYGetByEmail(t *testing.T) {
	pool := nuevoPoolDeTest(t)
	repo := NewUsuarioRepo(pool)
	ctx := context.Background()

	email := fmt.Sprintf("test-%s@movii.demo", uuid.NewString())
	creado, err := repo.Create(ctx, domain.Usuario{
		Nombre:       "Usuario de Test",
		Email:        email,
		PasswordHash: "hash-falso",
		Rol:          domain.RolOperador,
	})
	require.NoError(t, err)
	require.NotEmpty(t, creado.ID)
	require.True(t, creado.Activo)

	encontrado, err := repo.GetByEmail(ctx, email)
	require.NoError(t, err)
	require.Equal(t, creado.ID, encontrado.ID)
	require.Equal(t, email, encontrado.Email)

	_, err = pool.Exec(ctx, "DELETE FROM usuarios WHERE id = $1", creado.ID)
	require.NoError(t, err)
}

func TestUsuarioRepo_CreateEmailDuplicado(t *testing.T) {
	pool := nuevoPoolDeTest(t)
	repo := NewUsuarioRepo(pool)
	ctx := context.Background()

	email := fmt.Sprintf("test-dup-%s@movii.demo", uuid.NewString())
	primero, err := repo.Create(ctx, domain.Usuario{
		Nombre: "Uno", Email: email, PasswordHash: "hash", Rol: domain.RolOperador,
	})
	require.NoError(t, err)

	_, err = repo.Create(ctx, domain.Usuario{
		Nombre: "Dos", Email: email, PasswordHash: "hash", Rol: domain.RolOperador,
	})
	require.ErrorIs(t, err, ErrDuplicado)

	_, _ = pool.Exec(ctx, "DELETE FROM usuarios WHERE id = $1", primero.ID)
}

func TestUsuarioRepo_GetByEmailNoEncontrado(t *testing.T) {
	pool := nuevoPoolDeTest(t)
	repo := NewUsuarioRepo(pool)

	_, err := repo.GetByEmail(context.Background(), "no-existe@movii.demo")
	require.ErrorIs(t, err, ErrNoEncontrado)
}

func TestUsuarioRepo_List(t *testing.T) {
	pool := nuevoPoolDeTest(t)
	repo := NewUsuarioRepo(pool)

	usuarios, err := repo.List(context.Background())
	require.NoError(t, err)
	require.NotEmpty(t, usuarios) // al menos los 3 del seed
}
