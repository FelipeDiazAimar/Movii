package services

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// TestEnvioService_GetByIDDevuelveEventoRaiz: un envío recién creado trae 1
// evento raíz (anterior=nil, nuevo=pendiente, sin actor) — HU-10, Task 1.
// Antes (HU-06/HU-07) el historial salía vacío; con el evento raíz el
// tracking de envíos nuevos ya no sale vacío.
func TestEnvioService_GetByIDDevuelveEventoRaiz(t *testing.T) {
	svc, pool := nuevoEnvioServiceDeTest(t)
	ctx := context.Background()

	envio, err := svc.Create(ctx, CrearEnvioInput{
		RemitenteNombre: "Dep. Central", DestinatarioNombre: "Cliente Sin Eventos",
		Calle: "Belgrano", Numero: "500", Localidad: "San Francisco", CodigoPostal: "X2400",
		Peso: 1.5, Tamano: domain.TamanoChico,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", envio.RemitenteID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", envio.DestinatarioID)
	})

	detalle, err := svc.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.Equal(t, envio.ID, detalle.ID)
	require.Equal(t, "Cliente Sin Eventos", detalle.Destinatario.Nombre)
	require.NotNil(t, detalle.Historial, "el historial debe ser [] y no nil/null")
	require.Len(t, detalle.Historial, 1, "el envío recién creado trae su evento raíz")
	require.Nil(t, detalle.Historial[0].EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioPendiente, detalle.Historial[0].EstadoNuevo)
}

// TestEnvioService_GetByIDConEventosDevuelveHistorial: tras registrar eventos
// (transición + incidencia), el detalle los trae ordenados de más viejo a
// más nuevo — Task 5, HU-06/HU-07.
func TestEnvioService_GetByIDConEventosDevuelveHistorial(t *testing.T) {
	svc, pool := nuevoEnvioServiceDeTest(t)
	ctx := context.Background()
	eventos := repository.NewEventoRepo(pool)

	envio, err := svc.Create(ctx, CrearEnvioInput{
		RemitenteNombre: "Dep. Central", DestinatarioNombre: "Cliente Con Eventos",
		Calle: "Mitre", Numero: "200", Localidad: "San Francisco", CodigoPostal: "X2400",
		Peso: 2.0, Tamano: domain.TamanoMediano,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM eventos_envio WHERE envio_id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", envio.RemitenteID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", envio.DestinatarioID)
	})

	// El Create ya registra el evento raíz (HU-10, Task 1); acá solo se suma
	// la incidencia. El detalle trae ambos, ordenados de más viejo a más nuevo.
	anterior := domain.EstadoEnvioAsignado
	motivo := domain.MotivoClienteAusente
	comentario := "nadie atendió la puerta"
	require.NoError(t, eventos.Registrar(ctx, pool, envio.ID, &anterior, domain.EstadoEnvioNoEntregado, &motivo, &comentario, nil, nil))

	detalle, err := svc.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.NotNil(t, detalle.Historial)
	require.Len(t, detalle.Historial, 2)

	raiz := detalle.Historial[0]
	require.Nil(t, raiz.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioPendiente, raiz.EstadoNuevo)

	incidencia := detalle.Historial[1]
	require.NotNil(t, incidencia.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioAsignado, *incidencia.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioNoEntregado, incidencia.EstadoNuevo)
	require.NotNil(t, incidencia.Motivo)
	require.Equal(t, domain.MotivoClienteAusente, *incidencia.Motivo)
	require.NotNil(t, incidencia.Comentario)
	require.Equal(t, comentario, *incidencia.Comentario)
}

// TestEnvioService_GetByIDInexistenteDevuelveNoEncontrado: el 404 existente
// se preserva con el nuevo tipo de retorno.
func TestEnvioService_GetByIDInexistenteDevuelveNoEncontrado(t *testing.T) {
	svc, _ := nuevoEnvioServiceDeTest(t)

	_, err := svc.GetByID(context.Background(), "00000000-0000-0000-0000-000000000000")
	require.ErrorIs(t, err, repository.ErrNoEncontrado)
}
