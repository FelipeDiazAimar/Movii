package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func TestEventoRepo_RegistrarYListar(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	envios := NewEnvioRepo(pool)
	eventos := NewEventoRepo(pool)
	ctx := context.Background()

	var repartidorID, repartidorNombre string
	err := pool.QueryRow(ctx, "SELECT id, nombre FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID, &repartidorNombre)
	require.NoError(t, err)

	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	envio, err := envios.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9201", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })

	// Evento raíz sin actor (anterior NULL, actor NULL), como el backfill.
	require.NoError(t, eventos.Registrar(ctx, pool, envio.ID, nil, domain.EstadoEnvioAsignado, nil, nil, nil, nil))

	anterior := domain.EstadoEnvioAsignado
	motivo := domain.MotivoClienteAusente
	comentario := "nadie atendió la puerta"
	require.NoError(t, eventos.Registrar(ctx, pool, envio.ID, &anterior, domain.EstadoEnvioNoEntregado, &motivo, &comentario, &repartidorID, nil))

	historial, err := eventos.ListarPorEnvio(ctx, envio.ID)
	require.NoError(t, err)
	require.NotNil(t, historial)
	require.Len(t, historial, 2)

	raiz := historial[0]
	require.NotEmpty(t, raiz.Fecha)
	require.Nil(t, raiz.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioAsignado, raiz.EstadoNuevo)
	require.Nil(t, raiz.ActorNombre)
	require.Nil(t, raiz.Motivo)
	require.Nil(t, raiz.Comentario)

	incidencia := historial[1]
	require.NotEmpty(t, incidencia.Fecha)
	require.NotNil(t, incidencia.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioAsignado, *incidencia.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioNoEntregado, incidencia.EstadoNuevo)
	require.NotNil(t, incidencia.ActorNombre)
	require.Equal(t, repartidorNombre, *incidencia.ActorNombre)
	require.NotNil(t, incidencia.Motivo)
	require.Equal(t, domain.MotivoClienteAusente, *incidencia.Motivo)
	require.NotNil(t, incidencia.Comentario)
	require.Equal(t, comentario, *incidencia.Comentario)
}

func TestEventoRepo_ListarPorEnvioVacioDevuelveSliceNoNil(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	eventos := NewEventoRepo(pool)
	ctx := context.Background()

	historial, err := eventos.ListarPorEnvio(ctx, "00000000-0000-0000-0000-000000000000")
	require.NoError(t, err)
	require.NotNil(t, historial)
	require.Empty(t, historial)
}

func TestEventoRepo_EsDelRepartidor(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	envios := NewEnvioRepo(pool)
	eventos := NewEventoRepo(pool)
	ctx := context.Background()

	var repartidorID string
	err := pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	var rutaID string
	err = pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id) VALUES ('Ruta Evento Test', 'Zona Test', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID) })

	envio, err := envios.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9202", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })

	// Sin ruta todavía: no pertenece a nadie.
	pertenece, err := eventos.EsDelRepartidor(ctx, envio.ID, repartidorID)
	require.NoError(t, err)
	require.False(t, pertenece)

	asignados, err := envios.AsignarEnvios(ctx, []string{envio.ID}, rutaID)
	require.NoError(t, err)
	require.Equal(t, 1, asignados)

	pertenece, err = eventos.EsDelRepartidor(ctx, envio.ID, repartidorID)
	require.NoError(t, err)
	require.True(t, pertenece, "el envío asignado a su ruta debería pertenecer al repartidor")

	// Otro repartidor (UUID inexistente): no pertenece.
	pertenece, err = eventos.EsDelRepartidor(ctx, envio.ID, "00000000-0000-0000-0000-000000000000")
	require.NoError(t, err)
	require.False(t, pertenece)
}
