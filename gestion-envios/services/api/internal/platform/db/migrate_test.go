package db

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

// TestRunMigrations_CreaTablas verifica que RunMigrations deja el esquema
// aplicado (idempotente si ya estaba al día) contra la MISMA base Supabase
// real que usan otros paquetes de test de este módulo — no hay aislamiento
// entre paquetes ni entre planes de implementación: es una única base
// compartida y creciente.
//
// A propósito, este test NO ejercita un rollback real de la migración de
// seed (RollbackLast en versión 2→1) como parte de la suite automática: la
// migración 0002_seed.down.sql borra usuarios de demo, y cualquier fila de
// OTRO paquete de test (por ejemplo una ruta creada por internal/services o
// internal/handlers) que quede apuntando a esos usuarios por FK — algo que
// pasa fácilmente si un test se corta a mitad de camino en una corrida
// interrumpida — rompe el DELETE con una violación de foreign key y deja la
// tabla schema_migrations en estado "dirty". Esto ya ocurrió en la práctica
// durante el desarrollo de este plan. La corrección del código de
// RollbackLast (Task 3/4 de HU-01, ya revisada) sigue siendo válida y se usa
// desde `cmd/migrate down` para uso manual; simplemente no se re-ejercita
// aquí en cada corrida de la suite automática.
func TestRunMigrations_CreaTablas(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

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

	// Llamar RunMigrations de nuevo debe ser un no-op seguro (ErrNoChange
	// manejado internamente), no un error.
	require.NoError(t, RunMigrations(url, "../../../migrations"))
}
