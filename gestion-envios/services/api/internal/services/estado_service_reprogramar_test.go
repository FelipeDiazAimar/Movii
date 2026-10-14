package services

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
	_ "movii/api/internal/testenv"
)

// Tests de Task 2 (HU-09): EstadoService.Reprogramar con transacción
// estado+evento. Reutilizan los helpers de estado_service_tx_test.go
// (nuevoEstadoServiceDeTest, crearEnvioAsignadoDeTest,
// crearEnvioPendienteDeEstado, estadoActualDeTest).

// crearEnvioNoEntregadoDeTest crea un envío en estado no_entregado en una
// ruta del repartidor dado (vía incidencia real) y devuelve su ID.
// La limpieza la hereda de crearEnvioAsignadoDeTest.
func crearEnvioNoEntregadoDeTest(t *testing.T, svc *EstadoService, pool *pgxpool.Pool, repartidorID string) string {
	t.Helper()
	ctx := context.Background()
	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
	_, err := svc.RegistrarIncidencia(ctx, envioID, domain.MotivoClienteAusente, "nadie atendió", nil, repartidorID, domain.RolRepartidor)
	require.NoError(t, err)
	return envioID
}

func fechaFuturaDeTest(dias int) string {
	return time.Now().UTC().AddDate(0, 0, dias).Format("2006-01-02")
}

func TestEstadoService_ReprogramarFeliz(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()
	eventos := repository.NewEventoRepo(pool)
	envios := repository.NewEnvioRepo(pool)

	envioID := crearEnvioNoEntregadoDeTest(t, svc, pool, repartidorID)
	nuevaFecha := fechaFuturaDeTest(1)

	actualizado, err := svc.Reprogramar(ctx, envioID, nuevaFecha, domain.FranjaTarde, repartidorID, domain.RolRepartidor)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioPendiente, actualizado.Estado)
	require.Equal(t, envioID, actualizado.ID)

	// Estado + columnas en la base; la ruta se limpia (un pendiente no
	// pertenece a ninguna ruta).
	require.Equal(t, domain.EstadoEnvioPendiente, estadoActualDeTest(t, pool, envioID))
	para, franja, err := envios.ReprogramacionDe(ctx, envioID)
	require.NoError(t, err)
	require.NotNil(t, para)
	require.Equal(t, nuevaFecha, *para)
	require.NotNil(t, franja)
	require.Equal(t, domain.FranjaTarde, *franja)
	var rutaID sql.NullString
	err = pool.QueryRow(ctx, "SELECT ruta_id FROM envios WHERE id = $1", envioID).Scan(&rutaID)
	require.NoError(t, err)
	require.False(t, rutaID.Valid)

	// Evento con anterior=no_entregado, nuevo=pendiente y comentario exacto.
	historial, err := eventos.ListarPorEnvio(ctx, envioID)
	require.NoError(t, err)
	require.NotEmpty(t, historial)
	ultimo := historial[len(historial)-1]
	require.Equal(t, domain.EstadoEnvioPendiente, ultimo.EstadoNuevo)
	require.NotNil(t, ultimo.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioNoEntregado, *ultimo.EstadoAnterior)
	require.Nil(t, ultimo.Motivo)
	require.NotNil(t, ultimo.Comentario)
	require.Equal(t, "reprogramado para "+nuevaFecha+" ("+domain.FranjaTarde+")", *ultimo.Comentario)
}

func TestEstadoService_ReprogramarOperadorSobreEnvioAjenoOK(t *testing.T) {
	svc, pool, repartidorID, operadorID := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	envioID := crearEnvioNoEntregadoDeTest(t, svc, pool, repartidorID)

	actualizado, err := svc.Reprogramar(ctx, envioID, fechaFuturaDeTest(2), domain.FranjaManana, operadorID, domain.RolOperador)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioPendiente, actualizado.Estado)
}

func TestEstadoService_ReprogramarRepartidorAjenoDaNoEncontrado(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()
	eventos := repository.NewEventoRepo(pool)

	envioID := crearEnvioNoEntregadoDeTest(t, svc, pool, repartidorID)
	eventosAntes, err := eventos.ListarPorEnvio(ctx, envioID)
	require.NoError(t, err)

	_, err = svc.Reprogramar(ctx, envioID, fechaFuturaDeTest(1), domain.FranjaNoche, "00000000-0000-0000-0000-000000000000", domain.RolRepartidor)
	require.ErrorIs(t, err, repository.ErrNoEncontrado)

	// Sin cambios: sigue no_entregado, sin columnas ni eventos nuevos.
	require.Equal(t, domain.EstadoEnvioNoEntregado, estadoActualDeTest(t, pool, envioID))
	eventosDespues, err := eventos.ListarPorEnvio(ctx, envioID)
	require.NoError(t, err)
	require.Len(t, eventosDespues, len(eventosAntes))
}

func TestEstadoService_ReprogramarEnvioInexistente(t *testing.T) {
	svc, _, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	_, err := svc.Reprogramar(ctx, "00000000-0000-0000-0000-000000000000", fechaFuturaDeTest(1), domain.FranjaTarde, repartidorID, domain.RolRepartidor)
	require.ErrorIs(t, err, repository.ErrNoEncontrado)
}

func TestEstadoService_ReprogramarFechaInvalida(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	t.Run("formato malo", func(t *testing.T) {
		envioID := crearEnvioNoEntregadoDeTest(t, svc, pool, repartidorID)
		_, err := svc.Reprogramar(ctx, envioID, "10-09-2026", domain.FranjaTarde, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrFechaInvalida)
		require.Equal(t, domain.EstadoEnvioNoEntregado, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("fecha pasada", func(t *testing.T) {
		envioID := crearEnvioNoEntregadoDeTest(t, svc, pool, repartidorID)
		_, err := svc.Reprogramar(ctx, envioID, fechaFuturaDeTest(-1), domain.FranjaTarde, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrFechaInvalida)
		require.Equal(t, domain.EstadoEnvioNoEntregado, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("hoy vale", func(t *testing.T) {
		envioID := crearEnvioNoEntregadoDeTest(t, svc, pool, repartidorID)
		hoy := time.Now().UTC().Format("2006-01-02")
		actualizado, err := svc.Reprogramar(ctx, envioID, hoy, domain.FranjaManana, repartidorID, domain.RolRepartidor)
		require.NoError(t, err)
		require.Equal(t, domain.EstadoEnvioPendiente, actualizado.Estado)
	})
}

func TestEstadoService_ReprogramarFranjaInvalida(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	envioID := crearEnvioNoEntregadoDeTest(t, svc, pool, repartidorID)
	_, err := svc.Reprogramar(ctx, envioID, fechaFuturaDeTest(1), "madrugada", repartidorID, domain.RolRepartidor)
	require.ErrorIs(t, err, ErrFranjaInvalida)
	require.Equal(t, domain.EstadoEnvioNoEntregado, estadoActualDeTest(t, pool, envioID))
}

func TestEstadoService_ReprogramarTransicionInvalida(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	t.Run("asignado", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.Reprogramar(ctx, envioID, fechaFuturaDeTest(1), domain.FranjaTarde, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrTransicionInvalida)
		require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("pendiente", func(t *testing.T) {
		envioID := crearEnvioPendienteDeEstado(t, pool)
		_, err := svc.Reprogramar(ctx, envioID, fechaFuturaDeTest(1), domain.FranjaTarde, repartidorID, domain.RolOperador)
		require.ErrorIs(t, err, ErrTransicionInvalida)
		require.Equal(t, domain.EstadoEnvioPendiente, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("en_camino", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.CambiarEstado(ctx, envioID, domain.EstadoEnvioEnCamino, repartidorID, domain.RolRepartidor)
		require.NoError(t, err)
		_, err = svc.Reprogramar(ctx, envioID, fechaFuturaDeTest(1), domain.FranjaTarde, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrTransicionInvalida)
		require.Equal(t, domain.EstadoEnvioEnCamino, estadoActualDeTest(t, pool, envioID))
	})
}
