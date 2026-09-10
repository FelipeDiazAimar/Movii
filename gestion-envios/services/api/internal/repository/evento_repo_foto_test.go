package repository

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

// Tests de Task 1 (HU-07 cierre): EventoRepo.ObtenerFoto + flag tiene_foto
// en ListarPorEnvio.

var fotoIncidenciaDeTest = []byte{0xFF, 0xD8, 0xFF, 0x00, 0x01}

// crearEnvioConIncidenciaDeTest crea un envío con una incidencia
// (→ no_entregado) con o sin foto, y devuelve el envío y el ID del evento
// de incidencia. Limpia todo al final del test.
func crearEnvioConIncidenciaDeTest(t *testing.T, pool *pgxpool.Pool, eventos *EventoRepo, codigo string, foto []byte) (envioID, eventoID string) {
	t.Helper()
	ctx := context.Background()

	envios := NewEnvioRepo(pool)
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)
	envio, err := envios.Create(ctx, pool, domain.Envio{
		CodigoGuia: codigo, Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })

	motivo := domain.MotivoClienteAusente
	comentario := "nadie atendió"
	require.NoError(t, eventos.Registrar(ctx, pool, envio.ID, nil, domain.EstadoEnvioNoEntregado, &motivo, &comentario, nil, foto))

	err = pool.QueryRow(ctx, "SELECT id FROM eventos_envio WHERE envio_id = $1 AND estado_nuevo = 'no_entregado'", envio.ID).Scan(&eventoID)
	require.NoError(t, err)
	return envio.ID, eventoID
}

func TestEventoRepo_ObtenerFoto(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	eventos := NewEventoRepo(pool)
	ctx := context.Background()

	t.Run("con foto devuelve bytes y envio", func(t *testing.T) {
		envioID, eventoID := crearEnvioConIncidenciaDeTest(t, pool, eventos, "MOV-19000101-9301", fotoIncidenciaDeTest)

		foto, dueño, err := eventos.ObtenerFoto(ctx, eventoID)
		require.NoError(t, err)
		require.Equal(t, fotoIncidenciaDeTest, foto)
		require.Equal(t, envioID, dueño)
	})

	t.Run("sin foto da no encontrado", func(t *testing.T) {
		_, eventoID := crearEnvioConIncidenciaDeTest(t, pool, eventos, "MOV-19000101-9302", nil)

		_, _, err := eventos.ObtenerFoto(ctx, eventoID)
		require.ErrorIs(t, err, ErrNoEncontrado)
	})

	t.Run("evento inexistente da no encontrado", func(t *testing.T) {
		_, _, err := eventos.ObtenerFoto(ctx, "00000000-0000-0000-0000-000000000000")
		require.ErrorIs(t, err, ErrNoEncontrado)
	})
}

func TestEventoRepo_ListarPorEnvioTieneFoto(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	eventos := NewEventoRepo(pool)
	ctx := context.Background()

	t.Run("incidencia con foto marca true y el resto false", func(t *testing.T) {
		envioID, _ := crearEnvioConIncidenciaDeTest(t, pool, eventos, "MOV-19000101-9303", fotoIncidenciaDeTest)

		historial, err := eventos.ListarPorEnvio(ctx, envioID)
		require.NoError(t, err)
		require.NotEmpty(t, historial)
		ultimo := historial[len(historial)-1]
		require.Equal(t, domain.EstadoEnvioNoEntregado, ultimo.EstadoNuevo)
		require.True(t, ultimo.TieneFoto, "la incidencia con foto debe marcar tiene_foto")
		for _, e := range historial[:len(historial)-1] {
			require.False(t, e.TieneFoto, "los eventos sin foto deben marcar false, no null")
		}
	})

	t.Run("incidencia sin foto marca false", func(t *testing.T) {
		envioID, _ := crearEnvioConIncidenciaDeTest(t, pool, eventos, "MOV-19000101-9304", nil)

		historial, err := eventos.ListarPorEnvio(ctx, envioID)
		require.NoError(t, err)
		require.NotEmpty(t, historial)
		for _, e := range historial {
			require.False(t, e.TieneFoto)
		}
	})
}
