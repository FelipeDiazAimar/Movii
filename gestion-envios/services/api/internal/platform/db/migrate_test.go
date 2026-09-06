package db

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

// TestRunMigrations_CreaTablas ejercita operaciones destructivas de migración
// (rollback/reapply) contra la MISMA base Supabase real que usan otros
// paquetes de test de este módulo (no hay aislamiento entre paquetes: es una
// única base compartida). Por eso este test depende de restaurar siempre el
// estado completamente migrado y sembrado (versión 2, con datos de seed)
// antes de retornar, usando t.Cleanup — que corre tanto si el test pasa como
// si falla a mitad de camino. Sin esto, otros paquetes cuyos tests corren en
// paralelo (go test ./... sin -p 1) podrían observar la base a mitad de
// migración o sin datos de seed.
func TestRunMigrations_CreaTablas(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	// Empezar limpio por si quedó estado de una corrida anterior.
	_ = RollbackLast(url, "../../../migrations")

	// Pase lo que pase de acá en adelante (assertion que falla, panic, etc.),
	// dejar la base completamente migrada y sembrada antes de que el test
	// retorne, para no romper otros paquetes que comparten esta misma base.
	t.Cleanup(func() {
		_ = RunMigrations(url, "../../../migrations")
	})

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

	// Dejar el down probado también. El t.Cleanup registrado arriba corre
	// después (LIFO) y vuelve a migrar todo hacia arriba, restaurando el
	// seed antes de que el test termine.
	require.NoError(t, RollbackLast(url, "../../../migrations"))
}
