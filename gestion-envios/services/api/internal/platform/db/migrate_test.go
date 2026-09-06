package db

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func TestRunMigrations_CreaTablas(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	// Empezar limpio por si quedó estado de una corrida anterior.
	_ = RollbackLast(url, "../../../migrations")

	err := RunMigrations(url, "../../../migrations")
	require.NoError(t, err)

	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	defer pool.Close()

	var existe bool
	err = pool.QueryRow(context.Background(),
		`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios')`,
	).Scan(&existe)
	require.NoError(t, err)
	require.True(t, existe, "la tabla usuarios debería existir tras migrar")

	// Dejar el down probado también.
	require.NoError(t, RollbackLast(url, "../../../migrations"))
}
