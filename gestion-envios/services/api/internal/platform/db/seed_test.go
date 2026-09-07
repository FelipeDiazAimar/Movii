package db

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func TestSeed_UsuariosDeDemoExisten(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	require.NoError(t, RunMigrations(url, "../../../migrations"))

	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	defer pool.Close()

	var count int
	err = pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM usuarios WHERE email = 'repartidor@movii.demo'`,
	).Scan(&count)
	require.NoError(t, err)
	require.Equal(t, 1, count)
}
