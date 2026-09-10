package services

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
	_ "movii/api/internal/testenv"
)

// Tests de Task 1, Paso 2 (HU-07 cierre):
// EstadoService.ObtenerFotoIncidencia.

var fotoIncidenciaServiceDeTest = []byte{0xFF, 0xD8, 0xFF, 0x00, 0x01}

// incidenciaConFotoDeTest registra una incidencia con o sin foto sobre un
// envío asignado del repartidor y devuelve el ID del evento de incidencia.
func incidenciaConFotoDeTest(t *testing.T, svc *EstadoService, pool *pgxpool.Pool, envioID string, foto []byte, repartidorID string) string {
	t.Helper()
	ctx := context.Background()

	_, err := svc.RegistrarIncidencia(ctx, envioID, domain.MotivoClienteAusente, "nadie atendió", foto, repartidorID, domain.RolRepartidor)
	require.NoError(t, err)

	var eventoID string
	err = pool.QueryRow(ctx, "SELECT id FROM eventos_envio WHERE envio_id = $1 AND estado_nuevo = 'no_entregado'", envioID).Scan(&eventoID)
	require.NoError(t, err)
	return eventoID
}

func TestEstadoService_ObtenerFotoIncidenciaFeliz(t *testing.T) {
	svc, pool, repartidorID, operadorID := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
	eventoID := incidenciaConFotoDeTest(t, svc, pool, envioID, fotoIncidenciaServiceDeTest, repartidorID)

	t.Run("repartidor dueño", func(t *testing.T) {
		foto, err := svc.ObtenerFotoIncidencia(ctx, envioID, eventoID, repartidorID, domain.RolRepartidor)
		require.NoError(t, err)
		require.Equal(t, fotoIncidenciaServiceDeTest, foto)
	})

	t.Run("operador sobre envio ajeno", func(t *testing.T) {
		foto, err := svc.ObtenerFotoIncidencia(ctx, envioID, eventoID, operadorID, domain.RolOperador)
		require.NoError(t, err)
		require.Equal(t, fotoIncidenciaServiceDeTest, foto)
	})
}

func TestEstadoService_ObtenerFotoIncidencia404(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
	eventoID := incidenciaConFotoDeTest(t, svc, pool, envioID, fotoIncidenciaServiceDeTest, repartidorID)

	t.Run("evento sin foto", func(t *testing.T) {
		envioID2 := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		eventoSinFoto := incidenciaConFotoDeTest(t, svc, pool, envioID2, nil, repartidorID)

		_, err := svc.ObtenerFotoIncidencia(ctx, envioID2, eventoSinFoto, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, repository.ErrNoEncontrado)
	})

	t.Run("evento inexistente", func(t *testing.T) {
		_, err := svc.ObtenerFotoIncidencia(ctx, envioID, "00000000-0000-0000-0000-000000000000", repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, repository.ErrNoEncontrado)
	})

	t.Run("evento de otro envio (mismatch)", func(t *testing.T) {
		envioID2 := crearEnvioAsignadoDeTest(t, pool, repartidorID)

		_, err := svc.ObtenerFotoIncidencia(ctx, envioID2, eventoID, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, repository.ErrNoEncontrado)
	})

	t.Run("repartidor ajeno", func(t *testing.T) {
		_, err := svc.ObtenerFotoIncidencia(ctx, envioID, eventoID, "00000000-0000-0000-0000-000000000000", domain.RolRepartidor)
		require.ErrorIs(t, err, repository.ErrNoEncontrado)
	})
}
