package repository

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

// Helpers locales de HU-10 Task 1 (no tocan los helpers/tests existentes).

func nuevaRutaHU10(t *testing.T, pool *pgxpool.Pool, nombre string) string {
	t.Helper()
	ctx := context.Background()
	var repartidorID string
	require.NoError(t, pool.QueryRow(ctx,
		"SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))
	var rutaID string
	require.NoError(t, pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id)
		VALUES ($1, 'Zona', CURRENT_DATE, $2)
		RETURNING id
	`, nombre, repartidorID).Scan(&rutaID))
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "UPDATE envios SET ruta_id = NULL WHERE ruta_id = $1", rutaID)
		_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID)
	})
	return rutaID
}

func historialDeHU10(t *testing.T, pool *pgxpool.Pool, envioID string) []domain.EventoEnvio {
	t.Helper()
	historial, err := NewEventoRepo(pool).ListarPorEnvio(context.Background(), envioID)
	require.NoError(t, err)
	return historial
}

// HU-10 Task 1, Paso 2: asignar N envíos registra N eventos
// (anterior=pendiente, nuevo=asignado) en la misma tx.
func TestEnvioRepo_AsignarRegistraEventos(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	rutaID := nuevaRutaHU10(t, pool, "Ruta HU10 Asignar Eventos")

	id1 := crearEnvioPendienteParaAsignar(t, repo, "MOV-19000101-9301")
	id2 := crearEnvioPendienteParaAsignar(t, repo, "MOV-19000101-9302")

	asignados, err := repo.AsignarEnvios(ctx, []string{id1, id2}, rutaID)
	require.NoError(t, err)
	require.Equal(t, 2, asignados)

	for _, id := range []string{id1, id2} {
		historial := historialDeHU10(t, pool, id)
		require.Len(t, historial, 1, "cada envío asignado trae 1 evento")
		require.NotNil(t, historial[0].EstadoAnterior)
		require.Equal(t, domain.EstadoEnvioPendiente, *historial[0].EstadoAnterior)
		require.Equal(t, domain.EstadoEnvioAsignado, historial[0].EstadoNuevo)
		require.Nil(t, historial[0].ActorNombre)
	}
}

// HU-10 Task 1, Paso 2 (atomicidad): un lote fallido no deja eventos.
func TestEnvioRepo_AsignarFallidoNoRegistraEventos(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	rutaID := nuevaRutaHU10(t, pool, "Ruta HU10 Asignar Fallido")

	pendiente := crearEnvioPendienteParaAsignar(t, repo, "MOV-19000101-9303")
	yaAsignado := crearEnvioPendienteParaAsignar(t, repo, "MOV-19000101-9304")

	asignados, err := repo.AsignarEnvios(ctx, []string{yaAsignado}, rutaID)
	require.NoError(t, err)
	require.Equal(t, 1, asignados)

	asignados, err = repo.AsignarEnvios(ctx, []string{pendiente, yaAsignado}, rutaID)
	require.ErrorIs(t, err, ErrEnvioNoDisponible)
	require.Zero(t, asignados)

	require.Empty(t, historialDeHU10(t, pool, pendiente),
		"el lote fallido no debe dejar eventos en el pendiente")
	require.Len(t, historialDeHU10(t, pool, yaAsignado), 1,
		"el ya asignado conserva solo su evento de asignación original")
}

// HU-10 Task 1, Paso 3: desasignar registra 1 evento
// (anterior=asignado, nuevo=pendiente) atómico con el UPDATE.
func TestEnvioRepo_DesasignarRegistraEvento(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	rutaID := nuevaRutaHU10(t, pool, "Ruta HU10 Desasignar Evento")

	envioID := crearEnvioPendienteParaAsignar(t, repo, "MOV-19000101-9305")

	asignados, err := repo.AsignarEnvios(ctx, []string{envioID}, rutaID)
	require.NoError(t, err)
	require.Equal(t, 1, asignados)

	require.NoError(t, repo.DesasignarEnvio(ctx, envioID, rutaID))

	historial := historialDeHU10(t, pool, envioID)
	require.Len(t, historial, 2, "asignar + desasignar")
	desasignado := historial[1]
	require.NotNil(t, desasignado.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioAsignado, *desasignado.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioPendiente, desasignado.EstadoNuevo)

	detalle, err := repo.GetByID(ctx, envioID)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioPendiente, detalle.Estado)
	require.Nil(t, detalle.RutaID)
}

// HU-10 Task 1, Paso 3 (error): desasignar inexistente no deja eventos.
func TestEnvioRepo_DesasignarInexistenteNoRegistraEvento(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	rutaID := nuevaRutaHU10(t, pool, "Ruta HU10 Desasignar Error")

	err := repo.DesasignarEnvio(ctx, "00000000-0000-0000-0000-000000000000", rutaID)
	require.ErrorIs(t, err, ErrNoEncontrado)
}
