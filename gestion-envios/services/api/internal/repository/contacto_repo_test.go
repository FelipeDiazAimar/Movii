package repository

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func nuevoPoolDeTestContacto(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return pool
}

func TestCreateRemitente(t *testing.T) {
	pool := nuevoPoolDeTestContacto(t)
	ctx := context.Background()

	creado, err := CreateRemitente(ctx, pool, domain.Remitente{
		Nombre: "Test Remitente", Telefono: "3564-000000", Direccion: "Calle Falsa 123",
	})
	require.NoError(t, err)
	require.NotEmpty(t, creado.ID)
	require.Equal(t, "Test Remitente", creado.Nombre)

	_, err = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", creado.ID)
	require.NoError(t, err)
}

func TestCreateDestinatario(t *testing.T) {
	pool := nuevoPoolDeTestContacto(t)
	ctx := context.Background()

	creado, err := CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Test Destinatario", Telefono: "3564-111111", Calle: "San Martín", Numero: "450",
		Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)
	require.NotEmpty(t, creado.ID)
	require.Equal(t, "San Francisco", creado.Localidad)

	_, err = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", creado.ID)
	require.NoError(t, err)
}
