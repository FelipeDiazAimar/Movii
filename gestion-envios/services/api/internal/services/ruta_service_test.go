package services

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

func TestValidarRuta_RechazaSinRepartidor(t *testing.T) {
	err := validarRuta(domain.Ruta{Fecha: "2026-09-10"})
	require.ErrorIs(t, err, ErrRutaCamposObligatorios)
}

func TestValidarRuta_RechazaSinFecha(t *testing.T) {
	err := validarRuta(domain.Ruta{RepartidorID: "algún-id"})
	require.ErrorIs(t, err, ErrRutaCamposObligatorios)
}

func TestValidarRuta_AceptaCompleta(t *testing.T) {
	err := validarRuta(domain.Ruta{RepartidorID: "algún-id", Fecha: "2026-09-10"})
	require.NoError(t, err)
}

func nuevoRutaServiceDeTest(t *testing.T) (*RutaService, *pgxpool.Pool, string) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	var repartidorID string
	err = pool.QueryRow(context.Background(), "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	return NewRutaService(repository.NewRutaRepo(pool)), pool, repartidorID
}

func TestRutaService_CreateYDetalle(t *testing.T) {
	svc, pool, repartidorID := nuevoRutaServiceDeTest(t)
	ctx := context.Background()

	ruta, err := svc.Create(ctx, domain.Ruta{Nombre: "Ruta Service Test", Zona: "Centro", Fecha: "2026-09-15", RepartidorID: repartidorID})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	detalle, err := svc.Detalle(ctx, ruta.ID)
	require.NoError(t, err)
	require.Equal(t, 0, detalle.CantidadEnvios)
	require.Equal(t, float64(0), detalle.PesoTotal)
}

func TestRutaService_CreateRechazaSinDatos(t *testing.T) {
	svc, _, _ := nuevoRutaServiceDeTest(t)

	_, err := svc.Create(context.Background(), domain.Ruta{})
	require.ErrorIs(t, err, ErrRutaCamposObligatorios)
}
