package repository

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func nuevoPoolDeTestRuta(t *testing.T) *pgxpool.Pool {
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

func repartidorDeDemo(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(), "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&id)
	require.NoError(t, err)
	return id
}

func TestRutaRepo_CreateYGetByID(t *testing.T) {
	pool := nuevoPoolDeTestRuta(t)
	repo := NewRutaRepo(pool)
	ctx := context.Background()
	repartidorID := repartidorDeDemo(t, pool)

	creada, err := repo.Create(ctx, domain.Ruta{
		Nombre: "Ruta Test Create", Zona: "Centro", Fecha: "2026-09-10", RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	require.NotEmpty(t, creada.ID)
	require.Equal(t, domain.EstadoRutaPlanificada, creada.Estado)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", creada.ID) })

	encontrada, err := repo.GetByID(ctx, creada.ID)
	require.NoError(t, err)
	require.Equal(t, "Ruta Test Create", encontrada.Nombre)
}

func TestRutaRepo_GetByIDNoEncontrado(t *testing.T) {
	pool := nuevoPoolDeTestRuta(t)
	repo := NewRutaRepo(pool)

	_, err := repo.GetByID(context.Background(), "00000000-0000-0000-0000-000000000000")
	require.ErrorIs(t, err, ErrNoEncontrado)
}

func TestRutaRepo_UpdateSoloSiPlanificada(t *testing.T) {
	pool := nuevoPoolDeTestRuta(t)
	repo := NewRutaRepo(pool)
	ctx := context.Background()
	repartidorID := repartidorDeDemo(t, pool)

	creada, err := repo.Create(ctx, domain.Ruta{
		Nombre: "Ruta Test Update", Zona: "Centro", Fecha: "2026-09-10", RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", creada.ID) })

	actualizada, err := repo.Update(ctx, creada.ID, domain.Ruta{
		Nombre: "Ruta Renombrada", Zona: "Norte", Fecha: "2026-09-11", RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	require.Equal(t, "Ruta Renombrada", actualizada.Nombre)

	_, err = pool.Exec(ctx, "UPDATE rutas SET estado = 'en_curso' WHERE id = $1", creada.ID)
	require.NoError(t, err)

	_, err = repo.Update(ctx, creada.ID, domain.Ruta{
		Nombre: "No Debería Aplicar", Zona: "Norte", Fecha: "2026-09-11", RepartidorID: repartidorID,
	})
	require.ErrorIs(t, err, ErrRutaNoEditable)
}

func TestRutaRepo_ListIncluyeConteoDeEnvios(t *testing.T) {
	pool := nuevoPoolDeTestRuta(t)
	repo := NewRutaRepo(pool)
	ctx := context.Background()
	repartidorID := repartidorDeDemo(t, pool)

	creada, err := repo.Create(ctx, domain.Ruta{
		Nombre: "Ruta Test List", Zona: "Centro", Fecha: "2026-09-12", RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", creada.ID) })

	lista, err := repo.List(ctx, "2026-09-12")
	require.NoError(t, err)
	require.Len(t, lista, 1)
	require.Equal(t, 0, lista[0].CantidadEnvios)
}
